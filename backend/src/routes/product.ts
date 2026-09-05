import { Router, Request, Response } from 'express';
import { Product } from '../models/Product';
import { fetchFromOFF } from '../services/offClient';
import { mergeOrInsertOFFProduct } from '../services/productInterceptor';
import { pinecone, PINECONE_INDEX_NAME, generateQueryEmbedding } from '../utils/pinecone';
import { verifyAuth, AuthRequest } from '../middleware/auth';
import { calculateChildSafety } from '../services/scoringEngine';

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
 * GET /api/product/:barcode/alternatives
 *
 * RAG pipeline: uses the product's category + nutritional data to vector-search
 * Pinecone for similar products, then asks Gemini to rank the 3 healthiest ones
 * and explain why each is a better choice.
 */
router.get('/:barcode/alternatives', async (req: Request, res: Response) => {
  const { barcode } = req.params;

  try {
    // 1. Load the source product
    const sourceProduct = await Product.findOne({ barcode }).lean();
    if (!sourceProduct) {
      res.status(404).json({ error: 'Source product not found' });
      return;
    }

    const n = sourceProduct.nutrients_per_100g;
    const category = sourceProduct.category ?? 'food product';

    // 2. Build a rich semantic query for Pinecone
    const nutritionContext = n
      ? `sugar ${n.sugar_g ?? '?'}g, fat ${n.fat_g ?? '?'}g, saturated fat ${n.saturated_fat_g ?? '?'}g, sodium ${n.sodium_mg ?? '?'}mg, protein ${n.protein_g ?? '?'}g, energy ${n.energy_kcal ?? '?'}kcal per 100g`
      : '';
    const semanticQuery = `healthy alternative to ${sourceProduct.product_name} in category ${category}. ${nutritionContext}`;

    // 3. Embed the query and search Pinecone
    const queryVector = await generateQueryEmbedding(semanticQuery);
    const index = pinecone.index(PINECONE_INDEX_NAME);

    let pineconeResults;
    try {
      pineconeResults = await index.query({
        vector: queryVector,
        topK: 20,
        includeMetadata: true,
      });
    } catch (pineconeErr) {
      console.warn('[ALTERNATIVES] Pinecone query failed:', pineconeErr);
      res.json({ alternatives: [] });
      return;
    }

    if (!pineconeResults?.matches || pineconeResults.matches.length === 0) {
      res.json({ alternatives: [] });
      return;
    }

    // 4. Fetch candidate products from MongoDB (exclude the source product itself)
    const candidateIds = pineconeResults.matches
      .map(m => m.metadata?.mongoId as string)
      .filter(id => id && id !== sourceProduct._id.toString());

    const candidates = await Product.find({ _id: { $in: candidateIds } })
      .limit(10)
      .lean();

    if (candidates.length === 0) {
      res.json({ alternatives: [] });
      return;
    }

    // 5. Ask Gemini to select 4-5 healthiest alternatives with format/quantity priority
    const { ai: geminiClient } = await import('../utils/pinecone');

    const candidateSummaries = candidates.map((p, i) => {
      const cn = p.nutrients_per_100g;
      return [
        `${i + 1}.`,
        `name="${p.product_name}"`,
        `brand="${p.brand ?? ''}"`,
        `barcode="${p.barcode ?? ''}"`,
        `image="${p.image_url ?? ''}"`,
        `category="${p.category ?? ''}"`,
        `sub_category="${p.sub_category ?? ''}"`,
        `nutri_score="${p.nutri_score ?? '?'}"`,
        `nova_group="${p.nova_group ?? '?'}"`,
        `sugar_g=${cn?.sugar_g ?? '?'}`,
        `fat_g=${cn?.fat_g ?? '?'}`,
        `saturated_fat_g=${cn?.saturated_fat_g ?? '?'}`,
        `sodium_mg=${cn?.sodium_mg ?? '?'}`,
        `protein_g=${cn?.protein_g ?? '?'}`,
        `energy_kcal=${cn?.energy_kcal ?? '?'}`,
      ].join(' ');
    }).join('\n');

    // Build a human-readable list of the scanned product's nutritional red flags
    const negativeTraits: string[] = [];
    if (n) {
      if ((n.sugar_g ?? 0) > 20)          negativeTraits.push(`high sugar (${n.sugar_g}g/100g)`);
      if ((n.saturated_fat_g ?? 0) > 8)   negativeTraits.push(`high saturated fat (${n.saturated_fat_g}g/100g)`);
      if ((n.fat_g ?? 0) > 20)            negativeTraits.push(`high total fat (${n.fat_g}g/100g)`);
      if ((n.sodium_mg ?? 0) > 600)       negativeTraits.push(`high sodium (${n.sodium_mg}mg/100g)`);
      if ((n.protein_g ?? 0) < 4)         negativeTraits.push(`low protein (${n.protein_g}g/100g)`);
      if (!sourceProduct.nutri_score || ['D','E'].includes(sourceProduct.nutri_score))
        negativeTraits.push(`poor Nutri-Score (${sourceProduct.nutri_score ?? 'unknown'})`);
    }
    const negStr = negativeTraits.length > 0 ? negativeTraits.join(', ') : 'general health improvement';

    const sourceNutritionStr = n
      ? `sugar ${n.sugar_g}g, fat ${n.fat_g}g, sat-fat ${n.saturated_fat_g}g, sodium ${n.sodium_mg}mg, protein ${n.protein_g}g, energy ${n.energy_kcal}kcal, Nutri-Score ${sourceProduct.nutri_score ?? '?'}, NOVA ${sourceProduct.nova_group ?? '?'}`
      : 'nutrition data unavailable';

    const prompt = `You are an expert, health-focused nutritional assistant for PacketPeek, a food transparency app.

Context: A user has scanned the following product:
- Name: "${sourceProduct.product_name}"
- Brand: "${sourceProduct.brand ?? 'unknown'}"
- Category: "${category}" / Sub-category: "${sourceProduct.sub_category ?? 'N/A'}"
- Nutritional profile (per 100g): ${sourceNutritionStr}
- Key nutritional concerns: ${negStr}

Task: From the candidate products below, select 4 to 5 alternatives that belong to the SAME category and offer a significantly better nutritional profile than the scanned item.

Ranking Rules (CRITICAL — follow strictly):
1. Format & Quantity Priority: Prioritise alternatives that match the scanned product's packaging format and approximate serving size (e.g., if the scanned item is a multi-pack, prefer other multi-packs over single-serve options).
2. Strict Rank Order:
   - Rank 1 & 2: Closest match in BOTH nutritional improvement AND packaging format/quantity.
   - Rank 3+: Healthier alternatives in the same category that may have a different format.
3. Only suggest realistic replacements a consumer would actually buy instead of the scanned product.
4. Exclude the scanned product itself if it appears in the candidates.
5. Do NOT invent products — only use data from the candidates list below.

Candidates:
${candidateSummaries}

Return ONLY a valid JSON array of 4 to 5 objects (fewer if fewer valid candidates exist), ordered by rank. Each object must have exactly these fields:
{
  "name": "product name",
  "barcode": "barcode or empty string",
  "image": "image url or empty string",
  "reason_why": "one concise sentence citing specific data (e.g. 'Contains 4g less saturated fat and 50% less sugar per 100g, with Nutri-Score A vs D')"
}

Output ONLY the JSON array. No markdown, no backticks, no explanation text.`;


    const geminiResponse = await geminiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const rawText = (geminiResponse.text ?? '').replace(/```json/gi, '').replace(/```/g, '').trim();

    let alternatives: Array<{ name: string; barcode: string; image: string; reason_why: string }> = [];
    try {
      alternatives = JSON.parse(rawText);
      if (!Array.isArray(alternatives)) alternatives = [];
    } catch {
      console.error('[ALTERNATIVES] Gemini returned invalid JSON:', rawText);
    }

    res.json({ alternatives: alternatives.slice(0, 5) });
  } catch (err) {
    console.error(`[ERROR] GET /api/product/${barcode}/alternatives:`, err);
    res.status(500).json({ error: 'Internal server error fetching alternatives' });
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
      const childSafetyVerdict = calculateChildSafety(cached);
      res.json({ found: true, source: 'cache', product: { ...cached, childSafetyVerdict } });
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
    const productObj = product.toObject();
    const childSafetyVerdict = calculateChildSafety(productObj);
    res.json({ found: true, source: 'off', product: { ...productObj, childSafetyVerdict } });
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

