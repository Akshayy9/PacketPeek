/**
 * calculateScores.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Batch script that auto-discovers every distinct category in the DB and
 * scores each one sequentially, printing a summary after every category.
 *
 * Usage:
 *   npx ts-node src/scripts/calculateScores.ts
 *
 * Configuration:
 *   - Adjust BATCH_SIZE and CONCURRENCY for your hardware / network.
 *   - Products with a null category are processed last under "(no category)".
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { Product, IProduct } from '../models/Product';
import { analyzeIngredients, calculateNutriScore, NutriScoreLetter } from '../services/scoringEngine';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/** How many documents to fetch from MongoDB per cursor page. */
const BATCH_SIZE = 100;

/** Max concurrent bulkWrite update operations in flight at once. */
const CONCURRENCY = 10;

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/packetpeek_db';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface BulkOp {
  updateOne: {
    filter: { _id: mongoose.Types.ObjectId };
    update: {
      $set: {
        nutri_score: NutriScoreLetter | null;
        flagged_additives: string[];
        updated_at: Date;
      };
    };
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Process a single product document into a bulkWrite operation object.
 * Pure function — safe to run concurrently.
 */
function buildBulkOp(product: IProduct): BulkOp {
  const nutri_score = calculateNutriScore(
    product.nutrients_per_100g,
    product.category
  );

  const flagged_additives = analyzeIngredients(
    product.ingredients_list ?? product.ingredients_text
  );

  return {
    updateOne: {
      filter: { _id: product._id as mongoose.Types.ObjectId },
      update: {
        $set: {
          nutri_score,
          flagged_additives,
          updated_at: new Date(),
        },
      },
    },
  };
}

/**
 * Run an array of async tasks with at most `concurrency` running at once.
 */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const current = index++;
      results[current] = await tasks[current]();
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Category processor
// ─────────────────────────────────────────────────────────────────────────────

interface CategoryResult {
  category: string;
  processed: number;
  updated: number;
  failed: number;
}

/**
 * Scores all products belonging to a single category and returns the counts.
 */
async function scoreCategory(category: string | null): Promise<CategoryResult> {
  const label = category ?? '(no category)';
  const filter: mongoose.FilterQuery<IProduct> =
    category === null
      ? { category: null }
      : { category: { $regex: new RegExp(`^${category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } };

  const total = await Product.countDocuments(filter);
  console.log(`\n┌─ 📂 ${label} (${total} products)`);

  let processed = 0;
  let updated = 0;
  let failed = 0;
  let page = 0;

  while (true) {
    const products = await Product.find(filter)
      .skip(page * BATCH_SIZE)
      .limit(BATCH_SIZE)
      .lean<IProduct[]>()
      .exec();

    if (products.length === 0) break;

    const ops: BulkOp[] = products.map((p) => buildBulkOp(p));

    const chunkSize = Math.max(1, Math.ceil(ops.length / CONCURRENCY));
    const chunks: BulkOp[][] = [];
    for (let i = 0; i < ops.length; i += chunkSize) {
      chunks.push(ops.slice(i, i + chunkSize));
    }

    const tasks = chunks.map(
      (chunk) => async () => {
        try {
          const result = await Product.bulkWrite(chunk, { ordered: false });
          return result.modifiedCount;
        } catch (err) {
          console.error(`  ❌ bulkWrite error in "${label}":`, err);
          return 0;
        }
      }
    );

    const modifiedCounts = await runWithConcurrency(tasks, CONCURRENCY);
    const pageUpdated = modifiedCounts.reduce((a, b) => a + b, 0);
    const pageFailed  = products.length - pageUpdated;

    processed += products.length;
    updated   += pageUpdated;
    failed    += pageFailed;

    page++;
    if (products.length < BATCH_SIZE) break;
  }

  const status = failed === 0 ? '✅' : '⚠️ ';
  console.log(
    `└─ ${status} Done — processed: ${processed} | updated: ${updated} | failed: ${failed}`
  );

  return { category: label, processed, updated, failed };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB.');

  // 1. Discover all distinct non-null categories in the collection
  const distinctCategories = (await Product.distinct('category')) as Array<string | null>;

  // Separate real categories from null, sort alphabetically, append null last
  const categories: Array<string | null> = [
    ...distinctCategories.filter((c): c is string => c !== null && c !== '').sort(),
    ...(distinctCategories.includes(null) ? [null] : []),
  ];

  console.log(`\n📋 Found ${categories.length} categories to process:`);
  categories.forEach((c, i) => console.log(`   ${i + 1}. ${c ?? '(no category)'}`) );

  // 2. Score each category sequentially
  const results: CategoryResult[] = [];
  for (const category of categories) {
    const result = await scoreCategory(category);
    results.push(result);
  }

  // 3. Grand-total summary
  const grandProcessed = results.reduce((s, r) => s + r.processed, 0);
  const grandUpdated   = results.reduce((s, r) => s + r.updated,   0);
  const grandFailed    = results.reduce((s, r) => s + r.failed,    0);

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║        FULL SCORING RUN COMPLETE             ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Categories processed : ${String(categories.length).padEnd(19)}║`);
  console.log(`║  Total Processed      : ${String(grandProcessed).padEnd(19)}║`);
  console.log(`║  ✅ Total Updated     : ${String(grandUpdated).padEnd(19)}║`);
  console.log(`║  ❌ Total Failed      : ${String(grandFailed).padEnd(19)}║`);
  console.log('╚══════════════════════════════════════════════╝\n');

  // Per-category breakdown table
  console.log('Per-category breakdown:');
  console.log('─'.repeat(62));
  console.log('Category'.padEnd(28) + 'Processed'.padEnd(12) + 'Updated'.padEnd(12) + 'Failed');
  console.log('─'.repeat(62));
  for (const r of results) {
    const flag = r.failed > 0 ? ' ⚠️' : ' ✅';
    console.log(
      r.category.padEnd(28) +
      String(r.processed).padEnd(12) +
      String(r.updated).padEnd(12) +
      String(r.failed) + flag
    );
  }
  console.log('─'.repeat(62));

  await mongoose.disconnect();
  console.log('\nDisconnected from MongoDB.');
}

main().catch((err) => {
  console.error('Fatal script error:', err);
  process.exit(1);
});
