import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Product } from '../models/Product';
import path from 'path';

// Load environment variables from the root backend directory
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function migrateAllData() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in the environment variables.');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Successfully connected to MongoDB.');

    console.log("Updating ALL existing products in the database...");
    const result = await Product.updateMany(
      {}, // Empty filter targets ALL documents in the collection
      {
        $set: {
          serving_size: null,
          serving_quantity: null,
          nutrients_per_serving: {
            energy_kcal: null,
            sugar_g: null,
            protein_g: null,
            fat_g: null,
            saturated_fat_g: null,
            fibre_g: null,
            sodium_mg: null,
          },
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

migrateAllData();
