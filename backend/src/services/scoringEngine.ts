/**
 * scoringEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure, side-effect-free functions for calculating Nutri-Score and detecting
 * harmful additives in packaged food products.
 *
 * Intentionally has NO database or HTTP dependencies so it can be unit-tested
 * and reused in both batch scripts and live API routes.
 */

import { INutrients } from '../models/Product';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type NutriScoreLetter = 'A' | 'B' | 'C' | 'D' | 'E';

/** A single additive entry in the harmful-additives dictionary. */
interface AdditiveEntry {
  /** Display name returned in the flagged list. */
  name: string;
  /**
   * Regex patterns used for case-insensitive matching against the
   * ingredients string or array. A match on ANY pattern flags the additive.
   */
  patterns: RegExp[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Harmful Additives Dictionary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Curated list of additives commonly found in Indian packaged snacks that are
 * associated with negative health outcomes. Grouped by concern category.
 *
 * Sources: FSSAI additive guidelines, CSPI, EWG Dirty Dozen.
 */
const HARMFUL_ADDITIVES: AdditiveEntry[] = [
  // ── Hidden / Refined Sugars ───────────────────────────────────────────────
  {
    name: 'Maltodextrin',
    patterns: [/maltodextrin/i],
  },
  {
    name: 'High-Fructose Corn Syrup',
    patterns: [/high[\s-]?fructose corn syrup/i, /\bhfcs\b/i],
  },
  {
    name: 'Liquid Glucose',
    patterns: [/liquid glucose/i],
  },
  {
    name: 'Invert Syrup',
    patterns: [/invert\s*(sugar\s*)?syrup/i],
  },
  {
    name: 'Corn Syrup',
    patterns: [/\bcorn syrup\b/i],
  },
  {
    name: 'Glucose Syrup',
    patterns: [/glucose syrup/i],
  },
  {
    name: 'Dextrose',
    patterns: [/\bdextrose\b/i],
  },

  // ── Bad Fats ──────────────────────────────────────────────────────────────
  {
    name: 'Palm Oil',
    patterns: [/\bpalm\s*oil\b/i, /\bpalmolein\b/i, /\bpalm\s*fat\b/i],
  },
  {
    name: 'Hydrogenated Fat',
    patterns: [/hydrogenated\s*(vegetable\s*)?(oil|fat)/i, /\bvanaspati\b/i],
  },
  {
    name: 'Interesterified Fat',
    patterns: [/interesterified/i],
  },

  // ── Artificial Preservatives ──────────────────────────────────────────────
  {
    name: 'Sodium Benzoate (INS 211)',
    patterns: [/\bins\s*211\b/i, /sodium benzoate/i],
  },
  {
    name: 'Potassium Sorbate (INS 202)',
    patterns: [/\bins\s*202\b/i, /potassium sorbate/i],
  },
  {
    name: 'BHA / BHT (INS 320/321)',
    patterns: [/\bins\s*32[01]\b/i, /\bbha\b/i, /\bbht\b/i, /butylated hydroxy/i],
  },
  {
    name: 'TBHQ (INS 319)',
    patterns: [/\bins\s*319\b/i, /\btbhq\b/i, /tertiary butylhydroquinone/i],
  },

  // ── Artificial Colors ─────────────────────────────────────────────────────
  {
    name: 'Sunset Yellow (INS 110)',
    patterns: [/\bins\s*110\b/i, /sunset yellow/i],
  },
  {
    name: 'Tartrazine (INS 102)',
    patterns: [/\bins\s*102\b/i, /tartrazine/i],
  },
  {
    name: 'Allura Red (INS 129)',
    patterns: [/\bins\s*129\b/i, /allura red/i],
  },
  {
    name: 'Brilliant Blue (INS 133)',
    patterns: [/\bins\s*133\b/i, /brilliant blue/i],
  },
  {
    name: 'Erythrosine (INS 127)',
    patterns: [/\bins\s*127\b/i, /erythrosine/i],
  },
  {
    name: 'Carmoisine (INS 122)',
    patterns: [/\bins\s*122\b/i, /carmoisine/i, /azorubine/i],
  },

  // ── Artificial Sweeteners ─────────────────────────────────────────────────
  {
    name: 'Aspartame (INS 951)',
    patterns: [/\bins\s*951\b/i, /\baspartame\b/i],
  },
  {
    name: 'Acesulfame-K (INS 950)',
    patterns: [/\bins\s*950\b/i, /acesulfame/i],
  },
  {
    name: 'Saccharin (INS 954)',
    patterns: [/\bins\s*954\b/i, /\bsaccharin\b/i],
  },

  // ── Flavor Enhancers ──────────────────────────────────────────────────────
  {
    name: 'MSG (INS 621)',
    patterns: [/\bins\s*621\b/i, /monosodium glutamate/i, /\bmsg\b/i],
  },
  {
    name: 'Disodium Inosinate (INS 631)',
    patterns: [/\bins\s*631\b/i, /disodium inosinate/i],
  },
  {
    name: 'Disodium Guanylate (INS 627)',
    patterns: [/\bins\s*627\b/i, /disodium guanylate/i],
  },

  // ── Emulsifiers / Stabilisers of concern ─────────────────────────────────
  {
    name: 'Carrageenan (INS 407)',
    patterns: [/\bins\s*407\b/i, /carrageenan/i],
  },
  {
    name: 'Propylene Glycol (INS 1520)',
    patterns: [/\bins\s*1520\b/i, /propylene glycol/i],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// analyzeIngredients
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scans a product's ingredients data against the harmful additives dictionary.
 *
 * @param ingredientsData - Either the raw `ingredients_text` string OR the
 *   pre-split `ingredients_list` array. Both are accepted.
 * @returns A deduplicated array of display names for any matched additives,
 *   e.g. `["Palm Oil", "Maltodextrin", "Sunset Yellow (INS 110)"]`.
 *   Returns an empty array if no harmful additives are found or if the input
 *   is empty/null.
 */
export function analyzeIngredients(
  ingredientsData: string[] | string | null | undefined
): string[] {
  if (!ingredientsData) return [];

  // Flatten list → single searchable string for uniform regex matching.
  const haystack: string =
    Array.isArray(ingredientsData)
      ? ingredientsData.join(', ')
      : ingredientsData;

  if (!haystack.trim()) return [];

  const flagged: string[] = [];

  for (const additive of HARMFUL_ADDITIVES) {
    const matched = additive.patterns.some((pattern) => pattern.test(haystack));
    if (matched) {
      flagged.push(additive.name);
    }
  }

  return flagged;
}

// ─────────────────────────────────────────────────────────────────────────────
// Nutri-Score helpers (simplified FSA points system)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Negative nutrients — higher values increase the raw score (worse).
 * Thresholds are per-100 g values mapped to 0–10 points each.
 */
function energyPoints(kcal: number): number {
  // Thresholds: 335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350 kJ
  // We work in kcal (÷ 4.184 conversion) using equivalent kcal thresholds.
  const thresholds = [80, 160, 240, 320, 400, 480, 560, 640, 720, 800];
  return thresholds.filter((t) => kcal > t).length;
}

function sugarPoints(sugar: number): number {
  const thresholds = [4.5, 9, 13.5, 18, 22.5, 27, 31, 36, 40, 45];
  return thresholds.filter((t) => sugar > t).length;
}

function saturatedFatPoints(satFat: number): number {
  const thresholds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return thresholds.filter((t) => satFat > t).length;
}

function sodiumPoints(sodiumMg: number): number {
  // Sodium (mg) thresholds  — standard FSA uses 90 mg increments up to 900 mg
  const thresholds = [90, 180, 270, 360, 450, 540, 630, 720, 810, 900];
  return thresholds.filter((t) => sodiumMg > t).length;
}

/**
 * Positive nutrients — higher values decrease the raw score (better).
 */
function fibrePoints(fibre: number): number {
  const thresholds = [0.9, 1.9, 2.8, 3.7, 4.7];
  return thresholds.filter((t) => fibre > t).length;
}

function proteinPoints(protein: number): number {
  const thresholds = [1.6, 3.2, 4.8, 6.4, 8.0];
  return thresholds.filter((t) => protein > t).length;
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateNutriScore
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates a Nutri-Score letter grade (A–E) using a simplified version of
 * the FSA nutrient profiling model.
 *
 * Score = (energyPts + sugarPts + satFatPts + sodiumPts)
 *       − (fibrePts + proteinPts)
 *
 * Grade bands (general foods):
 *   A : ≤ −1
 *   B :  0 –  2
 *   C :  3 –  10
 *   D : 11 –  18
 *   E : ≥ 19
 *
 * @param nutrients - The `nutrients_per_100g` sub-document (may be null).
 * @param _category - Reserved for future category-specific adjustments
 *   (e.g. beverages, fats). Currently unused.
 * @returns A letter 'A'–'E', or `null` if insufficient nutrient data exists.
 */
export function calculateNutriScore(
  nutrients: INutrients | null | undefined,
  _category: string | null
): NutriScoreLetter | null {
  if (!nutrients) return null;

  const { energy_kcal, sugar_g, saturated_fat_g, sodium_mg, fibre_g, protein_g } =
    nutrients;

  // Require at least one negative nutrient to be present to produce a score.
  const hasData =
    energy_kcal !== null ||
    sugar_g !== null ||
    saturated_fat_g !== null ||
    sodium_mg !== null;

  if (!hasData) return null;

  // ── Negative points (0–10 each) ──────────────────────────────────────────
  const negPoints =
    energyPoints(energy_kcal ?? 0) +
    sugarPoints(sugar_g ?? 0) +
    saturatedFatPoints(saturated_fat_g ?? 0) +
    sodiumPoints(sodium_mg ?? 0);

  // ── Positive points (0–5 each) ───────────────────────────────────────────
  const posPoints =
    fibrePoints(fibre_g ?? 0) +
    proteinPoints(protein_g ?? 0);

  const rawScore = negPoints - posPoints;

  // ── Grade bands ───────────────────────────────────────────────────────────
  if (rawScore <= -1) return 'A';
  if (rawScore <= 2)  return 'B';
  if (rawScore <= 10) return 'C';
  if (rawScore <= 18) return 'D';
  return 'E';
}

// ─────────────────────────────────────────────────────────────────────────────
// Child Safety Verdict (deterministic rule engine — NO LLM)
// ─────────────────────────────────────────────────────────────────────────────

/** Shape of the structured child-safety output attached to every product. */
export interface ChildSafetyVerdict {
  /** true when minimumAge === 0 — safe for all ages with no concerns */
  isRecommended: boolean;
  /**
   * Minimum age in years before this product should be consumed.
   * 0 = no restriction, 1 = not for infants, 2 = WHO sugar/sweetener
   * guideline, 12 = Southampton Six hyperactivity dyes.
   */
  minimumAge: number;
  /** Human-readable reason strings, one per triggered rule. */
  reasons: string[];
}

/** The "Southampton Six" — artificial colours with a proven link to
 *  hyperactivity in children (EFSA / FSA 2007 study). */
const SOUTHAMPTON_SIX = new Set(['E102', 'E104', 'E110', 'E122', 'E124', 'E129']);

/**
 * calculateChildSafety
 * ─────────────────────────────────────────────────────────────────────────────
 * Deterministic, rule-based child safety assessment. No AI / LLM involved.
 *
 * Rules are evaluated in ascending age-restriction order; the most restrictive
 * rule always wins and sets the final `minimumAge`.
 *
 * @param productData - Partial product fields needed for child safety checks.
 */
export function calculateChildSafety(productData: {
  added_sugar_g?: number | null;
  has_honey?: boolean | null;
  has_artificial_sweeteners?: boolean | null;
  artificial_colors?: string[] | null;
}): ChildSafetyVerdict {
  let minimumAge = 0;
  const reasons: string[] = [];

  const {
    added_sugar_g,
    has_honey,
    has_artificial_sweeteners,
    artificial_colors,
  } = productData;

  // ── Rule 1: Honey → age 1 (infant botulism risk) ────────────────────────
  if (has_honey === true) {
    minimumAge = Math.max(minimumAge, 1);
    reasons.push('Contains honey — risk of infant botulism for children under 1 year.');
  }

  // ── Rule 2: Added sugar OR artificial sweeteners → age 2 (WHO guidelines)
  if ((added_sugar_g != null && added_sugar_g > 0) || has_artificial_sweeteners === true) {
    minimumAge = Math.max(minimumAge, 2);
    const parts: string[] = [];
    if (added_sugar_g != null && added_sugar_g > 0)
      parts.push(`contains added sugar (${added_sugar_g}g/100g)`);
    if (has_artificial_sweeteners === true)
      parts.push('contains artificial sweeteners');
    reasons.push(
      `WHO guidelines advise against added sugar and sweeteners for children under 2 — product ${parts.join(' and ')}.`
    );
  }

  // ── Rule 3: Southampton Six dyes → age 12 (hyperactivity link) ──────────
  const matchedDyes = (artificial_colors ?? []).filter((c) =>
    SOUTHAMPTON_SIX.has(c.toUpperCase().trim())
  );
  if (matchedDyes.length > 0) {
    minimumAge = Math.max(minimumAge, 12);
    reasons.push(
      `Contains Southampton Six artificial colour${matchedDyes.length > 1 ? 's' : ''} (${matchedDyes.join(', ')}) linked to hyperactivity in children — not recommended under 12.`
    );
  }

  return {
    isRecommended: minimumAge === 0,
    minimumAge,
    reasons,
  };
}

