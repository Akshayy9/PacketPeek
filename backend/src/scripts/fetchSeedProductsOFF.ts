/**
 * fetchSeedProductsOFF.ts
 *
 * Bulk-import script to seed 2,000 fully complete, popular Indian products
 * from Open Food Facts.
 *
 * Usage:
 *   npx ts-node -r dotenv/config src/scripts/fetchSeedProductsOFF.ts
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { Product } from '../models/Product';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/packetpeek_db';
const USER_AGENT = 'PacketPeek/1.0 (admin@packetpeek.com)';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runSeed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB.\n');

    let page = 11;
    let savedCount = 0;
    const TARGET_COUNT = 2000;

    while (savedCount < TARGET_COUNT) {
      console.log(`\n📄 Fetching page ${page}...`);
      
      const url = `https://world.openfoodfacts.org/api/v2/search?countries_tags_en=india&sort_by=unique_scans_n&fields=code,product_name,brands,ingredients_text,nutriments,nutriscore_grade,image_front_url,image_url&page_size=100&page=${page}`;
      
      let response: Response | null = null;
      let pageSuccess = false;
      let retries = 0;
      
      while (retries < 5) {
        try {
          response = await fetch(url, { 
            headers: { 
              'User-Agent': USER_AGENT,
              'Accept': 'application/json'
            } 
          });
          
          if (response.ok) {
            pageSuccess = true;
            break;
          }
          console.warn(`⚠️ HTTP ${response.status} from OFF. Retrying in 5s...`);
        } catch (err) {
          console.error('❌ Network error during fetch. Retrying in 5s...', err);
        }
        
        retries++;
        if (retries < 5) {
          await delay(5000);
        }
      }

      if (!pageSuccess || !response) {
        console.error(`🛑 Max retries reached (5) on page ${page}. Aborting script gracefully.`);
        break;
      }

      const data = (await response.json()) as any;
      const products = data.products || [];

      if (products.length === 0) {
        console.log('🛑 No more products returned from OFF. Stopping.');
        break;
      }

      let acceptedInPage = 0;
      let rejectedInPage = 0;

      for (const offProduct of products) {
        if (savedCount >= TARGET_COUNT) break;

        // 1. Strict Validation Filter
        const n = offProduct.nutriments;
        const hasCoreInfo = !!(offProduct.code && offProduct.product_name && offProduct.brands && offProduct.ingredients_text);
        const hasImage = !!(offProduct.image_front_url || offProduct.image_url);
        
        const hasNutriments = !!(
          n &&
          n['energy-kcal_100g'] !== undefined &&
          n.proteins_100g !== undefined &&
          n.fat_100g !== undefined &&
          n['saturated-fat_100g'] !== undefined &&
          n.sugars_100g !== undefined &&
          (n.sodium_100g !== undefined || n.salt_100g !== undefined)
        );

        if (!hasCoreInfo || !hasImage || !hasNutriments) {
          rejectedInPage++;
          continue;
        }

        // 2. Data Mapping
        const sodium_g = n.sodium_100g !== undefined ? n.sodium_100g : (n.salt_100g / 2.54);
        const sodium_mg = sodium_g !== null && !isNaN(sodium_g) ? Math.round(sodium_g * 1000) : null;
        
        const nutriScoreRaw = offProduct.nutriscore_grade;
        const validNutriScores = ['A', 'B', 'C', 'D', 'E'];
        const nutri_score = nutriScoreRaw && validNutriScores.includes(nutriScoreRaw.toUpperCase()) 
          ? nutriScoreRaw.toUpperCase() 
          : null;

        const mappedProduct = {
          barcode: offProduct.code,
          data_source: 'OFF_SEED',
          product_name: offProduct.product_name,
          brand: offProduct.brands,
          image_url: offProduct.image_front_url || offProduct.image_url,
          ingredients_text: offProduct.ingredients_text,
          nutri_score: nutri_score,
          source: 'off',
          nutrients_per_100g: {
            energy_kcal: n['energy-kcal_100g'],
            protein_g: n.proteins_100g,
            fat_g: n.fat_100g,
            saturated_fat_g: n['saturated-fat_100g'],
            sugar_g: n.sugars_100g,
            sodium_mg: sodium_mg,
            fibre_g: n.fiber_100g ?? n.fibre_100g ?? null,
          },
          updated_at: new Date()
        };

        // 3. Database Upsert
        try {
          await Product.updateOne(
            { barcode: offProduct.code },
            { $set: mappedProduct },
            { upsert: true }
          );
          savedCount++;
          acceptedInPage++;
        } catch (dbErr) {
          console.error(`❌ Failed to upsert product ${offProduct.code}:`, dbErr);
        }
      }

      console.log(`📊 Page ${page} Summary: Accepted: ${acceptedInPage} | Rejected: ${rejectedInPage} | Total Saved: ${savedCount}/${TARGET_COUNT}`);

      page++;
      // Throttling to prevent HTTP 503 and IP bans (7s delay = ~8 req/min)
      await delay(7000);
    }

    console.log(`\n🎉 Seed script finished! Total products saved: ${savedCount}`);

  } catch (err) {
    console.error('💥 Fatal script error:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
  }
}

runSeed();
