import { Router, Request, Response } from 'express';
import { Product } from '../models/Product';
import { fetchFromOFF } from '../services/offClient';
import { mergeOrInsertOFFProduct } from '../services/productInterceptor';
import { pinecone, PINECONE_INDEX_NAME, generateQueryEmbedding } from '../utils/pinecone';
import { verifyAuth, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/product/category/:categoryName
 * Fetch products by category, paginated and case-insensitive
 */
router.get('/category/:categoryName', async (req: Request, res: Response) => {
  try {
    const { categoryName } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;
    const skip = (page - 1) * limit;

    const decodedCategory = decodeURIComponent(categoryName);

    let searchTerm = decodedCategory;
    if (searchTerm.toLowerCase() === 'cold drinks') {
      searchTerm = 'JUICE';
    } else if (searchTerm.toLowerCase().endsWith('s')) {
      searchTerm = searchTerm.slice(0, -1);
    }

    const filter = { category: { $regex: new RegExp(searchTerm, 'i') } };

    const products = await Product.find(filter)
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Product.countDocuments(filter);

    res.json({
      products,
      page,
      limit,
      total,
      hasMore: skip + products.length < total
    });
  } catch (err) {
    console.error(`[ERROR] /api/product/category/${req.params.categoryName}:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
/**
 * GET /api/product/search/query
 * Search products by semantic vector search using Pinecone
 */
router.get('/search/query', async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    if (!q) {
      res.json([]);
      return;
    }

    const queryVector = await generateQueryEmbedding(q);
    const index = pinecone.index(PINECONE_INDEX_NAME);
    
    let queryResponse;
    try {
      queryResponse = await index.query({
        vector: queryVector,
        topK: 15,
        includeMetadata: true
      });
    } catch (pineconeErr) {
      console.warn(`[WARNING] Pinecone query failed (DB might be empty):`, pineconeErr);
      res.json([]);
      return;
    }

    if (!queryResponse?.matches || queryResponse.matches.length === 0) {
      res.json([]);
      return;
    }

    // Sort manual matches to the top, preserving score order within groups
    const sortedMatches = [...queryResponse.matches].sort((a, b) => {
      const aManual = a.metadata?.is_manual === true;
      const bManual = b.metadata?.is_manual === true;
      
      if (aManual && !bManual) return -1;
      if (!aManual && bManual) return 1;
      
      // Both are same type, fallback to Pinecone score
      const scoreA = a.score ?? 0;
      const scoreB = b.score ?? 0;
      return scoreB - scoreA;
    });

    const mongoIds = sortedMatches.map(match => match.metadata?.mongoId as string).filter(Boolean);

    // Fetch from MongoDB
    const products = await Product.find({ _id: { $in: mongoIds } }).lean();

    // Map documents to a dictionary for O(1) lookup
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    // Reconstruct the array to perfectly match the sorted Pinecone order
    const orderedProducts = mongoIds.map(id => productMap.get(id)).filter(Boolean);

    res.json(orderedProducts);
  } catch (err) {
    console.error(`[ERROR] /api/product/search/query:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

  if (!barcode || !/^[\w-]+$/.test(barcode)) {
    res.status(400).json({ error: 'Invalid barcode format.' });
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
    const product = await mergeOrInsertOFFProduct(normalized);

    res.json({ found: true, source: 'off', product: product.toObject() });
  } catch (err) {
    console.error(`[ERROR] /api/product/${barcode}:`, err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
});

import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * POST /api/product/analyze
 *
 * Analyze ingredients_text using Gemini and update the product.
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      res.status(400).json({ error: 'productId is required.' });
      return;
    }

    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    if (!product.ingredients_text) {
      res.status(400).json({ error: 'ingredients_text is required for AI analysis.' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.8-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const prompt = `You are an expert food scientist. Analyze the following ingredients list. Return ONLY a valid JSON object matching the requested schema. Calculate the NOVA group based on standard definitions (1=unprocessed, 4=ultra-processed). Identify common allergens (milk, soy, nuts, wheat, etc.). Flag any artificial additives, preservatives, or colorings.

Schema:
{
  "nova_group": 1 | 2 | 3 | 4 | null,
  "vegetarian_status": "veg" | "non-veg" | "unknown",
  "allergens_tags": ["string"],
  "flagged_additives": ["string"]
}

Ingredients:
${product.ingredients_text}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsedData = JSON.parse(responseText);

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        $set: {
          nova_group: parsedData.nova_group,
          vegetarian_status: parsedData.vegetarian_status,
          allergens_tags: parsedData.allergens_tags || [],
          flagged_additives: parsedData.flagged_additives || []
        }
      },
      { new: true, runValidators: true }
    );

    res.json(updatedProduct);
  } catch (err) {
    console.error(`[ERROR] /api/product/analyze:`, err);
    res.status(500).json({ error: 'Internal server error during analysis.' });
  }
});

/**
 * GET /api/product/contributions
 * Protected — returns all products contributed by the authenticated user,
 * newest first.
 */
router.get('/contributions', verifyAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.uid;
    const contributions = await Product
      .find({ contributor_uid: uid })
      .sort({ created_at: -1 })
      .lean();

    res.json({ count: contributions.length, products: contributions });
  } catch (err) {
    console.error('[ERROR] GET /api/product/contributions:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/product/:id
 * Protected — allows a contributor to edit their own product.
 * Returns 403 if the authenticated user does not own this product.
 * Allowed editable fields: barcode, product_name, brand, ingredients_text,
 * nutrients_per_100g, nutri_score, nova_group, allergens_tags, flagged_additives,
 * category, sub_category, image_url, vegetarian_status.
 */
router.put('/:id', verifyAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const uid = req.user!.uid;

    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // ── Ownership check ──────────────────────────────────────────────────
    if (product.contributor_uid !== uid) {
      res.status(403).json({ error: 'Forbidden: You did not contribute this product' });
      return;
    }

    // ── Apply only safe, whitelisted fields ──────────────────────────────
    const ALLOWED_FIELDS = [
      'barcode', 'product_name', 'brand', 'image_url',
      'ingredients_text', 'ingredients_list',
      'nutrients_per_100g', 'nutri_score', 'nova_group',
      'allergens_tags', 'flagged_additives',
      'category', 'sub_category', 'vegetarian_status',
    ] as const;

    for (const field of ALLOWED_FIELDS) {
      if (req.body[field] !== undefined) {
        (product as any)[field] = req.body[field];
      }
    }

    await product.save();

    res.json({ success: true, product: product.toObject() });
  } catch (err) {
    console.error(`[ERROR] PUT /api/product/${req.params.id}:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

