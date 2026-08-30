import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { Product } from '../models/Product';

dotenv.config();

async function runCleanup() {
    try {
        await mongoose.connect(process.env.MONGODB_URI as string);
        console.log('✅ Connected to MongoDB.');

        // Reset image_url for all products in the database
        const result = await Product.updateMany(
            {
                image_url: { $ne: null }
            },
            {
                $set: { image_url: null, updated_at: new Date() }
            }
        );

        console.log(`🧹 Cleanup complete! Reset image_url for ${result.modifiedCount} products.`);

    } catch (err) {
        console.error('Error during cleanup:', err);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected.');
    }
}

runCleanup();
