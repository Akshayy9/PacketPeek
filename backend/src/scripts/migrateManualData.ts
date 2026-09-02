import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Product } from '../models/Product';
import path from 'path';

// Load environment variables from the root backend directory
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function migrateManualData() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in the environment variables.');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Successfully connected to MongoDB.');

    console.log("Updating products with data_source: 'MANUAL'...");
    const result = await Product.updateMany(
      { data_source: 'MANUAL' },
      {
        $set: {
          serving_size: null,
          serving_quantity: null,
          nutrients_per_serving: null,
          nova_group: null,
          vegetarian_status: 'unknown',
          allergens_tags: [],
        }
      }
    );

    console.log(`Migration completed successfully!`);
    console.log(`Matched documents: ${result.matchedCount}`);
    console.log(`Modified documents: ${result.modifiedCount}`);
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    console.log('Disconnecting from MongoDB...');
    await mongoose.disconnect();
    console.log('Disconnected.');
    process.exit(0);
  }
}

migrateManualData();
