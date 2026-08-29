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

/** Pause between every OFF API request. 1 s is the sweet-spot: fast but safe. */
const DELAY_MS = 1000;

/** OFF rejects requests without a meaningful User-Agent. */
const USER_AGENT = 'PacketPeekApp - Node.js Data Migration Script';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of a single product object returned by the OFF v2 Search API. */
interface OFFProduct {
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
 * Query the OFF v2 Search API and return the best image URL found,
 * or null if nothing useful comes back.
 *
 * Throws on network-level errors so the caller's try/catch can handle them.
 */
async function fetchOFFImageUrl(query: string): Promise<string | null> {
  const encodedQuery = encodeURIComponent(query);
  const url =
    `https://world.openfoodfacts.org/api/v2/search` +
    `?search_terms=${encodedQuery}` +
    `&countries_tags_en=india` +
    `&fields=image_front_url,image_url` +
    `&page_size=1`;

  // 4. Mandatory User-Agent header — OFF blocks requests without one
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`OFF API returned HTTP ${response.status} for query: "${query}"`);
  }

  // Let JSON parse errors bubble up to the caller
  const data = (await response.json()) as OFFSearchResponse;

  // 5. Extraction: prefer image_front_url, fall back to image_url
  const firstProduct: OFFProduct | undefined = data.products?.[0];
  if (!firstProduct) return null;

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

      // 3. Search query — brand + product_name
      const searchQuery = `${product.brand} ${product.product_name}`;

      try {
        // 7. Fetch — errors (500, 503, JSON parse) are caught below
        const imageUrl = await fetchOFFImageUrl(searchQuery);

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
        // 7. Anti-crash: log and move on — never let one bad product kill the run
        errorCount++;
        const message = err instanceof Error ? err.message : String(err);
        console.error(`${position} ⚠️  Error for ${label}: ${message}`);
      }

      // 7. Throttle — always wait 1 s, even after errors, to be polite to OFF
      if (i < products.length - 1) {
        await delay(DELAY_MS);
      }
    }

    // 8. Final summary
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
