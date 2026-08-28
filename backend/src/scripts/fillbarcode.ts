import mongoose from 'mongoose';
import fuzz from 'fuzzball';
import { Product } from '../models/Product';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/packetpeek_db';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runBackfill() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB.');

        const pendingProducts = await Product.find({ barcode: /^manual_/ });
        console.log(`Found ${pendingProducts.length} products to enrich.`);

        let successCount = 0;
        let duplicateCount = 0;
        let lowScoreCount = 0;
        let notFoundCount = 0;
        let apiErrorCount = 0;

        for (let i = 0; i < pendingProducts.length; i++) {
            const prod = pendingProducts[i];
            const searchQuery = `${prod.brand || ''} ${prod.product_name}`.trim();

            console.log(`\n[${i + 1}/${pendingProducts.length}] Searching OFF for: "${searchQuery}"`);

            const offSearchUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(searchQuery)}&search_simple=1&action=process&json=1&page_size=1`;

            // --- RETRY LOGIC ---
            let apiSuccess = false;
            let retries = 0;
            const MAX_RETRIES = 3;
            let data: any = null;

            while (!apiSuccess && retries < MAX_RETRIES) {
                const response = await fetch(offSearchUrl, {
                    headers: { 'User-Agent': 'PacketPeek-Backfill/1.0' }
                });

                if (!response.ok) {
                    if (response.status === 503 || response.status === 429 || response.status === 502) {
                        retries++;
                        console.log(`  -> Server busy (${response.status}). Waiting 5 seconds... (Attempt ${retries}/${MAX_RETRIES})`);
                        await sleep(5000); // Wait 5 seconds before retrying
                        continue;
                    } else {
                        console.log(`  -> Fatal API error: ${response.status}`);
                        apiErrorCount++;
                        break; // Break out of the retry loop for 400/404 errors
                    }
                }

                data = (await response.json()) as any;
                apiSuccess = true;
            }

            // If we failed all retries, move to the next product
            if (!apiSuccess || !data) {
                if (retries === MAX_RETRIES) apiErrorCount++;
                continue;
            }
            // -------------------

            const offProducts = data.products || [];

            if (offProducts.length > 0) {
                const topHit = offProducts[0];
                const offName = topHit.product_name || topHit.generic_name || '';
                const realBarcode = topHit.code;
                const imageUrl = topHit.image_front_url || topHit.image_url;

                const score = fuzz.token_set_ratio(searchQuery.toLowerCase(), offName.toLowerCase());

                if (score >= 80 && realBarcode && /^\d+$/.test(realBarcode)) {
                    console.log(`  -> Match found! Score: ${score}% | Real Barcode: ${realBarcode}`);

                    const existing = await Product.findOne({ barcode: realBarcode });
                    if (existing) {
                        duplicateCount++;
                        console.log(`  -> Barcode ${realBarcode} already exists. Skipping.`);
                    } else {
                        prod.barcode = realBarcode;
                        if (!prod.image_url && imageUrl) {
                            prod.image_url = imageUrl;
                        }
                        await prod.save();
                        successCount++;
                        console.log(`  -> ✅ Successfully updated in MongoDB.`);
                    }
                } else {
                    lowScoreCount++;
                    console.log(`  -> Rejected. Score too low (${score}%) or invalid barcode for: "${offName}"`);
                }
            } else {
                notFoundCount++;
                console.log(`  -> No results found on Open Food Facts.`);
            }

            // Base delay of 2.5 seconds between every product to stay completely under the radar
            await sleep(2500);
        }

        console.log(`\n========================================`);
        console.log(`           BACKFILL SUMMARY             `);
        console.log(`========================================`);
        console.log(`Total Processed       : ${pendingProducts.length}`);
        console.log(`✅ Successfully Added : ${successCount}`);
        console.log(`⚠️ Skipped Duplicates : ${duplicateCount}`);
        console.log(`❌ Skipped (Low Match): ${lowScoreCount}`);
        console.log(`🔍 Not Found on OFF   : ${notFoundCount}`);
        console.log(`💀 API Timeouts/Errors: ${apiErrorCount}`);
        console.log(`========================================\n`);

    } catch (error) {
        console.error('Fatal script error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
    }
}

runBackfill();