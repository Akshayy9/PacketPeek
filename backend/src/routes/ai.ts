import { Router, Response } from 'express';
import multer from 'multer';
import { verifyAuth, AuthRequest } from '../middleware/auth';
import { ai } from '../utils/pinecone'; // reusing the GoogleGenAI instance
import { Product } from '../models/Product';
import mongoose from 'mongoose';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/products/analyze-image
 * Protected route to analyze product image via Gemini Vision and save to DB
 */
router.post('/analyze-image', verifyAuth, upload.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No image uploaded' });
      return;
    }

    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ error: 'User ID not found' });
      return;
    }

    // Convert buffer to base64 inline data for Gemini
    const imagePart = {
      inlineData: {
        data: req.file.buffer.toString('base64'),
        mimeType: req.file.mimetype
      }
    };

    const prompt = `Analyze this product packaging (front/back/ingredients).
Extract the following information in strict JSON format:
{
  "product_name": "string",
  "brand": "string",
  "ingredients_text": "string (full ingredients list)",
  "nutrients_per_100g": { "energy_kcal": number, "sugar_g": number, "protein_g": number, "fat_g": number, "saturated_fat_g": number, "fibre_g": number, "sodium_mg": number },
  "allergens_tags": ["string", "string"],
  "nova_group": number (1 to 4, based on processing level),
  "nutriscore_grade": "string (a, b, c, d, or e)"
}
Only output the valid JSON, no markdown formatting or backticks.`;

    const result = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        { role: 'user', parts: [imagePart, { text: prompt }] }
      ]
    });

    const responseText = result.text || '';
    const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();

    let parsedData;
    try {
      parsedData = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.error('Gemini returned invalid JSON:', responseText);
      res.status(500).json({ error: 'AI returned invalid structured data' });
      return;
    }

    // Save to MongoDB as a manual entry linked to the user
    const newProduct = new Product({
      _id: new mongoose.Types.ObjectId().toString(),
      barcode: `manual_scan_${Date.now()}`,
      product_name: parsedData.product_name,
      brand: parsedData.brand,
      ingredients_text: parsedData.ingredients_text,
      nutrients_per_100g: parsedData.nutrients_per_100g,
      allergens_tags: parsedData.allergens_tags,
      nova_group: parsedData.nova_group,
      nutri_score: parsedData.nutriscore_grade?.toUpperCase(),
      source: 'manual',
      contributor_uid: userId,
      contributor_email: req.user?.email ?? null,
    });

    await newProduct.save();

    res.json({ success: true, product: newProduct });
  } catch (err) {
    console.error('[ERROR] /api/products/analyze-image:', err);
    res.status(500).json({ error: 'Internal server error analyzing image' });
  }
});

export default router;
