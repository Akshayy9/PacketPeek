import os
import re
import json
import datetime
import pandas as pd

# Define paths relative to this script's directory
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(SCRIPT_DIR, "packaged_foods_india.csv")
OUTPUT_JSON_PATH = os.path.join(SCRIPT_DIR, "packetpeek_seed_data.json")

def clean_number(val):
    """Safely cleans and casts numeric strings to float or returns None."""
    if pd.isna(val) or val == "" or str(val).strip().lower() in ["nan", "none", "-", "0", "null"]:
        return None
    try:
        cleaned = re.sub(r"[^\d.]", "", str(val))
        return float(cleaned) if cleaned else None
    except (ValueError, TypeError):
        return None

def generate_brand_key(brand: str, item_name: str) -> str:
    """Creates a normalized unique identifier without duplicating the brand name."""
    brand = (brand or "").strip()
    item_name = (item_name or "").strip()
    
    # Prevent brand duplication if the item name already starts with the brand name
    b_lower = brand.lower()
    i_lower = item_name.lower()
    
    if b_lower and i_lower.startswith(b_lower):
        combined = item_name
    else:
        combined = f"{brand} {item_name}".strip()
        
    cleaned = re.sub(r"[^a-z0-9]+", "_", combined.lower()).strip("_")
    # Collapse multiple underscores into one
    cleaned = re.sub(r"_+", "_", cleaned)
    return cleaned[:100]

def split_ingredients_parenthesis_aware(text: str) -> list | None:
    """
    Splits an ingredient text on commas or semicolons only when outside
    of parentheses (), brackets [], or curly braces {}.
    """
    if not text or pd.isna(text) or not isinstance(text, str):
        return None

    items = []
    current = []
    paren_depth = bracket_depth = brace_depth = 0

    for char in text:
        if char == '(': paren_depth += 1
        elif char == ')': paren_depth = max(0, paren_depth - 1)
        elif char == '[': bracket_depth += 1
        elif char == ']': bracket_depth = max(0, bracket_depth - 1)
        elif char == '{': brace_depth += 1
        elif char == '}': brace_depth = max(0, brace_depth - 1)

        # Split ONLY if we are at depth 0
        if char in (',', ';') and paren_depth == 0 and bracket_depth == 0 and brace_depth == 0:
            token = "".join(current).strip()
            if token:
                items.append(token)
            current = []
        else:
            current.append(char)

    # Catch the final token
    last_token = "".join(current).strip()
    if last_token:
        items.append(last_token)

    # Clean up whitespace and stray punctuation
    cleaned_items = []
    for item in items:
        item = re.sub(r"\s+", " ", item).strip(" .,-")
        if item:
            cleaned_items.append(item)

    return cleaned_items if cleaned_items else None

def process_dataset():
    if not os.path.exists(CSV_PATH):
        print(f"Error: Could not find {CSV_PATH}. Make sure it is in the data-scripts folder.")
        return

    print(f"Loading {CSV_PATH}...")
    df = pd.read_csv(CSV_PATH)

    mongo_documents = []
    current_time = datetime.datetime.now(datetime.timezone.utc).isoformat()

    for _, row in df.iterrows():
        brand = str(row.get("Brand_Name", "")).strip() if pd.notna(row.get("Brand_Name")) else ""
        item_name = str(row.get("Item name", "")).strip()
        raw_ingredients = str(row.get("Ingredients", "")).strip() if pd.notna(row.get("Ingredients")) else None
        
        brand_key = generate_brand_key(brand, item_name)
        
        doc = {
            "barcode": f"manual_{brand_key}",
            "brand_key": brand_key,
            "product_name": item_name,
            "brand": brand if brand else None,
            "image_url": None,
            "ingredients_text": raw_ingredients,
            "ingredients_list": split_ingredients_parenthesis_aware(raw_ingredients),
            "nutrients_per_100g": {
                "energy_kcal": clean_number(row.get("Calories_kcal")),
                "sugar_g": clean_number(row.get("Sugar_g")),
                "protein_g": clean_number(row.get("Proteins_g")),
                "fat_g": clean_number(row.get("Total_Fat_g")),
                "saturated_fat_g": clean_number(row.get("Saturated_Fat_g")),
                "fibre_g": clean_number(row.get("Dietary_Fiber_g")),
                "sodium_mg": clean_number(row.get("Sodium_mg")),
            },
            "nutri_score": "unknown",
            "source": "manual",
            "created_at": current_time,
            "updated_at": current_time
        }
        mongo_documents.append(doc)

    with open(OUTPUT_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(mongo_documents, f, indent=2, ensure_ascii=False)

    print(f"Successfully processed {len(mongo_documents)} products for PacketPeek.")
    print(f"Saved clean data to: {OUTPUT_JSON_PATH}")

if __name__ == "__main__":
    process_dataset()