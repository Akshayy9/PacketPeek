/**
 * migrateDataSource.ts
 *
 * Migration script to update all existing products that lack the `data_source`
 * field, setting it to the default value of 'MANUAL'.
 *
 * Usage:
 *   npx ts-node -r dotenv/config src/scripts/migrateDataSource.ts
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { Product } from '../models/Product';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/packetpeek_db';

async function runMigration() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB.');

    // Update all products that don't have the data_source field
    const result = await Product.updateMany(
      { data_source: { $exists: false } },
      { $set: { data_source: 'MANUAL', updated_at: new Date() } }
    );

    console.log(`✅ Migration complete! Successfully updated ${result.modifiedCount} product(s) to 'MANUAL'.`);

  } catch (err) {
    console.error('❌ Error during migration:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
  }
}

runMigration();
