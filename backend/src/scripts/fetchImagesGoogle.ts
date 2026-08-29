/**
 * fetchImagesGoogle.ts
 *
 * Backfill script: fetches the top Google image result for every product
 * whose `image_url` is null, missing, or an empty string, then writes it
 * back to MongoDB via updateOne.
 *
 * Usage:
 *   npx ts-node -r dotenv/config src/scripts/fetchImagesGoogle.ts
 *
 * Required env variable:
 *   MONGODB_URI  - MongoDB connection string (loaded from backend/.env)
 *
 * Required package (install once):
 *   npm install googlethis
 *
 * NOTE: The npm package is `googlethis` (no hyphen). The name `google-this`
 *       does not exist in the npm registry.
 */

import mongoose from 'mongoose';
import * as google from 'googlethis';
import * as dotenv from 'dotenv';
import { Product, IProduct } from '../models/Product';

dotenv.config();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/packetpeek_db';

/** Pause between every Google request (ms). Keep >= 3000 to avoid IP blocks. */
const THROTTLE_MS = 3000;

/** Pause after a per-product error before moving to the next (ms). */
const ERROR_PAUSE_MS = 3000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Promisified setTimeout. */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function runImageBackfill(): Promise<void> {
  try {
    // 1. Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB.\n');

    // 2. Fetch only products that are missing an image
    const products = await Product.find({
      $or: [
        { image_url: null },
        { image_url: { $exists: false } },
        { image_url: '' },
      ],
    }).lean<IProduct[]>();

    const total = products.length;
    console.log(`Found ${total} product(s) with no image URL.\n`);

    if (total === 0) {
      console.log('Nothing to do. Exiting.');
      return;
    }

    // Counters for the final summary
    let successCount = 0;
    let noResultCount = 0;
    let errorCount = 0;

    // 4. Sequential loop - NO concurrency
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const position = `[${i + 1}/${total}]`;
      const label = `${product.brand ?? 'Unknown Brand'} - ${product.product_name}`;

      // 3. Construct the exact search query as specified
      const searchQuery = `${product.brand} ${product.product_name} packet front India`;

      console.log(`\n${position} Searching: "${searchQuery}"`);

      try {
        // 5. Fetch images via google.image()
        //    Returns: Array<{ id, url, width, height, color, preview, origin }>
        const imageResults = await google.image(searchQuery, { safe: false });

        // Extract the `url` from the very first result
        const imageUrl: string | undefined = imageResults?.[0]?.url;

        if (imageUrl) {
          // 6. Persist to MongoDB using updateOne
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
          console.log(`  Found image for ${label}`);
          console.log(`     -> ${imageUrl}`);
        } else {
          noResultCount++;
          console.log(`  No image results returned for ${label}`);
        }
      } catch (err: unknown) {
        // 8. Per-product fallback: log, pause, continue - do NOT crash the script
        errorCount++;
        const message = err instanceof Error ? err.message : String(err);
        console.error(`  Error fetching image for ${label}: ${message}`);
        console.log(`  Waiting ${ERROR_PAUSE_MS / 1000}s before next product...`);
        await sleep(ERROR_PAUSE_MS);
        // Already waited - skip the standard throttle below
        continue;
      }

      // 7. Throttle - pause before the next request to avoid Google blocks
      if (i < products.length - 1) {
        await sleep(THROTTLE_MS);
      }
    }

    // Final summary
    console.log('\n============================================');
    console.log('        IMAGE BACKFILL - SUMMARY            ');
    console.log('============================================');
    console.log(`Total Queued       : ${total}`);
    console.log(`Images Saved    : ${successCount}`);
    console.log(`No Results      : ${noResultCount}`);
    console.log(`Fetch Errors    : ${errorCount}`);
    console.log('============================================\n');
  } catch (error) {
    console.error('Fatal script error:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

runImageBackfill();
