import { Router, Request, Response } from 'express';
import { Product } from '../models/Product';
import { fetchFromOFF } from '../services/offClient';
import { mergeOrInsertOFFProduct } from '../services/productInterceptor';

const router = Router();

/**
 * GET /api/product/:barcode
 *
 * 1. Check MongoDB cache (exact barcode match)
 * 2. On miss, fetch from Open Food Facts
 * 3. Run fuzzy-upsert interceptor:
 *      a. Score >= 85 → merge real barcode into matching seeded document
 *      b. Score <  85 → insert as a new document
 * 4. Return 404 if not found anywhere
 */
router.get('/:barcode', async (req: Request, res: Response) => {
  const { barcode } = req.params;

  if (!barcode || !/^\d{8,14}$/.test(barcode)) {
    res.status(400).json({ error: 'Invalid barcode format. Expected 8–14 digits.' });
    return;
  }

  try {
    // --- Cache check ---
    const cached = await Product.findOne({ barcode }).lean();
    if (cached) {
      console.log(`[CACHE] HIT for barcode: ${barcode}`);
      res.json({ found: true, source: 'cache', product: cached });
      return;
    }

    console.log(`[CACHE] MISS for barcode: ${barcode}`);

    // --- Open Food Facts lookup ---
    const normalized = await fetchFromOFF(barcode);

    if (!normalized) {
      res.status(404).json({ found: false, barcode });
      return;
    }

    // --- Fuzzy-upsert interceptor ---
    // Either merges into a seeded manual document or inserts a new one.
    const product = await mergeOrInsertOFFProduct(normalized);

    res.json({ found: true, source: 'off', product: product.toObject() });
  } catch (err) {
    console.error(`[ERROR] /api/product/${barcode}:`, err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
});

export default router;
