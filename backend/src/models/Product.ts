import mongoose, { Document, Schema } from 'mongoose';

export interface INutrientsPer100g {
  energy_kcal: number | null;
  sugar_g: number | null;
  protein_g: number | null;
  fat_g: number | null;
  saturated_fat_g: number | null;
  fibre_g: number | null;
  sodium_mg: number | null;
}

export interface IProduct extends Document {
  barcode: string;
  brand_key: string | null;
  product_name: string;
  brand: string | null;
  image_url: string | null;
  ingredients_text: string | null;
  ingredients_list: string[] | null;
  nutrients_per_100g: INutrientsPer100g | null;
  nutri_score: string | null;
  category: string | null;
  sub_category: string | null;
  source: 'off' | 'manual';
  created_at: Date;
  updated_at: Date;
}

const NutrientsPer100gSchema = new Schema<INutrientsPer100g>(
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
    barcode: { type: String, required: true, unique: true, index: true },
    brand_key: { type: String, default: null },
    product_name: { type: String, required: true },
    brand: { type: String, default: null },
    image_url: { type: String, default: null },
    ingredients_text: { type: String, default: null },
    ingredients_list: { type: [String], default: null },
    nutrients_per_100g: { type: NutrientsPer100gSchema, default: null },
    nutri_score: { type: String, default: null },
    category: { type: String, default: null, index: true },
    sub_category: { type: String, default: null },
    source: { type: String, enum: ['off', 'manual'], required: true },
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
