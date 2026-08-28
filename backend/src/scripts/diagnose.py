"""
Diagnostic script: compare DB product_name/brand_key values to CSV Item name values.
"""
import os, re
import pandas as pd
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(SCRIPT_DIR, "packaged_foods_india.csv")
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = "packetpeek_db"
COLLECTION_NAME = "products"

client = MongoClient(MONGODB_URI)
collection = client[DB_NAME][COLLECTION_NAME]

print("=" * 60)
print("SAMPLE DB DOCUMENTS (first 5)")
print("=" * 60)
for doc in collection.find({}, {"_id": 0, "barcode": 1, "product_name": 1, "brand": 1, "brand_key": 1, "source": 1}).limit(5):
    print(doc)

print("\n" + "=" * 60)
print("SAMPLE CSV ROWS (first 5)")
print("=" * 60)
df = pd.read_csv(CSV_PATH)
print("Columns:", df.columns.tolist())
for _, row in df.head(5).iterrows():
    print({"Brand_Name": row.get("Brand_Name"), "Item name": row.get("Item name"), "Category": row.get("Category")})

sample_item = str(df.iloc[0].get("Item name", "")).strip()
sample_brand = str(df.iloc[0].get("Brand_Name", "")).strip()

print("\n" + "=" * 60)
print(f"SEARCHING DB FOR: {repr(sample_item)}")
print("=" * 60)
exact = collection.find_one({"product_name": sample_item}, {"_id": 0, "barcode": 1, "product_name": 1})
print(f"  Exact match       : {exact}")
ci = collection.find_one({"product_name": {"$regex": f"^{re.escape(sample_item)}$", "$options": "i"}}, {"_id": 0, "barcode": 1, "product_name": 1})
print(f"  Case-insensitive  : {ci}")
sub = collection.find_one({"product_name": {"$regex": re.escape(sample_item), "$options": "i"}}, {"_id": 0, "barcode": 1, "product_name": 1})
print(f"  Substring match   : {sub}")

def generate_brand_key(brand, item_name):
    brand = (brand or "").strip()
    item_name = (item_name or "").strip()
    b_lower = brand.lower()
    i_lower = item_name.lower()
    combined = item_name if (b_lower and i_lower.startswith(b_lower)) else f"{brand} {item_name}".strip()
    cleaned = re.sub(r"[^a-z0-9]+", "_", combined.lower()).strip("_")
    return re.sub(r"_+", "_", cleaned)[:100]

bk = generate_brand_key(sample_brand, sample_item)
print(f"\nGenerated brand_key: {repr(bk)}")
bk_match = collection.find_one({"brand_key": bk}, {"_id": 0, "barcode": 1, "product_name": 1, "brand_key": 1})
print(f"brand_key match    : {bk_match}")

has_bk = collection.count_documents({"brand_key": {"$exists": True, "$ne": None}})
total  = collection.count_documents({})
print(f"\nTotal docs : {total}")
print(f"With brand_key: {has_bk}")

print("\n" + "=" * 60)
print("SAMPLE brand_key + product_name FROM DB")
print("=" * 60)
for doc in collection.find({"brand_key": {"$exists": True, "$ne": None}}, {"_id": 0, "brand_key": 1, "product_name": 1}).limit(5):
    print(doc)
