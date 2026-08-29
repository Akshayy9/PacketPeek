/**
 * fetchImagesDDG.ts
 *
 * Backfill script: fetches the top DuckDuckGo image result for every product
 * whose `image_url` is null, missing, or an empty string, and writes the URL
 * back to MongoDB.
 *
 * Usage:
 *   npx ts-node -r dotenv/config src/scripts/fetchImagesDDG.ts
 *
 * Required env variable:
 *   MONGODB_URI  — MongoDB connection string (loaded from backend/.env)
 */

import mongoose from 'mongoose';
import { searchImages, SafeSearchType } from 'duck-duck-scrape';
import * as dotenv from 'dotenv';
import { Product, IProduct } from '../models/Product';

dotenv.config();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/packetpeek_db';

/** Minimum delay between DDG requests (ms). Keep >= 2500 to avoid rate-limits. */
const THROTTLE_MS = 2500;

/** Extra back-off when a request fails before retrying (ms). */
const RETRY_DELAY_MS = 8000;

/** Maximum attempts per product before counting it as a failure. */
const MAX_RETRIES = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Promisified setTimeout. */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Attempt to fetch the first image URL from DuckDuckGo for a given query.
 * Returns `null` if nothing was found or every attempt failed.
 */
async function fetchFirstImageUrl(query: string): Promise<string | null> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const results = await searchImages(query, {
        safeSearch: SafeSearchType.OFF,
      });

      if (results && results.results && results.results.length > 0) {
        const imageUrl = results.results[0].image;
        return imageUrl ?? null;
      }

      // DDG returned zero results — no point retrying
      return null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `  ⚠️  Attempt ${attempt}/${MAX_RETRIES} failed: ${message}`
      );

      if (attempt < MAX_RETRIES) {
        console.log(`  ⏳ Backing off for ${RETRY_DELAY_MS / 1000}s...`);
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function runImageBackfill(): Promise<void> {
  try {
    // 1. Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB.\n');

    // 2. Fetch only products that need an image
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

    // 3. Counters for the final summary
    let successCount = 0;
    let failCount = 0;
    let noResultCount = 0;

    // 4. Sequential loop — NO concurrency
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const position = `[${i + 1}/${total}]`;
      const label = `${product.brand ?? 'Unknown Brand'} — ${product.product_name}`;

      // Construct the exact search query as specified
      const searchQuery = `${product.brand} ${product.product_name} packet front India`;

      console.log(`\n${position} Searching: "${searchQuery}"`);

      // 5. Grab the first image URL
      const imageUrl = await fetchFirstImageUrl(searchQuery);

      if (imageUrl) {
        // 6. Update the document using updateOne
        await Product.updateOne(
          { _id: product._id },
          {
            $set: {
              image_url: imageUrl,
              updated_at: new Date(),
            },
          }
        );
        successCount++;
        console.log(`  ✅ ${position} Found image for ${label}`);
        console.log(`     → ${imageUrl}`);
      } else {
        noResultCount++;
        failCount++;
        console.log(`  ❌ ${position} No image found for ${label}`);
      }

      // 7. Throttle — always sleep before the next iteration
      if (i < products.length - 1) {
        await sleep(THROTTLE_MS);
      }
    }

    // 8. Final summary
    console.log('\n════════════════════════════════════════════');
    console.log('        IMAGE BACKFILL — SUMMARY            ');
    console.log('════════════════════════════════════════════');
    console.log(`Total Queued       : ${total}`);
    console.log(`✅ Images Found    : ${successCount}`);
    console.log(`❌ No Result/Error : ${failCount}`);
    console.log('════════════════════════════════════════════\n');
  } catch (error) {
    console.error('💥 Fatal script error:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
  }
}

runImageBackfill();
