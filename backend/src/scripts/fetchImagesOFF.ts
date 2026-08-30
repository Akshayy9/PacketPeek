/**
 * fetchImagesOFF.ts
 *
 * Backfill script: searches the Open Food Facts (OFF) v2 Search API for every
 * product whose `image_url` is null / missing / empty, then writes the found
 * image URL back to MongoDB via updateOne.
 *
 * Usage (from the backend/ directory):
 *   npx ts-node -r dotenv/config src/scripts/fetchImagesOFF.ts
 *
 * No extra npm packages are required — native `fetch` (Node 18+) is used.
 *
 * Required env variable:
 *   MONGODB_URI  — connection string (loaded from backend/.env)
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { Product, IProduct } from '../models/Product';

dotenv.config();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/packetpeek_db';

/** Pause between every OFF API request. Increased to 2000ms for rate limiting. */
const DELAY_MS = 2000;

/** OFF rejects requests without a meaningful User-Agent. */
const USER_AGENT = 'PacketPeekApp - Node.js Data Migration Script';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of a single product object returned by the OFF v2 Search API. */
interface OFFProduct {
  brands?: string;
  image_front_url?: string;
  image_url?: string;
}

/** Top-level shape of the OFF v2 Search API response. */
interface OFFSearchResponse {
  count: number;
  page: number;
  page_size: number;
  products: OFFProduct[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Promisified setTimeout. */
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sanitizes the product name to keep searches broad but accurate.
 */
function sanitizeQuery(brand: string, name: string): string {
  let cleanedName = name.trim();
  const lowerBrand = brand.toLowerCase().trim();
  
  // Remove brand if it appears at the very beginning of the product name
  if (lowerBrand && cleanedName.toLowerCase().startsWith(lowerBrand)) {
    cleanedName = cleanedName.substring(lowerBrand.length).trim();
  }
  
  // Strip out generic fluff words
  const fluffWords = ['biscuit', 'biscuits', 'cookie', 'cookies', 'premium', 'sugar free', 'sugar-free'];
  let words = cleanedName.split(/\s+/);
  words = words.filter(word => !fluffWords.includes(word.toLowerCase()));
  
  // Return ONLY the first 3 words of the remaining cleaned string
  return words.slice(0, 3).join(' ');
}

/**
 * Query the OFF v2 Search API and return the best image URL found,
 * or null if nothing useful comes back.
 *
 * Includes retry logic for 503 and 429 HTTP statuses.
 */
async function fetchOFFImageUrl(query: string, localBrand: string | null): Promise<string | null> {
  const encodedQuery = encodeURIComponent(query);
  const url =
    `https://world.openfoodfacts.org/api/v2/search` +
    `?search_terms=${encodedQuery}` +
    `&countries_tags_en=india` +
    `&fields=brands,image_front_url,image_url` +
    `&page_size=1`;

  const MAX_RETRIES = 3;
  let attempts = 0;
  let response: Response | null = null;

  while (attempts < MAX_RETRIES) {
    attempts++;
    response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    
    if (response.ok) {
      break;
    }

    if (response.status === 503 || response.status === 429) {
      if (attempts < MAX_RETRIES) {
        console.warn(`          -> Warning: HTTP ${response.status}. Retrying in 5s... (Attempt ${attempts}/${MAX_RETRIES})`);
        await delay(5000);
        continue;
      }
    }
    
    // If not a retryable status or max retries exceeded, throw
    throw new Error(`OFF API returned HTTP ${response.status} for query: "${query}"`);
  }

  if (!response) return null;

  // Let JSON parse errors bubble up to the caller
  const data = (await response.json()) as OFFSearchResponse;

  // Extraction: prefer image_front_url, fall back to image_url
  const firstProduct: OFFProduct | undefined = data.products?.[0];
  if (!firstProduct) return null;

  // Strict Brand Validation
  if (localBrand) {
    const offBrandStr = firstProduct.brands || "";
    const localBrandStr = localBrand.toLowerCase();
    const offBrandLower = offBrandStr.toLowerCase();

    if (!offBrandStr || (!offBrandLower.includes(localBrandStr) && !localBrandStr.includes(offBrandLower))) {
      console.log(`          -> Skipped: Brand mismatch (OFF: "${offBrandStr}", Local: "${localBrand}")`);
      return null;
    }
  }

  return firstProduct.image_front_url || firstProduct.image_url || null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function runImageBackfill(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB.\n');

    // 1. Fetch only products that are missing an image
    const products = await Product.find({
      $or: [
        { image_url: null },
        { image_url: { $exists: false } },
        { image_url: '' },
      ],
    }).lean<IProduct[]>();

    const total = products.length;
    console.log(`🔍 Found ${total} product(s) with no image URL.\n`);

    if (total === 0) {
      console.log('Nothing to do. Exiting.');
      return;
    }

    // Counters
    let savedCount    = 0;
    let noMatchCount  = 0;
    let errorCount    = 0;

    for (let i = 0; i < products.length; i++) {
      const product  = products[i];
      const position = `[${i + 1}/${total}]`;
      const label    = `${product.brand ?? 'Unknown'} ${product.product_name}`;

      // 3. Search query — sanitize name and combine with brand
      const safeBrand = product.brand ?? '';
      const sanitizedName = sanitizeQuery(safeBrand, product.product_name);
      const searchQuery = `${safeBrand} ${sanitizedName}`.trim();

      try {
        // 7. Fetch — errors (500, 503, JSON parse) are caught below
        const imageUrl = await fetchOFFImageUrl(searchQuery, product.brand);

        if (imageUrl) {
          // 6. Update via updateOne — no need to hydrate the full Mongoose doc
          await Product.updateOne(
            { _id: product._id },
            { $set: { image_url: imageUrl, updated_at: new Date() } }
          );
          savedCount++;
          console.log(`${position} ✅ Saved URL for ${label}`);
          console.log(`          -> ${imageUrl}`);
        } else {
          noMatchCount++;
          console.log(`${position} ❌ No match found in OFF for ${label}`);
        }
      } catch (err: unknown) {
        // Anti-crash: log and move on — never let one bad product kill the run
        errorCount++;
        const message = err instanceof Error ? err.message : String(err);
        console.error(`${position} ⚠️  Error for ${label}: ${message}`);
      }

      // Throttle — always wait, even after errors, to be polite to OFF
      if (i < products.length - 1) {
        await delay(DELAY_MS);
      }
    }

    // Final summary
    console.log('\n════════════════════════════════════════════════');
    console.log('        OFF IMAGE BACKFILL — SUMMARY            ');
    console.log('════════════════════════════════════════════════');
    console.log(`Total Queued         : ${total}`);
    console.log(`✅ Images Saved      : ${savedCount}`);
    console.log(`❌ No Match in OFF   : ${noMatchCount}`);
    console.log(`⚠️  Fetch/Parse Errors: ${errorCount}`);
    console.log('════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('💥 Fatal script error:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
  }
}

runImageBackfill();
