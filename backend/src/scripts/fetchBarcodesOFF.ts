/**
 * fetchBarcodesOFF.ts
 *
 * Backfill script: searches Open Food Facts for missing barcodes.
 * 
 * Usage:
 *   npx ts-node -r dotenv/config src/scripts/fetchBarcodesOFF.ts
 *   npx ts-node -r dotenv/config src/scripts/fetchBarcodesOFF.ts --limit=10
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { Product, IProduct } from '../models/Product';

dotenv.config();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/packetpeek_db';
const DELAY_MS = 1500;
const USER_AGENT = 'PacketPeekApp - Node.js Data Migration Script';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const parseArgs = () => {
  const args = process.argv.slice(2);
  let limit = 0; // 0 means no limit
  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1], 10);
    }
  }
  return { limit };
};

/**
 * Strict flavor and product matching.
 * Checks brand, and prevents conflicting flavor keywords.
 */
function isStrictMatch(localBrand: string, localName: string, offBrand: string, offName: string): boolean {
  const lb = localBrand.toLowerCase();
  const ln = localName.toLowerCase();
  const ob = offBrand ? offBrand.toLowerCase() : '';
  const on = offName ? offName.toLowerCase() : '';

  // 1. Brand match
  if (ob && !on.includes(lb) && !ob.includes(lb) && !lb.includes(ob)) {
    return false;
  }

  // 2. Conflicting flavor keywords check
  const flavorKeywords = [
    'choco', 'chocolate', 'vanilla', 'strawberry', 'orange', 'pista', 'badam', 
    'cashew', 'almond', 'mango', 'pineapple', 'elaichi', 'cardamom', 'butter', 
    'jeera', 'coffee', 'oats', 'multigrain', 'coconut', 'milk', 'dark'
  ];

  const localFlavors = flavorKeywords.filter(f => ln.includes(f));
  const offFlavors = flavorKeywords.filter(f => on.includes(f));

  // Reject if OFF product has a flavor keyword that our local product does NOT have
  for (const flavor of offFlavors) {
    if (!localFlavors.includes(flavor)) {
      return false; // Conflicting flavor found!
    }
  }

  return true;
}

async function fetchBarcodeOFF(query: string, localBrand: string, localName: string): Promise<string | null> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodedQuery}&search_simple=1&action=process&json=1`;

  let response: Response | null = null;
  let attempts = 0;
  const MAX_RETRIES = 3;

  while (attempts < MAX_RETRIES) {
    attempts++;
    response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    
    if (response.ok) break;

    if (response.status === 503 || response.status === 429) {
      if (attempts < MAX_RETRIES) {
        console.warn(`          -> Warning: HTTP ${response.status}. Retrying in 5s... (Attempt ${attempts}/${MAX_RETRIES})`);
        await delay(5000);
        continue;
      }
    }
    throw new Error(`OFF API returned HTTP ${response.status} for query: "${query}"`);
  }

  if (!response) return null;

  const data = (await response.json()) as any;
  const products = data.products || [];

  for (const p of products) {
    const offBrand = p.brands || '';
    const offName = p.product_name || '';
    const code = p.code;

    if (code && isStrictMatch(localBrand, localName, offBrand, offName)) {
      return code;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function runBarcodeBackfill(): Promise<void> {
  try {
    const { limit } = parseArgs();
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB.\n');

    // 1. Fetch products missing a barcode (or having a manual one)
    let query = Product.find({
      $or: [
        { barcode: null },
        { barcode: { $exists: false } },
        { barcode: '' },
        { barcode: /^manual_/ }
      ]
    });

    if (limit > 0) {
      query = query.limit(limit);
      console.log(`⚠️  Running in DRY RUN/LIMIT mode. Max ${limit} products will be processed.\n`);
    }

    const products = await query.lean<IProduct[]>();
    const total = products.length;
    
    console.log(`🔍 Found ${total} product(s) needing a barcode.\n`);

    if (total === 0) {
      console.log('Nothing to do. Exiting.');
      return;
    }

    let savedCount = 0;
    let noMatchCount = 0;
    let errorCount = 0;

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const position = `[${i + 1}/${total}]`;
      const safeBrand = product.brand ?? '';
      const safeName = product.product_name ?? '';
      const label = `${safeBrand} ${safeName}`.trim();
      
      const searchQuery = label;

      try {
        const barcode = await fetchBarcodeOFF(searchQuery, safeBrand, safeName);

        if (barcode) {
          await Product.updateOne(
            { _id: product._id },
            { $set: { barcode: barcode, updated_at: new Date() } }
          );
          savedCount++;
          console.log(`${position} ✅ Saved barcode for ${label}`);
          console.log(`          -> ${barcode}`);
        } else {
          noMatchCount++;
          console.log(`${position} ❌ No strict match found in OFF for ${label}`);
        }
      } catch (err: unknown) {
        errorCount++;
        const message = err instanceof Error ? err.message : String(err);
        console.error(`${position} ⚠️  Error for ${label}: ${message}`);
      }

      if (i < products.length - 1) {
        await delay(DELAY_MS);
      }
    }

    console.log('\n════════════════════════════════════════════════');
    console.log('       OFF BARCODE BACKFILL — SUMMARY           ');
    console.log('════════════════════════════════════════════════');
    console.log(`Total Queued         : ${total}`);
    console.log(`✅ Barcodes Saved    : ${savedCount}`);
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

runBarcodeBackfill();
