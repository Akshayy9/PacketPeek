import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Product } from './src/models/Product';

dotenv.config({ path: path.resolve(__dirname, '.env') });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log('Connected');

  try {
    const newProduct = new Product({
      _id: new mongoose.Types.ObjectId().toString(),
      barcode: `manual_scan_${Date.now()}`,
      product_name: 'Test Product',
      brand: 'Test Brand',
      ingredients_text: 'Test Ingredients',
      nutrients_per_100g: { energy: 100, sugars: 10, fat: 5, salt: 1 },
      allergens_tags: ['test'],
      nova_group: 4,
      nutri_score: 'E',
      source: 'manual',
      contributor_uid: 'test_uid',
      contributor_email: 'test@example.com',
    });

    await newProduct.save();
    console.log('Saved product:', newProduct._id);
  } catch (err) {
    console.error('Error saving:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
