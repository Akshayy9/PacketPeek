"use client";

/**
 * ProductResult.tsx  
 * Translated from Stitch: "PacketPeek - PDP - Master Alignment Edition"
 * Uses CSS variables from globals.css — no hardcoded hex values.
 */

import Image from "next/image";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { IProductData } from "@/app/scan/page";
import HealthyAlternatives from "@/components/HealthyAlternatives";

// react-barcode renders an SVG barcode — SSR disabled to avoid canvas issues
const Barcode = dynamic(() => import("react-barcode"), { ssr: false });

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

type Grade = "A" | "B" | "C" | "D" | "E";

const GRADE_META: Record<Grade, { color: string; bgAlpha: string; label: string; desc: string }> = {
  A: { color: "#1a7a3c", bgAlpha: "rgba(26,122,60,0.1)", label: "Excellent", desc: "Outstanding nutritional profile — a smart, everyday choice." },
  B: { color: "#1a7a3c", bgAlpha: "rgba(26,122,60,0.1)", label: "Good",      desc: "Good nutritional profile — solid for regular consumption." },
  C: { color: "#e07b00", bgAlpha: "rgba(224,123,0,0.1)", label: "Fair",      desc: "Average profile — occasional is fine, not ideal daily." },
  D: { color: "var(--error)", bgAlpha: "rgba(186,26,26,0.08)", label: "Poor", desc: "Consume sparingly — high in problematic nutrients." },
  E: { color: "var(--error)", bgAlpha: "rgba(186,26,26,0.08)", label: "High Risk", desc: "Consume very sparingly — poor across multiple nutritional markers." },
};

function NutrientRow({ label, value, unit, sub = false, highlight = false, warn = false }: {
  label: string; value: number | null; unit: string;
  sub?: boolean; highlight?: boolean; warn?: boolean;
}) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: sub ? "12px 16px 12px 32px" : "14px 16px",
      borderBottom: "1px solid var(--outline-variant)",
      background: highlight ? "rgba(186,26,26,0.04)" : warn ? "rgba(224,123,0,0.04)" : "transparent",
      transition: "background 0.15s",
    }}>
      <span style={{ fontSize: 13, color: "var(--fg)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: highlight ? "var(--error)" : warn ? "#e07b00" : "var(--fg)" }}>
        {value != null ? `${value} ${unit}` : "—"}
      </span>
    </div>
  );
}

interface DonutProps { value: number | null; unit: string; label: string; pct: number; color: string; badge: string; badgeColor: string; }
function MacroDonut({ value, unit, label, pct, color, badge, badgeColor }: DonutProps) {
  const r = 16; const circ = 2 * Math.PI * r;
  const fill = (Math.min(pct, 100) / 100) * circ;
  return (
    <div style={{
      background: "var(--surface)", borderRadius: 14, padding: "20px 16px",
      border: "1px solid var(--outline-variant)", boxShadow: "var(--shadow-card)",
      display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 8,
    }}>
      <div style={{ position: "relative", width: 64, height: 64 }}>
        <svg width="64" height="64" viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="18" cy="18" r={r} fill="none" stroke="var(--surface-variant)" strokeWidth="3.5" />
          <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3.5"
            strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round" />
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, color, fontFamily: "var(--font-mono)",
        }}>
          {value != null ? value : "—"}<span style={{ fontSize: 9 }}>{unit}</span>
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fg)", fontFamily: "var(--font-mono)" }}>{label}</div>
      <div style={{
        fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
        background: badgeColor, color: color,
        fontFamily: "var(--font-mono)", letterSpacing: "0.05em", textTransform: "uppercase",
      }}>{badge}</div>
    </div>
  );
}

export default function ProductResult({ product, onScanAnother }: { product: IProductData; onScanAnother: () => void }) {
  const [productData, setProductData] = useState<IProductData>(product);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isAdditivesExpanded, setIsAdditivesExpanded] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleAnalyze = async () => {
    if (!productData._id) {
      alert("Error: Cannot analyze product because it has no database ID.");
      return;
    }
    setIsAnalyzing(true);
    try {
      const res = await fetch(`${API_URL}/api/product/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: productData._id }),
      });
      if (!res.ok) {
        throw new Error("Failed to analyze product");
      }
      const updatedProduct = await res.json();
      setProductData(updatedProduct);
    } catch (err) {
      console.error(err);
      alert("AI analysis failed. Please check the server logs.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const grade = productData.nutri_score as Grade | null;
  const meta = grade ? GRADE_META[grade] : null;
  const n = productData.nutrients_per_100g;
  const sugarG = n?.sugar_g ?? 0;
  const tsp = Math.round(sugarG / 4);
  const sugarPct = Math.min((sugarG / 25) * 100, 150);
  const fatPct    = n?.fat_g != null ? Math.min((n.fat_g / 70) * 100, 100) : 0;
  const satFatPct = n?.saturated_fat_g != null ? Math.min((n.saturated_fat_g / 20) * 100, 100) : 0;
  const sodPct    = n?.sodium_mg != null ? Math.min((n.sodium_mg / 2300) * 100, 100) : 0;
  const protPct   = n?.protein_g != null ? Math.min((n.protein_g / 50) * 100, 100) : 0;

  const card: React.CSSProperties = {
    background: "var(--surface-container-lowest)", borderRadius: 20,
    padding: 32, boxShadow: "var(--shadow-card)",
  };

  return (
    <div style={{ background: "var(--surface-container-low)", color: "var(--fg)", minHeight: "100vh", fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)" }}>
      <style>{`
        @media (max-width: 767px) {
          [data-nav="product"] { padding: 0 16px !important; }
          [data-desktop-links] { display: none !important; }
          [data-pdp-main] { padding: 80px 16px 48px !important; }
        }
      `}</style>

      {/* Nav */}
      <header data-nav="product" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, height: 64,
        background: "var(--surface)", borderBottom: "1px solid var(--outline-variant)",
        boxShadow: "var(--shadow-card)", display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 48px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 900, color: "var(--primary)", letterSpacing: "-0.04em" }}>PacketPeek</span>
          <div data-desktop-links style={{ display: "flex", gap: 24, fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {["Products", "Categories", "Contribute"].map((t, i) => (
              <a key={t} href="#" style={{
                color: i === 0 ? "var(--primary)" : "var(--on-surface-variant)", textDecoration: "none",
                borderBottom: i === 0 ? "2px solid var(--primary)" : "none", paddingBottom: i === 0 ? 2 : 0,
              }}>{t}</a>
            ))}
          </div>
        </div>
        <span className="material-symbols-outlined" style={{ color: "var(--on-surface-variant)", cursor: "pointer" }}>account_circle</span>
      </header>

      <main data-pdp-main style={{ maxWidth: 1280, margin: "0 auto", padding: "80px 48px 120px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--on-surface-variant)" }}>
          <button onClick={onScanAnother} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--on-surface-variant)", fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.7 }}>Scan</button>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
          {productData.category && <><span style={{ opacity: 0.7 }}>{productData.category}</span><span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span></>}
          <span style={{ fontWeight: 700, color: "var(--primary)" }}>{productData.product_name}</span>
        </div>

        {/* Hero Grid - auto-collapses to 1 col on mobile */}
        <div data-pdp-hero-grid className="pdp-hero-grid" style={{ gap: 16, alignItems: "start", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))" }}>

          {/* Image */}
          <div style={{
            ...card, padding: 0, height: 420, display: "flex", alignItems: "center",
            justifyContent: "center", position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: 12, left: 12, zIndex: 10, background: "rgba(252,249,248,0.85)", backdropFilter: "blur(8px)", padding: "6px 12px", borderRadius: 999, display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--on-surface-variant)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--primary)" }}>verified</span>
              Open Food Facts
            </div>
            {productData.flagged_additives.length > 0 && (
              <div style={{ position: "absolute", bottom: 12, left: 12, zIndex: 10, background: "rgba(186,26,26,0.1)", padding: "6px 12px", borderRadius: 999, display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--error)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
                {productData.flagged_additives.length} Flag{productData.flagged_additives.length > 1 ? "s" : ""}
              </div>
            )}
            {productData.image_url ? (
              <Image src={productData.image_url} alt={productData.product_name} fill style={{ objectFit: "contain", padding: 32 }} sizes="40vw" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: "var(--on-surface-variant)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 80 }}>inventory_2</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>No image available</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div style={{ ...card, minHeight: 420, display: "flex", flexDirection: "column" }}>
            {productData.brand && <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--tertiary-container)", marginBottom: 8 }}>{productData.brand}</div>}
            
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, color: "var(--fg)", lineHeight: 1.2, margin: 0 }}>{productData.product_name}</h1>
              {productData.vegetarian_status === "veg" && (
                <div style={{ flexShrink: 0, width: 24, height: 24, border: "2px solid #16a34a", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", marginTop: 6, borderRadius: 2 }}>
                  <div style={{ width: 12, height: 12, background: "#16a34a", borderRadius: "50%" }} />
                </div>
              )}
              {productData.vegetarian_status === "non-veg" && (
                <div style={{ flexShrink: 0, width: 24, height: 24, border: "2px solid #dc2626", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", marginTop: 6, borderRadius: 2 }}>
                  <div style={{ width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderBottom: "12px solid #dc2626" }} />
                </div>
              )}
            </div>

            {/* Category / sub-category chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--on-surface-variant)", marginBottom: 12 }}>
              {productData.category && <span style={{ background: "var(--surface)", padding: "6px 14px", borderRadius: 999, boxShadow: "var(--shadow-card)" }}>{productData.category}</span>}
              {productData.sub_category && <span style={{ background: "var(--surface)", padding: "6px 14px", borderRadius: 999, boxShadow: "var(--shadow-card)" }}>{productData.sub_category}</span>}
            </div>

            {/* Visual barcode — sits below the chips in the empty space */}
            {/^\d+$/.test(productData.barcode ?? '') && (
              <div style={{
                marginBottom: 28,
                display: "inline-flex", flexDirection: "column", alignItems: "center",
                background: "var(--surface)", borderRadius: 12, padding: "10px 16px",
                border: "1px solid var(--outline-variant)", boxShadow: "var(--shadow-card)",
                alignSelf: "flex-start",
              }}>
                <Barcode
                  value={productData.barcode!}
                  width={1.4}
                  height={48}
                  fontSize={10}
                  margin={0}
                  background="transparent"
                  lineColor="var(--fg, #1c1b1b)"
                  displayValue={false}
                />
                <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", letterSpacing: "0.14em", color: "var(--on-surface-variant)", marginTop: 4 }}>
                  #{productData.barcode}
                </span>
              </div>
            )}


            {/* Health Overview */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: "auto" }}>
              {/* Nutri-Score */}
              {grade && meta ? (
                <div style={{ background: meta.bgAlpha, border: `1.5px solid ${meta.color}`, borderRadius: 16, padding: 16, display: "flex", alignItems: "center", gap: 16, position: "relative", overflow: "hidden" }}>
                  <div style={{
                    flexShrink: 0, width: 48, height: 48, borderRadius: "50%",
                    background: meta.bgAlpha, border: `3px solid ${meta.color}`, color: meta.color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20, fontWeight: 900, fontFamily: "var(--font-display)",
                    boxShadow: "inset 0 2px 6px rgba(0,0,0,0.15)", position: "relative",
                  }}>
                    {grade}
                  </div>
                  <div>
                    <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: "var(--fg)", margin: "0 0 4px 0" }}>Nutri-Score</h3>
                    <p style={{ fontSize: 12, color: "var(--on-surface-variant)", lineHeight: 1.4, margin: 0 }}>{meta.label} nutritional profile.</p>
                  </div>
                </div>
              ) : (
                <div style={{ background: "var(--surface-container-low)", borderRadius: 16, padding: 16, border: "1px solid var(--outline-variant)", display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="material-symbols-outlined" style={{ color: "var(--on-surface-variant)", fontSize: 28 }}>help_outline</span>
                  <div>
                    <h3 style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--fg)", margin: "0 0 2px 0" }}>Nutri-Score</h3>
                    <p style={{ fontSize: 11, color: "var(--on-surface-variant)", margin: 0 }}>Data unavailable</p>
                  </div>
                </div>
              )}

              {/* NOVA Group */}
              {(() => {
                const nova = productData.nova_group;
                let novaColor = "#94a3b8";
                let novaBg = "rgba(148,163,184,0.1)";
                let novaLabel = "Data unavailable";
                let novaDesc = "NOVA group unknown.";
                if (nova === 1) { novaColor = "#1a7a3c"; novaBg = "rgba(26,122,60,0.1)"; novaLabel = "NOVA 1"; novaDesc = "Unprocessed / minimally processed."; }
                if (nova === 2) { novaColor = "#eab308"; novaBg = "rgba(234,179,8,0.1)"; novaLabel = "NOVA 2"; novaDesc = "Processed culinary ingredients."; }
                if (nova === 3) { novaColor = "#e07b00"; novaBg = "rgba(224,123,0,0.1)"; novaLabel = "NOVA 3"; novaDesc = "Processed food."; }
                if (nova === 4) { novaColor = "var(--error)"; novaBg = "rgba(186,26,26,0.08)"; novaLabel = "NOVA 4"; novaDesc = "Ultra-processed food."; }
                
                return nova ? (
                  <div style={{ background: novaBg, border: `1.5px solid ${novaColor}`, borderRadius: 16, padding: 16, display: "flex", alignItems: "center", gap: 16, position: "relative", overflow: "hidden" }}>
                    <div style={{
                      flexShrink: 0, width: 48, height: 48, borderRadius: "50%",
                      background: novaBg, border: `3px solid ${novaColor}`, color: novaColor,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20, fontWeight: 900, fontFamily: "var(--font-display)",
                      boxShadow: "inset 0 2px 6px rgba(0,0,0,0.15)", position: "relative",
                    }}>
                      {nova}
                    </div>
                    <div>
                      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: "var(--fg)", margin: "0 0 4px 0" }}>{novaLabel}</h3>
                      <p style={{ fontSize: 12, color: "var(--on-surface-variant)", lineHeight: 1.4, margin: 0 }}>{novaDesc}</p>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: "var(--surface-container-low)", borderRadius: 16, padding: 16, border: "1px solid var(--outline-variant)", display: "flex", alignItems: "center", gap: 12 }}>
                    <span className="material-symbols-outlined" style={{ color: "var(--on-surface-variant)", fontSize: 28 }}>help_outline</span>
                    <div>
                      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--fg)", margin: "0 0 2px 0" }}>NOVA Group</h3>
                      <p style={{ fontSize: 11, color: "var(--on-surface-variant)", margin: 0 }}>Data unavailable</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Why this verdict */}
        {productData.flagged_additives.length > 0 && (
          <div style={{ ...card, borderLeft: "4px solid var(--tertiary-container)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--tertiary-container)", marginBottom: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
              Why this verdict
            </div>
            <p style={{ fontSize: 14, color: "var(--on-surface-variant)", lineHeight: 1.7 }}>
              This productData contains <strong style={{ color: "var(--fg)" }}>{productData.flagged_additives.length} flagged additive{productData.flagged_additives.length > 1 ? "s" : ""}</strong>: {productData.flagged_additives.join(", ")}.
              {n && (n.sugar_g ?? 0) > 20 && " Added sugar is above WHO recommended daily limits per 100g."}
              {n && (n.saturated_fat_g ?? 0) > 8 && " Saturated fat is high per 100g."}
              {" "}None are dangerous in one serving — the concern is regular, daily consumption.
            </p>
          </div>
        )}

        {/* ⚠️ Child Safety Warning — deterministic rule engine, no LLM */}
        {productData.childSafetyVerdict && productData.childSafetyVerdict.minimumAge > 0 && (
          <div style={{
            ...card,
            borderLeft: "4px solid var(--error)",
            background: "rgba(186,26,26,0.04)",
            border: "1px solid rgba(186,26,26,0.18)",
            borderLeftWidth: 4,
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{
                flexShrink: 0, width: 36, height: 36, borderRadius: "50%",
                background: "rgba(186,26,26,0.1)", border: "2px solid var(--error)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--error)" }}>child_care</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--error)", fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}>
                  ⚠️ Not recommended for children under {productData.childSafetyVerdict.minimumAge} year{productData.childSafetyVerdict.minimumAge > 1 ? "s" : ""}
                </div>
                <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--on-surface-variant)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 2 }}>
                  Deterministic Safety Rule · No AI involved
                </div>
              </div>
            </div>
            {/* Reasons list */}
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              {productData.childSafetyVerdict.reasons.map((reason, i) => (
                <li key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 8,
                  fontSize: 13, color: "var(--on-surface-variant)", lineHeight: 1.6,
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--error)", flexShrink: 0, marginTop: 2 }}>warning</span>
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Details Grid - auto-collapses to 1 col on mobile */}
        <div data-pdp-details-grid className="pdp-details-grid" style={{ gap: 16, alignItems: "start", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))" }}>

          {/* Left: Health Snapshot */}
          <div style={{ ...card, display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 16, borderBottom: "1px solid var(--outline-variant)" }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--fg)", display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>health_metrics</span>
                Health Snapshot
              </h2>
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--on-surface-variant)", opacity: 0.7, letterSpacing: "0.1em", textTransform: "uppercase" }}>Per 100g</span>
            </div>

            {/* Sugar */}
            {n?.sugar_g != null && (
              <section>
                <h3 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--on-surface-variant)", opacity: 0.7, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>cake</span>
                  Sugar Content
                </h3>
                <div style={{ background: "var(--surface)", borderRadius: 14, padding: 20, border: "1px solid var(--outline-variant)", position: "relative" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    {Array.from({ length: Math.min(tsp, 10) }).map((_, i) => (
                      <div key={i} style={{ width: 20, height: 20, background: "var(--error)", borderRadius: 4, boxShadow: "var(--shadow-card)" }} />
                    ))}
                    {tsp > 10 && <span style={{ fontSize: 12, color: "var(--error)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>+{tsp - 10}</span>}
                  </div>
                  <p style={{ fontSize: 13, color: "var(--on-surface-variant)", lineHeight: 1.6, marginBottom: 16 }}>
                    Contains roughly <strong style={{ color: "var(--error)" }}>{tsp}</strong> teaspoon{tsp !== 1 ? "s" : ""} of sugar per 100g — <strong style={{ color: "var(--error)" }}>{n.sugar_g}g</strong>.
                  </p>
                  <div style={{ position: "relative", paddingTop: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--on-surface-variant)", opacity: 0.7, marginBottom: 6 }}>
                      <span>0%</span>
                      <span>WHO Limit ~ 25g</span>
                      <span>150%</span>
                    </div>
                    <div style={{ height: 10, background: "var(--surface-variant)", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(sugarPct, 100)}%`, height: "100%", background: "var(--error)", transition: "width 0.7s ease" }} />
                    </div>
                    <div style={{
                      position: "absolute", top: 0, right: 0,
                      background: "var(--surface)", border: "1px solid rgba(186,26,26,0.2)",
                      padding: "4px 10px", borderRadius: 10, boxShadow: "var(--shadow-card)",
                      display: "flex", flexDirection: "column", alignItems: "center",
                    }}>
                      <span style={{ fontSize: 8, fontFamily: "var(--font-mono)", color: "var(--on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.05em" }}>WHO Daily</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--error)", fontWeight: 700, fontFamily: "var(--font-mono)", fontSize: 13 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>warning</span>
                        {Math.round(sugarPct)}%
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Macro Donuts */}
            {n && (
              <section>
                <h3 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--on-surface-variant)", opacity: 0.7, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>donut_large</span>
                  Macro Breakdown
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {(() => {
                    const satFatVal = n.saturated_fat_g ?? 0;
                    const fatVal    = n.fat_g ?? 0;
                    const sodVal    = n.sodium_mg ?? 0;
                    const protVal   = n.protein_g ?? 0;

                    // colour helpers — "bad" nutrients: low=green, mid=orange, high=red
                    const badColor = (v: number, midThresh: number, highThresh: number) =>
                      v > highThresh ? { color: "var(--error)", bg: "rgba(186,26,26,0.08)", badge: "High" }
                      : v > midThresh ? { color: "#e07b00",     bg: "rgba(224,123,0,0.08)",  badge: "Mod"  }
                      :                 { color: "#1a7a3c",     bg: "rgba(26,122,60,0.08)",   badge: "Low"  };

                    // colour helper — "good" nutrient (protein): low=red, mid=orange, high=green
                    const goodColor = (v: number, midThresh: number, highThresh: number) =>
                      v >= highThresh ? { color: "#1a7a3c", bg: "rgba(26,122,60,0.08)",   badge: "Good" }
                      : v >= midThresh ? { color: "#e07b00", bg: "rgba(224,123,0,0.08)",  badge: "Mod"  }
                      :                  { color: "var(--error)", bg: "rgba(186,26,26,0.08)", badge: "Low" };

                    const sf  = badColor(satFatVal, 5,  10);   // >10 High, 5-10 Mod, <5 Low
                    const fat = badColor(fatVal,    10,  20);  // >20 High, 10-20 Mod, <10 Low
                    const sod = badColor(sodVal,   300, 600);  // >600 High, 300-600 Mod, <300 Low
                    const pro = goodColor(protVal,  8,  15);   // >=15 Good, 8-15 Mod, <8 Low

                    return [
                      { v: n.saturated_fat_g, u: "g",  label: "Saturated Fat", pct: satFatPct, ...sf  },
                      { v: n.fat_g,           u: "g",  label: "Total Fat",      pct: fatPct,    ...fat },
                      { v: n.sodium_mg,       u: "mg", label: "Sodium",         pct: sodPct,    ...sod },
                      { v: n.protein_g,       u: "g",  label: "Protein",        pct: protPct,   ...pro },
                    ].map(({ v, u, label, pct, color, badge, bg }) => (
                      <MacroDonut key={label} value={v} unit={u} label={label} pct={pct} color={color} badge={badge} badgeColor={bg} />
                    ));
                  })()}
                </div>
              </section>
            )}
          </div>

          {/* Right: Ingredients + Facts */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ ...card, display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 16, borderBottom: "1px solid var(--outline-variant)" }}>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--fg)", display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                  <span className="material-symbols-outlined" style={{ color: "var(--error)" }}>science</span>
                  Ingredient Analysis
                </h2>
                
                {productData.ingredients_text && (!productData.nova_group || (!productData.allergens_tags || productData.allergens_tags.length === 0)) && (
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    style={{
                      background: isAnalyzing ? "var(--surface-variant)" : "linear-gradient(135deg, #6366f1, #a855f7)",
                      color: isAnalyzing ? "var(--on-surface-variant)" : "#fff",
                      border: "none", borderRadius: 999, padding: "8px 16px",
                      fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)",
                      cursor: isAnalyzing ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", gap: 6,
                      boxShadow: isAnalyzing ? "none" : "0 4px 12px rgba(99, 102, 241, 0.2)",
                      transition: "all 0.2s"
                    }}
                  >
                    {isAnalyzing ? (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, animation: "spin 1s linear infinite" }}>sync</span>
                        AI is analyzing...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
                        Analyze with AI
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Allergens */}
              {productData.allergens_tags && productData.allergens_tags.length > 0 && (
                <div style={{ background: "rgba(224,123,0,0.05)", border: "1px solid rgba(224,123,0,0.15)", borderRadius: 14, padding: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontFamily: "var(--font-mono)", color: "#e07b00", fontWeight: 700, marginBottom: 14 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>coronavirus</span>
                    Contains {productData.allergens_tags.length} Allergen{productData.allergens_tags.length > 1 ? "s" : ""}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {productData.allergens_tags.map((a) => (
                      <span key={a} style={{
                        background: "var(--surface)", color: "#b45309",
                        fontFamily: "var(--font-mono)", fontSize: 11, padding: "6px 12px",
                        borderRadius: 999, display: "flex", alignItems: "center", gap: 4,
                        border: "1px solid rgba(224,123,0,0.3)", boxShadow: "var(--shadow-card)", fontWeight: 600
                      }}>
                        {a.charAt(0).toUpperCase() + a.slice(1)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Additive Breakdown */}
              {productData.additiveBreakdown && productData.additiveBreakdown.length > 0 && (
                <div style={{ background: "rgba(186,26,26,0.05)", border: "1px solid rgba(186,26,26,0.1)", borderRadius: 14, padding: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--error)", fontWeight: 700 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>
                      {productData.additiveBreakdown.length} additive{productData.additiveBreakdown.length > 1 ? "s" : ""} worth knowing about
                    </div>
                    <button 
                      onClick={() => setIsAdditivesExpanded(!isAdditivesExpanded)}
                      style={{ 
                        background: "none", border: "none", cursor: "pointer", 
                        display: "flex", alignItems: "center", gap: 4, 
                        fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700, 
                        color: "var(--error)", padding: 0 
                      }}
                    >
                      {isAdditivesExpanded ? "Hide Breakdown" : "View Breakdown"}
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                        {isAdditivesExpanded ? "expand_less" : "expand_more"}
                      </span>
                    </button>
                  </div>
                  
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: isAdditivesExpanded ? 16 : 0 }}>
                    {productData.additiveBreakdown.map((additive, i) => (
                      <span key={i} style={{
                        background: "var(--surface-container-lowest)", color: "var(--error)",
                        fontFamily: "var(--font-mono)", fontSize: 10, padding: "6px 12px",
                        borderRadius: 8, display: "flex", alignItems: "center", gap: 4,
                        border: "1px solid rgba(186,26,26,0.1)", boxShadow: "var(--shadow-card)",
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>science</span>
                        {additive.name.split(' (')[0]}
                      </span>
                    ))}
                  </div>

                  {isAdditivesExpanded && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid rgba(186,26,26,0.1)", paddingTop: 16 }}>
                      {productData.additiveBreakdown.map((additive, i) => {
                        const isAvoid = additive.risk_level === "Avoid";
                        const isCaution = additive.risk_level === "Caution";
                        const color = isAvoid ? "var(--error)" : isCaution ? "#e07b00" : "#64748b";
                        const bgColor = isAvoid ? "rgba(186,26,26,0.08)" : isCaution ? "rgba(224,123,0,0.08)" : "rgba(100,116,139,0.08)";
                        const borderColor = isAvoid ? "rgba(186,26,26,0.2)" : isCaution ? "rgba(224,123,0,0.2)" : "rgba(100,116,139,0.2)";

                        return (
                          <div key={i} style={{
                            background: "var(--surface)", border: `1px solid ${borderColor}`,
                            borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 8,
                            boxShadow: "var(--shadow-card)",
                          }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--fg)" }}>{additive.name}</span>
                              <span style={{
                                background: bgColor, color: color, padding: "4px 10px", borderRadius: 999,
                                fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, textTransform: "uppercase"
                              }}>
                                {additive.risk_level}
                              </span>
                            </div>
                            <p style={{ fontSize: 13, color: "var(--on-surface-variant)", lineHeight: 1.5, margin: 0 }}>
                              {additive.long_term_effects}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Ingredient text */}
              {productData.ingredients_text && (
                <div style={{ background: "var(--surface)", borderRadius: 14, padding: 20, border: "1px solid var(--outline-variant)" }}>
                  <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--on-surface-variant)", opacity: 0.7, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Full Ingredient List</div>
                  <p style={{ fontSize: 13, color: "var(--on-surface-variant)", lineHeight: 1.7 }}>
                    {productData.ingredients_list?.length
                      ? productData.ingredients_list.map((ing, i) => {
                          const flagged = productData.flagged_additives.some(f => ing.toLowerCase().includes(f.toLowerCase()));
                          return flagged ? (
                            <strong key={i} style={{ color: "var(--error)", background: "rgba(186,26,26,0.08)", padding: "0 2px", borderRadius: 3 }}>
                              {ing}{i < (productData.ingredients_list?.length ?? 0) - 1 ? ", " : ""}
                            </strong>
                          ) : (
                            <span key={i}>{ing}{i < (productData.ingredients_list?.length ?? 0) - 1 ? ", " : ""}</span>
                          );
                        })
                      : product.ingredients_text}
                  </p>
                </div>
              )}
            </div>

            {/* Nutrient Facts Table */}
            {n && (
              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 16, borderBottom: "1px solid var(--outline-variant)", marginBottom: 0 }}>
                  <h2 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "var(--fg)", display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                    <span className="material-symbols-outlined" style={{ color: "var(--primary)", fontSize: 20 }}>format_list_numbered</span>
                    Full Nutritional Facts
                  </h2>
                  <span style={{ background: "var(--surface-container)", fontFamily: "var(--font-mono)", fontSize: 10, padding: "4px 12px", borderRadius: 999, color: "var(--on-surface-variant)" }}>Per 100g</span>
                </div>
                <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--outline-variant)", marginTop: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", background: "var(--surface-container-low)", borderBottom: "2px solid var(--outline-variant)" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg)", fontFamily: "var(--font-mono)" }}>Nutrition Facts</span>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--on-surface-variant)", fontFamily: "var(--font-mono)" }}>Per 100g</span>
                  </div>
                  <NutrientRow label="Energy" value={n.energy_kcal} unit="kcal" />
                  <NutrientRow label="Protein" value={n.protein_g} unit="g" />
                  <NutrientRow label="Total Fat" value={n.fat_g} unit="g" highlight={(n.fat_g ?? 0) > 20} />
                  <NutrientRow label="↳ Saturated Fat" value={n.saturated_fat_g} unit="g" sub highlight={(n.saturated_fat_g ?? 0) > 8} />
                  <NutrientRow label="Total Sugars" value={n.sugar_g} unit="g" highlight={(n.sugar_g ?? 0) > 20} warn={(n.sugar_g ?? 0) > 10 && (n.sugar_g ?? 0) <= 20} />
                  <NutrientRow label="Sodium" value={n.sodium_mg} unit="mg" warn={(n.sodium_mg ?? 0) > 600} />
                  <NutrientRow label="Fibre" value={n.fibre_g} unit="g" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Healthy Alternatives — RAG-powered section */}
        <HealthyAlternatives barcode={productData.barcode ?? ''} />
      </main>

      {/* Desktop Action Bar */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40, height: 72,
        background: "var(--surface-container)", borderTop: "1px solid var(--outline-variant)",
        padding: "0 48px", display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "var(--shadow-float)",
      }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--on-surface-variant)" }}>{product.barcode}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--on-surface-variant)", opacity: 0.7 }}>
            {product.source === "off" ? "Open Food Facts" : "Manual entry"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 20px",
            borderRadius: 999, border: "1px solid var(--outline-variant)",
            background: "transparent", color: "var(--on-surface-variant)", cursor: "pointer",
            fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>report</span>
            Report incorrect data
          </button>
          <button
            onClick={onScanAnother}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 20px",
              borderRadius: 999, background: "var(--inverse-surface)", color: "var(--inverse-on-surface)",
              border: "none", cursor: "pointer", fontSize: 11,
              fontFamily: "var(--font-mono)", fontWeight: 700, boxShadow: "var(--shadow-card)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>barcode_scanner</span>
            Scan Another
          </button>
        </div>
      </div>
    </div>
  );
}
