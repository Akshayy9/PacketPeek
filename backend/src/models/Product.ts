import mongoose, { Document, Schema } from 'mongoose';

export interface INutrients {
  energy_kcal: number | null;
  sugar_g: number | null;
  protein_g: number | null;
  fat_g: number | null;
  saturated_fat_g: number | null;
  fibre_g: number | null;
  sodium_mg: number | null;
}

export interface IProduct extends Document {
  barcode?: string;
  data_source: 'MANUAL' | 'OFF_SEED';
  brand_key: string | null;
  product_name: string;
  brand: string | null;
  image_url: string | null;
  ingredients_text: string | null;
  ingredients_list: string[] | null;
  nutrients_per_100g: INutrients | null;
  nutrients_per_serving: INutrients | null;
  serving_size: string | null;
  serving_quantity: number | null;
  nutri_score: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  nova_group: 1 | 2 | 3 | 4 | null;
  vegetarian_status: 'veg' | 'non-veg' | 'unknown';
  allergens_tags: string[];
  category: string | null;
  sub_category: string | null;
  flagged_additives: string[];
  source: 'off' | 'manual';
  contributor_uid?: string;     // Firebase UID of the user who submitted this
  contributor_email?: string;   // Email for display purposes
  created_at: Date;
  updated_at: Date;
}

const NutrientsSchema = new Schema<INutrients>(
  {
    energy_kcal: { type: Number, default: null },
    sugar_g: { type: Number, default: null },
    protein_g: { type: Number, default: null },
    fat_g: { type: Number, default: null },
    saturated_fat_g: { type: Number, default: null },
    fibre_g: { type: Number, default: null },
    sodium_mg: { type: Number, default: null },
  },
  { _id: false }
);

const ProductSchema = new Schema<IProduct>(
  {
    barcode: { type: String, unique: true, sparse: true },
    data_source: { type: String, enum: ['MANUAL', 'OFF_SEED'], default: 'MANUAL' },
    brand_key: { type: String, default: null },
    product_name: { type: String, required: true },
    brand: { type: String, default: null },
    image_url: { type: String, default: null },
    ingredients_text: { type: String, default: null },
    ingredients_list: { type: [String], default: null },
    nutrients_per_100g: { type: NutrientsSchema, default: null },
    nutrients_per_serving: { type: NutrientsSchema, default: null },
    serving_size: { type: String, default: null },
    serving_quantity: { type: Number, default: null },
    nutri_score: { type: String, default: null, enum: ['A', 'B', 'C', 'D', 'E', null] },
    nova_group: { type: Number, enum: [1, 2, 3, 4, null], default: null },
    vegetarian_status: { type: String, enum: ['veg', 'non-veg', 'unknown'], default: 'unknown' },
    allergens_tags: { type: [String], default: [] },
    category: { type: String, default: null, index: true },
    sub_category: { type: String, default: null },
    flagged_additives: { type: [String], default: [] },
    source: { type: String, enum: ['off', 'manual'], required: true },
    contributor_uid:   { type: String, index: true, default: null },
    contributor_email: { type: String, default: null },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    collection: 'products',
    // Disable Mongoose's built-in timestamps so we control the field names exactly
    timestamps: false,
  }
);

// Update `updated_at` on every save
ProductSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
