import os
import re
import pandas as pd
from pymongo import MongoClient
from dotenv import load_dotenv

# Load env variables in case you are using a .env file
load_dotenv()

# Define paths relative to the script's location
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(SCRIPT_DIR, "packaged_foods_india.csv")

# MongoDB connection settings
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = "PacketPeek"
COLLECTION_NAME = "products"

def generate_brand_key(brand: str, item_name: str) -> str:
    """Recreates the exact unique identifier used during the initial DB seed."""
    brand     = (brand     or "").strip()
    item_name = (item_name or "").strip()
    b_lower   = brand.lower()
    i_lower   = item_name.lower()
    combined  = item_name if (b_lower and i_lower.startswith(b_lower)) else f"{brand} {item_name}".strip()
    cleaned   = re.sub(r"[^a-z0-9]+", "_", combined.lower()).strip("_")
    cleaned   = re.sub(r"_+", "_", cleaned)
    return cleaned[:100]

def update_categories():
    if not os.path.exists(CSV_PATH):
        print(f"Error: Could not find {CSV_PATH}.")
        return

    print("Connecting to MongoDB...")
    client = MongoClient(MONGODB_URI)
    collection = client[DB_NAME][COLLECTION_NAME]
    
    print(f"Loading CSV data from {CSV_PATH}...")
    df = pd.read_csv(CSV_PATH)
    
    updated_count = 0
    not_found_count = 0

    for _, row in df.iterrows():
        brand     = str(row.get("Brand_Name", "")).strip()
        item_name = str(row.get("Item name",  "")).strip()

        # Extract categories, converting NaN to None for MongoDB null
        category     = str(row.get("Category",     "")).strip() if pd.notna(row.get("Category"))     else None
        sub_category = str(row.get("Sub_Category", "")).strip() if pd.notna(row.get("Sub_Category")) else None

        # Recreate the deterministic brand_key used during the initial DB seed
        brand_key = generate_brand_key(brand, item_name)

        # Primary match: brand_key (deterministic, indexed)
        result = collection.update_one(
            {"brand_key": brand_key},
            {"$set": {"category": category, "sub_category": sub_category}}
        )

        # Fallback: case-insensitive product_name match for any edge cases
        if result.matched_count == 0:
            safe_name = re.escape(item_name)
            result = collection.update_one(
                {"product_name": {"$regex": f"^{safe_name}$", "$options": "i"}},
                {"$set": {"category": category, "sub_category": sub_category}}
            )

        if result.matched_count > 0:
            updated_count += 1
        else:
            not_found_count += 1
            print(f"  -> No match | brand_key={brand_key!r} | item={item_name!r}")

    print("\n========================================")
    print("      CATEGORY BACKFILL COMPLETE        ")
    print("========================================")
    print(f"✅ Successfully Updated : {updated_count}")
    print(f"❌ Failed to Match      : {not_found_count}")
    print("========================================\n")

if __name__ == "__main__":
    update_categories()