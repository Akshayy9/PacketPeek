import fs from 'fs';
import zlib from 'zlib';
import readline from 'readline';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Product } from '../models/Product';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const BATCH_SIZE = 500;
const MAX_PRODUCTS = 5000;
// We use the corrected path from our previous debugging to find the file in the root scripts folder
const FILE_PATH = path.join(__dirname, '../../../scripts/openfoodfacts-products.jsonl.gz');

function escapeRegex(text: string) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

async function processBatch(batch: any[]) {
  if (batch.length === 0) return 0;

  const batchNames = batch.map((item) => new RegExp('^' + escapeRegex(item.product_name) + '$', 'i'));

  const manualMatches = await Product.find({
    data_source: 'MANUAL',
    $or: [{ barcode: null }, { barcode: { $exists: false } }],
    product_name: { $in: batchNames },
  }).lean();

  const manualNameMap = new Map();
  for (const match of manualMatches) {
    manualNameMap.set(match.product_name.toLowerCase(), match._id);
  }

  const operations = batch.map((item) => {
    const manualId = manualNameMap.get(item.product_name.toLowerCase());

    const updateDoc = {
      $set: {
        barcode: item.barcode,
        data_source: 'OFF_SEED',
        product_name: item.product_name,
        brand: item.brand,
        image_url: item.image_url,
        ingredients_text: item.ingredients_text,
        nutrients_per_100g: item.nutrients_per_100g,
        serving_size: item.serving_size,
        serving_quantity: item.serving_quantity,
        nutrients_per_serving: item.nutrients_per_serving,
        nova_group: item.nova_group,
        vegetarian_status: item.vegetarian_status,
        allergens_tags: item.allergens_tags,
        source: 'off',
        updated_at: new Date(),
      },
    };

    if (manualId) {
      return {
        updateOne: {
          filter: { _id: manualId },
          update: updateDoc,
        },
      };
    } else {
      return {
        updateOne: {
          filter: { barcode: item.barcode },
          update: updateDoc,
          upsert: true,
        },
      };
    }
  });

  if (operations.length > 0) {
    await Product.bulkWrite(operations as any, { ordered: false });
  }

  return operations.length;
}

async function run() {
  let totalSaved = 0;
  let batch: any[] = [];
  
  // Heartbeat counters
  let linesScanned = 0;
  let trashedInWindow = 0;
  let keptInWindow = 0;

  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) throw new Error('MONGODB_URI is not defined.');

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected.');

    if (!fs.existsSync(FILE_PATH)) {
      throw new Error(`File not found at ${FILE_PATH}`);
    }

    const readStream = fs.createReadStream(FILE_PATH);
    const gunzip = zlib.createGunzip();
    const rl = readline.createInterface({
      input: readStream.pipe(gunzip),
      crlfDelay: Infinity,
    });

    console.log('Starting streaming extraction...');

    for await (const line of rl) {
      linesScanned++;
      
      if (totalSaved >= MAX_PRODUCTS) {
        rl.close();
        break;
      }

      try {
        const product = JSON.parse(line);

        // 1. India Filter
        const isIndia = product.countries_tags?.includes('en:india') || product.code?.startsWith('890');
        
        // 2. Relaxed Completeness Filter (only require code and product_name)
        if (!isIndia || !product.code || !product.product_name) {
          trashedInWindow++;
        } else {
          keptInWindow++;
          
          // 3. Vegetarian Status Parsing
          const tags = product.ingredients_analysis_tags || [];
          let vegetarian_status = 'unknown';
          if (tags.includes('en:vegetarian')) vegetarian_status = 'veg';
          else if (tags.includes('en:non-vegetarian')) vegetarian_status = 'non-veg';

          // 4. Allergens Parsing
          let allergens_tags = product.allergens_tags || [];
          allergens_tags = allergens_tags.map((tag: string) => tag.replace(/^en:/, ''));

          // 5. Safely handle macros (allowing nulls)
          const n = product.nutriments || {};

          const item = {
            barcode: product.code,
            product_name: product.product_name,
            brand: product.brands || null,
            image_url: product.image_url || null,
            ingredients_text: product.ingredients_text || null,
            serving_size: product.serving_size || null,
            serving_quantity: product.serving_quantity ? Number(product.serving_quantity) : null,
            nova_group: [1, 2, 3, 4].includes(product.nova_group) ? product.nova_group : null,
            vegetarian_status,
            allergens_tags,
            nutrients_per_100g: {
              energy_kcal: Number(n['energy-kcal']) || null,
              sugar_g: Number(n.sugars) || null,
              protein_g: Number(n.proteins) || null,
              fat_g: Number(n.fat) || null,
              saturated_fat_g: Number(n['saturated-fat']) || null,
              fibre_g: Number(n.fiber) || null,
              sodium_mg: Number(n.sodium) || null,
            },
            nutrients_per_serving: null,
          };

          // If serving size is available, map per serving macros
          if (item.serving_size && item.serving_quantity) {
            item.nutrients_per_serving = {
              energy_kcal: Number(n['energy-kcal_serving']) || null,
              sugar_g: Number(n.sugars_serving) || null,
              protein_g: Number(n.proteins_serving) || null,
              fat_g: Number(n.fat_serving) || null,
              saturated_fat_g: Number(n['saturated-fat_serving']) || null,
              fibre_g: Number(n.fiber_serving) || null,
              sodium_mg: Number(n.sodium_serving) || null,
            } as any;
          }

          batch.push(item);

          if (batch.length >= BATCH_SIZE) {
            const saved = await processBatch(batch);
            totalSaved += saved;
            batch = []; // Reset batch
          }
        }

        // Heartbeat Logging
        if (linesScanned % 50000 === 0) {
          console.log(`\n--- HEARTBEAT ---`);
          console.log(`Scanned ${linesScanned.toLocaleString()} lines total.`);
          console.log(`In the last 50k lines: Added ${keptInWindow}, Trashed ${trashedInWindow}.`);
          console.log(`Total saved to DB so far: ${totalSaved} / ${MAX_PRODUCTS}`);
          console.log(`-----------------\n`);
          
          trashedInWindow = 0;
          keptInWindow = 0;
        }

      } catch (e) {
        // Skip malformed JSON lines
        trashedInWindow++;
        continue;
      }
    }

    // Process final remaining batch
    if (batch.length > 0 && totalSaved < MAX_PRODUCTS) {
      const remainingSpace = MAX_PRODUCTS - totalSaved;
      const finalBatch = batch.slice(0, remainingSpace);
      const saved = await processBatch(finalBatch);
      totalSaved += saved;
      console.log(`Processed final batch. Total saved/updated: ${totalSaved}`);
    }

    console.log('Streaming complete.');

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    console.log('Disconnecting Mongoose...');
    await mongoose.disconnect();
    console.log('Done.');
    process.exit(0);
  }
}

run();
