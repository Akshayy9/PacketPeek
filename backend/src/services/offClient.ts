import axios from 'axios';
import { INutrientsPer100g } from '../models/Product';

const OFF_BASE_URL = 'https://world.openfoodfacts.org/api/v2/product';

export interface NormalizedProduct {
  barcode: string;
  brand_key: string | null;
  product_name: string;
  brand: string | null;
  image_url: string | null;
  ingredients_text: string | null;
  ingredients_list: string[] | null;
  nutrients_per_100g: INutrientsPer100g | null;
  nutri_score: string | null;
  source: 'off';
}

/**
 * Parse a raw ingredients string into an array of trimmed strings.
 * Returns null if the string is empty or parsing produces fewer than 2 items
 * (likely not properly delimited).
 */
function parseIngredients(raw: string | undefined): string[] | null {
  if (!raw) return null;
  const parts = raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.length >= 2 ? parts : null;
}

/**
 * Safely parse a numeric value, returning null on NaN / undefined.
 */
function safeNum(val: unknown): number | null {
  if (val === undefined || val === null) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

/**
 * Normalize an Open Food Facts v2 product object into our schema shape.
 */
function normalizeOFFProduct(barcode: string, offProduct: Record<string, unknown>): NormalizedProduct {
  const nutriments = (offProduct['nutriments'] ?? {}) as Record<string, unknown>;

  const nutrients: INutrientsPer100g = {
    energy_kcal: safeNum(nutriments['energy-kcal_100g'] ?? nutriments['energy_100g']),
    sugar_g: safeNum(nutriments['sugars_100g']),
    protein_g: safeNum(nutriments['proteins_100g']),
    fat_g: safeNum(nutriments['fat_100g']),
    saturated_fat_g: safeNum(nutriments['saturated-fat_100g']),
    fibre_g: safeNum(nutriments['fiber_100g'] ?? nutriments['fibers_100g']),
    sodium_mg: (() => {
      // OFF stores sodium in grams — convert to mg
      const sodiumG = safeNum(nutriments['sodium_100g']);
      return sodiumG !== null ? Math.round(sodiumG * 1000) : null;
    })(),
  };

  const allNullNutrients = Object.values(nutrients).every((v) => v === null);

  const ingredientsText = (offProduct['ingredients_text'] as string | undefined) ?? null;

  const productName =
    (offProduct['product_name'] as string | undefined) ||
    (offProduct['product_name_en'] as string | undefined) ||
    (offProduct['abbreviated_product_name'] as string | undefined) ||
    'Unknown Product';

  const brand = (offProduct['brands'] as string | undefined)?.split(',')[0]?.trim() ?? null;

  return {
    barcode,
    brand_key: null, // populated in a later phase
    product_name: productName,
    brand,
    image_url: (offProduct['image_front_url'] as string | undefined) ?? null,
    ingredients_text: ingredientsText,
    ingredients_list: parseIngredients(ingredientsText ?? undefined),
    nutrients_per_100g: allNullNutrients ? null : nutrients,
    nutri_score: (offProduct['nutriscore_grade'] as string | undefined) ?? null,
    source: 'off',
  };
}

/**
 * Fetch a product from Open Food Facts by barcode.
 * Returns a normalized product object, or null if not found.
 */
export async function fetchFromOFF(barcode: string): Promise<NormalizedProduct | null> {
  try {
    const url = `${OFF_BASE_URL}/${barcode}.json`;
    console.log(`[OFF] Fetching: ${url}`);

    const response = await axios.get<Record<string, unknown>>(url, {
      timeout: 8000,
      headers: {
        // OFF recommends identifying your app
        'User-Agent': 'PacketPeek/1.0 (ZaikaScore; contact@packetpeek.app)',
      },
    });

    const data = response.data;

    // OFF returns status=0 when product is not found
    if (!data || data['status'] === 0 || !data['product']) {
      console.log(`[OFF] Product not found for barcode: ${barcode}`);
      return null;
    }

    const offProduct = data['product'] as Record<string, unknown>;
    const normalized = normalizeOFFProduct(barcode, offProduct);
    console.log(`[OFF] Successfully fetched "${normalized.product_name}" for barcode: ${barcode}`);
    return normalized;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 404) {
        console.log(`[OFF] 404 for barcode: ${barcode}`);
        return null;
      }
      console.error(`[OFF] Axios error for ${barcode}:`, err.message);
    } else {
      console.error(`[OFF] Unexpected error for ${barcode}:`, err);
    }
    throw err; // Re-throw non-404 errors so the route can return 500
  }
}
