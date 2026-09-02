import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Product } from '../models/Product';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function run() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in the environment variables.');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected.');

    const targetCategory = process.argv[2];
    const query: any = {
      data_source: 'MANUAL', // Your screenshot shows this field exists perfectly
      $or: [
        { barcode: null },
        { barcode: { $exists: false } },
        { barcode: "" },
        { barcode: { $regex: /^\s*$/ } },
        { barcode: { $regex: /^manual_/i } } // <--- THE MAGIC KEY
      ],
    };

    if (targetCategory) {
      console.log(`🎯 Filtering by category: "${targetCategory}"`);
      query.category = { $regex: new RegExp(`^${targetCategory}$`, 'i') };
    } else {
      console.log(`⚠️ No category provided. Processing ALL categories.`);
    }

    // Fetch MANUAL products with missing barcodes (broadened edge cases)
    const products = await Product.find(query);

    console.log(`Found ${products.length} manual products missing barcodes.`);

    for (const product of products) {
      try {
        const encodedName = encodeURIComponent(product.product_name);
        const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodedName}&search_simple=1&action=process&json=1&page_size=3`;

        // Open Food Facts requires a User-Agent header
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'PacketPeek-Dev-App/1.0'
          }
        });

        if (!response.ok) {
          console.error(`⚠️ API Error for "${product.product_name}": ${response.status} ${response.statusText}`);
          // Strict Rate Limiting: 2 second delay
          await new Promise((res) => setTimeout(res, 2000));
          continue;
        }
        
        const text = await response.text();
        if (text.trim().startsWith('<')) {
          console.error(`⚠️ Received HTML instead of JSON for "${product.product_name}". The API might be blocking the request.`);
          // Strict Rate Limiting: 2 second delay
          await new Promise((res) => setTimeout(res, 2000));
          continue;
        }

        const data: any = JSON.parse(text);

        let foundBarcode: string | null = null;

        if (data.products && data.products.length > 0) {
          // Prioritize Indian products if multiple results exist
          const indianProduct = data.products.find((p: any) => 
            p.countries_tags && p.countries_tags.includes('en:india')
          );

          if (indianProduct && indianProduct.code) {
            foundBarcode = indianProduct.code;
          } else if (data.products[0].code) {
            foundBarcode = data.products[0].code;
          }
        }

        if (foundBarcode) {
          try {
            await Product.updateOne(
              { _id: product._id },
              { $set: { barcode: foundBarcode } }
            );
            console.log(`✅ Linked ${foundBarcode} to "${product.product_name}"`);
          } catch (updateErr: any) {
            // E11000 is the MongoDB duplicate key error code
            if (updateErr.code === 11000) {
              console.log(`⚠️ Duplicate barcode ${foundBarcode} detected! Removing squatter product...`);
              // Delete the squatter product holding this barcode
              await Product.deleteOne({ barcode: foundBarcode, _id: { $ne: product._id } });
              
              // Retry the update
              await Product.updateOne(
                { _id: product._id },
                { $set: { barcode: foundBarcode } }
              );
              console.log(`✅ Defeated squatter and successfully linked ${foundBarcode} to "${product.product_name}"`);
            } else {
              throw updateErr;
            }
          }
        } else {
          console.log(`❌ No barcode found for "${product.product_name}"`);
        }

      } catch (err) {
        console.error(`⚠️ Error processing "${product.product_name}":`, err);
      }

      // Strict Rate Limiting: 2 second delay to ensure we don't get blocked
      await new Promise((res) => setTimeout(res, 2000));
    }

    console.log('Finished processing all products.');

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    console.log('Disconnecting from MongoDB...');
    await mongoose.disconnect();
    console.log('Done.');
    process.exit(0);
  }
}

run();
