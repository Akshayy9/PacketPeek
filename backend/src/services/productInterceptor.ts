import * as fuzz from 'fuzzball';
import { FilterQuery } from 'mongoose';
import { Product, IProduct } from '../models/Product';
import { NormalizedProduct } from './offClient';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum token_set_ratio score to treat an OFF product as a match to a
 *  seeded manual document and perform an upsert rather than a fresh insert. */
const FUZZY_MATCH_THRESHOLD = 85;

/** Mongoose duplicate-key error code. */
const MONGO_DUPLICATE_KEY_CODE = 11000;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface FuzzyCandidate {
  /** Lean Mongoose document from the products collection. */
  doc: IProduct;
  /** token_set_ratio score against the OFF product name (0-100). */
  score: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the MongoDB filter used to fetch manual-seeded candidates.
 *
 * Always filters on:
 *   - source === 'manual'
 *   - barcode starting with "manual_"
 *
 * If the OFF data includes a brand, narrows the query further with a
 * case-insensitive regex on the brand field to keep the candidate set small.
 */
function buildCandidateFilter(offBrand: string | null): FilterQuery<IProduct> {
  const base: FilterQuery<IProduct> = {
    source: 'manual',
    barcode: { $regex: /^manual_/ },
  };

  if (offBrand && offBrand.trim().length > 0) {
    // Escape any regex special characters in the brand string before use
    const escaped = offBrand.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    base.brand = { $regex: new RegExp(escaped, 'i') };
  }

  return base;
}

/**
 * Find the best-matching manual candidate for a given OFF product name.
 *
 * Iterates through the candidates array and returns the one with the highest
 * token_set_ratio score along with that score. Returns null if the array is
 * empty.
 */
function findBestCandidate(
  offProductName: string,
  candidates: IProduct[]
): FuzzyCandidate | null {
  if (candidates.length === 0) return null;

  let best: FuzzyCandidate | null = null;

  for (const candidate of candidates) {
    const score = fuzz.token_set_ratio(
      offProductName.toLowerCase(),
      candidate.product_name.toLowerCase()
    );

    if (best === null || score > best.score) {
      best = { doc: candidate, score };
    }
  }

  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core service function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * mergeOrInsertOFFProduct
 * ─────────────────────────────────────────────────────────────────────────────
 * Intercepts an OFF-fetched product before it touches the database and decides
 * whether to:
 *
 *   A) MERGE into an existing seeded manual document  (score >= threshold)
 *      — Swaps the synthetic barcode for the real one
 *      — Updates image_url if the seeded doc has none
 *      — Preserves the seeded ingredients and nutrient data (higher quality)
 *      — Updates source to 'off' and stamps updated_at
 *
 *   B) INSERT as a brand-new document                 (score < threshold)
 *      — Standard new Product save
 *      — Handles concurrent duplicate-key errors gracefully
 *
 * @param offData - Normalized OFF product data from offClient.fetchFromOFF()
 * @returns The saved/updated IProduct Mongoose document
 */
export async function mergeOrInsertOFFProduct(
  offData: NormalizedProduct
): Promise<IProduct> {
  // ── 1. Fetch manual candidates ──────────────────────────────────────────
  const filter = buildCandidateFilter(offData.brand);
  const candidates = await Product.find(filter).lean<IProduct[]>().exec();

  console.log(
    `[INTERCEPTOR] Fuzzy search for "${offData.product_name}" — ` +
      `${candidates.length} candidate(s) (brand filter: ${offData.brand ?? 'none'})`
  );

  // ── 2. Score candidates ─────────────────────────────────────────────────
  const best = findBestCandidate(offData.product_name, candidates);

  if (best !== null) {
    console.log(
      `[INTERCEPTOR] Best match: "${best.doc.product_name}" — score ${best.score}`
    );
  }

  // ── 3a. Confident match — upsert the existing seeded document ───────────
  if (best !== null && best.score >= FUZZY_MATCH_THRESHOLD) {
    console.log(
      `[INTERCEPTOR] MERGE: score ${best.score} >= ${FUZZY_MATCH_THRESHOLD}. ` +
        `Replacing barcode "${best.doc.barcode}" → "${offData.barcode}"`
    );

    // findById returns the full Mongoose Document (not lean), so we can call .save()
    const existing = await Product.findById(best.doc._id);

    if (!existing) {
      // Edge case: document was deleted between the find and findById calls.
      // Fall through to a fresh insert below.
      console.warn(
        `[INTERCEPTOR] Candidate ${best.doc._id} disappeared — falling back to insert`
      );
    } else {
      // Swap the real barcode in (primary key change via findOneAndUpdate
      // to avoid Mongoose's restriction on modifying _id-adjacent unique fields
      // through a document save).
      const updated = await Product.findByIdAndUpdate(
        existing._id,
        {
          $set: {
            barcode: offData.barcode,
            // Only fill image_url if the seeded doc has none
            ...(existing.image_url === null && offData.image_url !== null
              ? { image_url: offData.image_url }
              : {}),
            // Retain seeded ingredients & nutrients — do NOT overwrite them.
            // Update metadata fields only.
            nutri_score: offData.nutri_score ?? existing.nutri_score,
            source: 'off' as const,
            updated_at: new Date(),
          },
        },
        {
          new: true,  // return the updated document
          runValidators: true,
        }
      ).exec();

      if (updated) {
        console.log(
          `[INTERCEPTOR] Merged "${updated.product_name}" (${updated.barcode}) successfully`
        );
        return updated;
      }
    }
  }

  // ── 3b. No confident match — insert as a new document ───────────────────
  console.log(
    `[INTERCEPTOR] INSERT: score ${best?.score ?? 'N/A'} < ${FUZZY_MATCH_THRESHOLD} ` +
      `(or no candidates). Inserting "${offData.product_name}" as new document.`
  );

  try {
    const newProduct = new Product({
      ...offData,
      created_at: new Date(),
      updated_at: new Date(),
    });
    await newProduct.save();

    console.log(
      `[INTERCEPTOR] Inserted "${newProduct.product_name}" (${newProduct.barcode})`
    );
    return newProduct;
  } catch (err: unknown) {
    // ── Concurrent duplicate-key guard ──────────────────────────────────
    // Two simultaneous requests for the same new barcode can both reach this
    // point after both cache-missing. The second one will hit a duplicate-key
    // error. Recover by loading and returning the already-saved document.
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: number }).code === MONGO_DUPLICATE_KEY_CODE
    ) {
      console.warn(
        `[INTERCEPTOR] Duplicate key on insert for "${offData.barcode}" — ` +
          `fetching the winner's document`
      );
      const existing = await Product.findOne({ barcode: offData.barcode }).exec();
      if (existing) return existing;
    }

    // Any other error — re-throw so the route returns a 500
    throw err;
  }
}
