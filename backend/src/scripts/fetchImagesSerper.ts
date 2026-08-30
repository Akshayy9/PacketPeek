/**
 * fetchImagesSerper.ts
 *
 * Backfill script: searches the Serper.dev Images API for every
 * product whose `image_url` is null / missing / empty, then writes the found
 * image URL back to MongoDB via updateOne.
 *
 * Usage (from the backend/ directory):
 *   npx ts-node -r dotenv/config src/scripts/fetchImagesSerper.ts
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { Product, IProduct } from '../models/Product';

dotenv.config();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/packetpeek_db';
const SERPER_API_KEY = process.env.SERPER_API_KEY || 'REPLACE_ME_OR_PUT_IN_ENV';

/** Fast delay since Serper handles concurrency well */
const DELAY_MS = 250;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SerperImage {
  title: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  thumbnailUrl: string;
  thumbnailWidth: number;
  thumbnailHeight: number;
  source: string;
  domain: string;
  link: string;
}

interface SerperResponse {
  searchParameters: {
    q: string;
    type: string;
    engine: string;
  };
  images?: SerperImage[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function fetchSerperImageUrl(query: string): Promise<string | null> {
  const url = 'https://google.serper.dev/images';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-API-KEY': SERPER_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      q: query,
      gl: 'in'
    })
  });

  if (!response.ok) {
    throw new Error(`Serper API returned HTTP ${response.status} for query: "${query}"`);
  }

  const data = (await response.json()) as SerperResponse;

  if (data.images && data.images.length > 0) {
    return data.images[0].imageUrl;
  }

  return null;
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

    if (SERPER_API_KEY === 'REPLACE_ME_OR_PUT_IN_ENV') {
       console.warn('⚠️  Warning: SERPER_API_KEY is not configured! Requests will likely fail with 403/401.\n');
    }

    // Counters
    let savedCount = 0;
    let noMatchCount = 0;
    let errorCount = 0;

    const CHUNK_SIZE = 10;
    for (let i = 0; i < products.length; i += CHUNK_SIZE) {
      const chunk = products.slice(i, i + CHUNK_SIZE);
      
      await Promise.all(chunk.map(async (product, index) => {
        const position = `[${i + index + 1}/${total}]`;
        const label = `${product.brand ?? 'Unknown'} ${product.product_name}`;
  
        const safeBrand = product.brand ? `${product.brand} ` : '';
        const searchQuery = `${safeBrand}${product.product_name} grocery packet front India high resolution`.trim();
  
        try {
          const imageUrl = await fetchSerperImageUrl(searchQuery);
  
          if (imageUrl) {
            await Product.updateOne(
              { _id: product._id },
              { $set: { image_url: imageUrl, updated_at: new Date() } }
            );
            savedCount++;
            console.log(`${position} ✅ Saved Google Image for ${label}`);
            console.log(`          -> ${imageUrl}`);
          } else {
            noMatchCount++;
            console.log(`${position} ❌ No images found in Serper for ${label}`);
          }
        } catch (err: unknown) {
          errorCount++;
          const message = err instanceof Error ? err.message : String(err);
          console.error(`${position} ⚠️  Error for ${label}: ${message}`);
        }
      }));
      
      if (i + CHUNK_SIZE < products.length) {
        await delay(DELAY_MS);
      }
    }

    console.log('\n════════════════════════════════════════════════');
    console.log('       SERPER IMAGE BACKFILL — SUMMARY          ');
    console.log('════════════════════════════════════════════════');
    console.log(`Total Queued         : ${total}`);
    console.log(`✅ Images Saved      : ${savedCount}`);
    console.log(`❌ No Match in Serper: ${noMatchCount}`);
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
