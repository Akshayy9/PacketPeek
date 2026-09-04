"use client";

export const runtime = 'edge';

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import type { IProductData } from "@/app/scan/page";
import ProductResult from "@/components/ProductResult";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export default function ProductPage({ params }: { params: Promise<{ barcode: string }> }) {
  const { barcode } = use(params);
  const router = useRouter();
  
  const [product, setProduct] = useState<IProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/product/${barcode}`);
        if (!res.ok) {
          throw new Error("Product not found");
        }
        const data = await res.json();
        setProduct(data.product);
      } catch (err) {
        console.error("Failed to fetch product", err);
        setError("Could not load product. It might not exist in the database.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchProduct();
  }, [barcode]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 40, height: 40, border: "4px solid var(--surface-variant)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 14 }}>Loading product...</span>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, background: "var(--surface)", padding: 48, borderRadius: 16, border: "1px solid var(--outline-variant)" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--error)" }}>error</span>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>Product Not Found</h2>
          <p style={{ color: "var(--on-surface-variant)" }}>{error}</p>
          <button 
            onClick={() => router.push("/scan")}
            style={{ marginTop: 16, padding: "10px 24px", background: "var(--primary)", color: "var(--on-primary)", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
          >
            Go to Scanner
          </button>
        </div>
      </div>
    );
  }

  return (
    <ProductResult 
      product={product} 
      onScanAnother={() => router.push("/scan")} 
    />
  );
}
