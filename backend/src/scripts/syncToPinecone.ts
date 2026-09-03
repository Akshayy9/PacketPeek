import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
import { Product } from '../models/Product';
import { ai, pinecone, PINECONE_INDEX_NAME } from '../utils/pinecone';
import type { PineconeRecord } from '@pinecone-database/pinecone';

// Ensure this runs first before other things
dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function retryUpsert(index: any, vectors: PineconeRecord[], maxAttempts = 3) {
  let attempt = 1;
  while (attempt <= maxAttempts) {
    try {
      await index.upsert({ records: vectors });
      return;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      console.warn(`[WARNING] Pinecone upsert failed (attempt ${attempt}/${maxAttempts}). Retrying in ${attempt}s...`, err);
      await delay(1000 * attempt);
      attempt++;
    }
  }
}

async function run() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is missing');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    const index = pinecone.index(PINECONE_INDEX_NAME);

    // Query only unsynced products
    console.log('Fetching unsynced products from MongoDB...');
    const products = await Product.find({ pinecone_synced: { $ne: true } }).lean();
    const totalToSync = products.length;

    console.log(`Found ${totalToSync} products left to sync.`);
    if (totalToSync === 0) {
      console.log('All products are synced. Exiting.');
      await mongoose.disconnect();
      return;
    }

    const batchSize = 50; // chunk size for Gemini batching
    let syncedCount = 0;

    for (let i = 0; i < totalToSync; i += batchSize) {
      const chunk = products.slice(i, i + batchSize);
      
      try {
        // Send chunk to Gemini for batch embedding
        const response = await ai.models.embedContent({
          model: 'gemini-embedding-2',
          contents: chunk.map(p => ({
            parts: [{ text: `title: ${p.product_name || 'none'} | text: Brand: ${p.brand || 'none'}, Category: ${p.category || 'none'}` }]
          })),
          config: {
            outputDimensionality: 768,
          }
        });

        if (!response.embeddings || response.embeddings.length !== chunk.length) {
          throw new Error('Gemini API returned incorrect number of embeddings for the chunk.');
        }

        // Map responses to Pinecone Vectors
        const vectors: PineconeRecord[] = chunk.map((product, idx) => {
          const values = response.embeddings![idx].values;
          if (!values) throw new Error('Missing values in embedding response');
          
          return {
            id: product._id.toString(),
            values: values,
            metadata: {
              mongoId: product._id.toString(),
              name: product.product_name || 'Unknown',
              is_manual: (product.source || '').toLowerCase() === 'manual' || (product.data_source || '').toLowerCase() === 'manual'
            }
          };
        });

        // Retry mechanism for Pinecone Upsert
        await retryUpsert(index, vectors);

        // Update synced products in MongoDB
        const batchIds = chunk.map(p => p._id);
        await Product.updateMany(
          { _id: { $in: batchIds } },
          { $set: { pinecone_synced: true } }
        );

        syncedCount += chunk.length;
        const percentage = ((syncedCount / totalToSync) * 100).toFixed(1);
        console.log(`[Synced ${syncedCount} / ${totalToSync} (${percentage}%)] Batch of ${chunk.length} synced successfully.`);
        
        // Small delay to respect Gemini rate limits
        await delay(1000);
      } catch (err) {
        console.error(`[ERROR] Failed to process batch starting at index ${i}:`, err);
        // We can either abort entirely or continue to the next batch. 
        // Aborting ensures we don't skip batches blindly in case of persistent errors like auth or network drop.
        throw err;
      }
    }

    console.log('✅ Sync to Pinecone completed successfully.');

  } catch (err) {
    console.error('Fatal error during sync:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
