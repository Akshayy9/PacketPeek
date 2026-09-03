import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Product } from '../models/Product';

dotenv.config({ path: path.join(__dirname, '../../.env') });

function normalizeName(name: string): string {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function getQualityScore(product: any): number {
  let score = 0;
  if (product.ingredients_text && product.ingredients_text.trim().length > 0) {
    score += 10;
  }
  if (product.nutrients_per_100g && Object.keys(product.nutrients_per_100g).length > 0) {
    score += 10;
  }
  if (product.image_url && product.image_url.trim().length > 0) {
    score += 5;
  }
  return score;
}

function isManual(product: any): boolean {
  const isSrcManual = product.source && /^manual$/i.test(product.source);
  const isDataSrcManual = product.data_source && /^manual$/i.test(product.data_source);
  return !!(isSrcManual || isDataSrcManual);
}

function isValidBarcode(barcode: string): boolean {
  return typeof barcode === 'string' && /^\d{13}$/.test(barcode);
}

async function run() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in the environment variables.');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected.');

    const allProducts = await Product.find({}).lean();
    console.log(`Fetched ${allProducts.length} products.`);

    const groups: Record<string, any[]> = {};
    for (const p of allProducts) {
      const normName = normalizeName(p.product_name);
      if (!normName) continue;
      if (!groups[normName]) {
        groups[normName] = [];
      }
      groups[normName].push(p);
    }

    let reassignedCount = 0;
    const idsToDelete: mongoose.Types.ObjectId[] = [];

    for (const [normName, group] of Object.entries(groups)) {
      if (group.length <= 1) continue;

      // Sort by manual status first, then by quality score descending
      group.sort((a, b) => {
        const aMan = isManual(a) ? 1 : 0;
        const bMan = isManual(b) ? 1 : 0;
        if (aMan !== bMan) return bMan - aMan;
        return getQualityScore(b) - getQualityScore(a);
      });

      const keeper = group[0];
      const inferiors = group.slice(1);

      console.log(`\n🔍 Group: "${keeper.product_name}" (${group.length} duplicates)`);
      console.log(`   Keeper: [${keeper.barcode}] (Manual: ${isManual(keeper)}, Score: ${getQualityScore(keeper)})`);

      let bestBarcode: string | null = null;
      if (!isValidBarcode(keeper.barcode)) {
        // Look for a valid barcode in inferiors
        for (const inf of inferiors) {
          if (isValidBarcode(inf.barcode)) {
            bestBarcode = inf.barcode;
            break;
          }
        }
      }

      if (bestBarcode) {
        console.log(`   🔄 Transferring valid barcode ${bestBarcode} to Keeper...`);
        // We will update the keeper's barcode
        await Product.updateOne({ _id: keeper._id }, { $set: { barcode: bestBarcode } });
        reassignedCount++;
      }

      for (const inf of inferiors) {
        if (!isManual(inf)) {
          idsToDelete.push(inf._id);
          console.log(`   🗑️ Queuing deletion for inferior duplicate: [${inf.barcode}] Score: ${getQualityScore(inf)}`);
        } else {
          console.log(`   🛡️ Protecting manual duplicate: [${inf.barcode}] Score: ${getQualityScore(inf)}`);
        }
      }
    }

    if (idsToDelete.length > 0) {
      console.log(`\nExecuting Safe Deletion for ${idsToDelete.length} duplicates...`);
      const deleteResult = await Product.deleteMany({
        _id: { $in: idsToDelete },
        source: { $not: { $regex: /^manual$/i } },
        data_source: { $not: { $regex: /^manual$/i } }
      });
      console.log(`✅ Permanently deleted ${deleteResult.deletedCount} empty/inferior duplicates.`);
    } else {
      console.log('\nNo duplicates to delete.');
    }

    console.log(`\n🎉 Done! Barcodes reassigned: ${reassignedCount}`);

  } catch (err) {
    console.error('Fatal error:', err);
  } finally {
    console.log('Disconnecting...');
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
