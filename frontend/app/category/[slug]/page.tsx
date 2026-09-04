"use client";

export const runtime = 'edge';

import { useEffect, useState, useCallback, use, useRef } from "react";
import Image from "next/image";
import type { IProductData } from "@/app/scan/page";
import { useAuth } from "@/context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

type Grade = "A" | "B" | "C" | "D" | "E";

const GRADE_META: Record<Grade, { color: string; bgAlpha: string }> = {
  A: { color: "#1a7a3c", bgAlpha: "rgba(26,122,60,0.1)" },
  B: { color: "#1a7a3c", bgAlpha: "rgba(26,122,60,0.1)" },
  C: { color: "#e07b00", bgAlpha: "rgba(224,123,0,0.1)" },
  D: { color: "var(--error)", bgAlpha: "rgba(186,26,26,0.08)" },
  E: { color: "var(--error)", bgAlpha: "rgba(186,26,26,0.08)" },
};

export default function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const categoryName = decodeURIComponent(slug);
  
  const { user, loading: authLoading, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const [products, setProducts] = useState<IProductData[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async (pageNum: number) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/product/category/${encodeURIComponent(categoryName)}?page=${pageNum}&limit=12`);
      const data = await res.json();
      
      if (pageNum === 1) {
        setProducts(data.products || []);
      } else {
        setProducts(prev => [...prev, ...(data.products || [])]);
      }
      setHasMore(data.hasMore);
    } catch (err) {
      console.error("Failed to fetch products", err);
    } finally {
      setLoading(false);
    }
  }, [categoryName]);

  useEffect(() => {
    setPage(1);
    fetchProducts(1);
  }, [fetchProducts]);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchProducts(nextPage);
    }
  };

  return (
    <div style={{ background: "var(--bg)", color: "var(--fg)", minHeight: "100vh", fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)" }}>
      {/* ── Top Nav ──────────────────────────────────────────────────────── */}
      <nav data-nav="category" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, height: 68,
        background: "var(--surface)", borderBottom: "1px solid var(--outline-variant)",
        boxShadow: "var(--shadow-card)", display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 48px",
        fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
      }}>
        {/* Logo */}
        <a href="/scan" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: "var(--primary)", fontWeight: 700 }}>barcode_scanner</span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 22, letterSpacing: "-0.03em", color: "var(--on-surface)" }}>PacketPeek</span>
        </a>

        {/* Nav links */}
        <div data-desktop-links style={{ display: "flex", alignItems: "center", gap: 36, fontSize: 16, fontWeight: 700 }}>
          <a href="/scan" style={{ color: "var(--on-surface-variant)", textDecoration: "none" }}>Scan</a>
          {/* Categories Dropdown */}
          <div style={{ position: "relative" }}
            onMouseEnter={e => { const d = e.currentTarget.querySelector("[data-dropdown]") as HTMLElement; if(d) d.style.display = "block"; }}
            onMouseLeave={e => { const d = e.currentTarget.querySelector("[data-dropdown]") as HTMLElement; if(d) d.style.display = "none"; }}
          >
            <span style={{ color: "var(--primary)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, borderBottom: "2px solid var(--primary)", paddingBottom: 4 }}>
              Categories
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
            <div data-dropdown style={{ display: "none", position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", paddingTop: 8, background: "transparent", zIndex: 200, minWidth: 180 }}>
              <div style={{ background: "var(--surface)", border: "1px solid var(--outline-variant)", borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,0.12)", overflow: "hidden", padding: "6px 0" }}>
              {[
                "Biscuits",
                "Cold Drinks",
                "Snacks",
                "Chocolates",
              ].map((label) => (
                <a key={label} href={`/category/${encodeURIComponent(label)}`} style={{ display: "block", padding: "9px 18px", textDecoration: "none", fontSize: 13, fontWeight: 600, color: label === categoryName ? "var(--primary)" : "var(--on-surface-variant)", transition: "background 0.15s", fontFamily: "var(--font-body)", backgroundColor: label === categoryName ? "var(--surface-container-low)" : "transparent" }}
                  onMouseOver={e => { e.currentTarget.style.background = "var(--surface-container-low)"; e.currentTarget.style.color = "var(--primary)"; }}
                  onMouseOut={e => { e.currentTarget.style.background = label === categoryName ? "var(--surface-container-low)" : "transparent"; e.currentTarget.style.color = label === categoryName ? "var(--primary)" : "var(--on-surface-variant)"; }}
                >
                  {label}
                </a>
              ))}
              </div>
            </div>
          </div>
          <a href="/contributions" style={{ color: "var(--on-surface-variant)", textDecoration: "none" }}>My Contributions</a>
        </div>

        {/* Auth Area */}
        {authLoading ? (
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface-container)" }} />
        ) : user ? (
          <div ref={dropdownRef} style={{ position: "relative" }}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid var(--primary)", overflow: "hidden", cursor: "pointer", padding: 0, background: "var(--surface-container-low)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(255,102,0,0.2)" }}
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} referrerPolicy="no-referrer" />
              ) : (
                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", fontFamily: "var(--font-display)" }}>
                  {(user.displayName || user.email || "U").charAt(0)}
                </span>
              )}
            </button>
            {dropdownOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 10px)", right: 0, background: "var(--surface)", border: "1px solid var(--outline-variant)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", minWidth: 200, zIndex: 100, overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--outline-variant)" }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--on-surface)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.displayName || "User"}</div>
                  <div style={{ fontSize: 12, color: "var(--on-surface-variant)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
                </div>
                <a href="/contributions" style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", textDecoration: "none", fontSize: 14, fontWeight: 600, color: "var(--on-surface)" }}>My Contributions</a>
                <button
                  onClick={async () => { await logout(); setDropdownOpen(false); }}
                  style={{ width: "100%", padding: "12px 16px", background: "none", border: "none", borderTop: "1px solid var(--outline-variant)", textAlign: "left", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--error)", display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-body)" }}
                  onMouseOver={e => e.currentTarget.style.background = "var(--error-container)"}
                  onMouseOut={e => e.currentTarget.style.background = "none"}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <a href="/login" style={{ backgroundColor: "var(--primary)", color: "#fff", textDecoration: "none", borderRadius: 10, padding: "9px 20px", fontSize: 14, fontWeight: 700, fontFamily: "var(--font-body)", boxShadow: "0 4px 14px -4px rgba(255,102,0,0.45)", whiteSpace: "nowrap" }}>Sign In</a>
        )}
        <button data-hamburger onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ display: "none", alignItems: "center", justifyContent: "center", width: 44, height: 44, background: "none", border: "none", cursor: "pointer", color: "var(--on-surface)" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 26 }}>{mobileMenuOpen ? 'close' : 'menu'}</span>
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div data-mobile-menu style={{
          position: "fixed", top: 68, left: 0, right: 0, background: "var(--surface)",
          borderBottom: "1px solid var(--outline-variant)", boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
          zIndex: 40, display: "flex", flexDirection: "column", padding: 24, gap: 24,
        }}>
          <a href="/scan" style={{ fontWeight: 700, fontSize: 17, color: "var(--on-surface-variant)", textDecoration: "none" }}>Scan</a>
          <div style={{ fontWeight: 700, fontSize: 17, color: "var(--primary)" }}>Categories</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingLeft: 16, borderLeft: "2px solid var(--outline-variant)" }}>
            {["Biscuits", "Cold Drinks", "Snacks", "Chocolates"].map((label) => (
              <a key={label} href={`/category/${encodeURIComponent(label)}`} style={{ fontSize: 15, fontWeight: 600, color: "var(--on-surface-variant)", textDecoration: "none" }}>{label}</a>
            ))}
          </div>
          <a href="/contributions" style={{ fontWeight: 700, fontSize: 17, color: "var(--on-surface-variant)", textDecoration: "none" }}>My Contributions</a>
        </div>
      )}

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <main data-cat-main style={{ maxWidth: 1200, margin: "0 auto", padding: "100px 48px 120px", display: "flex", flexDirection: "column", gap: 32 }}>
        
        {/* Breadcrumbs */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--on-surface-variant)" }}>
          <a href="/scan" style={{ textDecoration: "none", color: "var(--on-surface-variant)", opacity: 0.7 }}>Home</a>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
          <span style={{ opacity: 0.7 }}>Categories</span>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
          <span style={{ fontWeight: 700, color: "var(--primary)" }}>{categoryName}</span>
        </div>

        {/* Category Header & Controls */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 24, marginBottom: 16 }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 700, lineHeight: 1.2, color: "var(--fg)", marginBottom: 12, letterSpacing: "-0.025em" }}>
              {categoryName}
            </h1>
            <p style={{ color: "var(--on-surface-variant)", fontSize: 16, lineHeight: 1.6, maxWidth: 640, margin: 0 }}>
              Compare nutritional profiles and health grades across popular {categoryName.toLowerCase()} brands. Make informed choices for your daily consumption.
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ display: "flex", background: "var(--surface-container-low)", border: "1px solid var(--outline-variant)", borderRadius: 8, padding: 4 }}>
              <button style={{ padding: "8px 16px", borderRadius: 6, background: "var(--surface)", boxShadow: "var(--shadow-card)", color: "var(--primary)", border: "1px solid var(--outline-variant)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>All</button>
              <button style={{ padding: "8px 16px", borderRadius: 6, background: "transparent", color: "var(--on-surface-variant)", border: "none", fontSize: 14, cursor: "pointer" }}>Grade A-B</button>
              <button style={{ padding: "8px 16px", borderRadius: 6, background: "transparent", color: "var(--on-surface-variant)", border: "none", fontSize: 14, cursor: "pointer" }}>Sugar Free</button>
            </div>
          </div>
        </div>

        {/* Product Grid */}
        <div data-product-grid className="category-product-grid" style={{ display: "grid", gap: 16, gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {products.map((p, idx) => {
            const grade = p.nutri_score as Grade | null;
            const meta = grade ? GRADE_META[grade] : null;
            const n = p.nutrients_per_100g;

            return (
              <a key={idx} href={`/product/${p.barcode}`} style={{
                background: "var(--surface)", borderRadius: 16, border: "1px solid var(--outline-variant)",
                overflow: "hidden", display: "flex", flexDirection: "column", position: "relative",
                boxShadow: "var(--shadow-card)", transition: "transform 0.2s, box-shadow 0.2s",
                cursor: "pointer", textDecoration: "none", color: "inherit"
              }}
              onMouseOver={e => { (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-4px)"; (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 12px 24px rgba(0,0,0,0.08)"; }}
              onMouseOut={e => { (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLAnchorElement).style.boxShadow = "var(--shadow-card)"; }}
              >
                {/* Grade Badge */}
                {grade && meta && (
                  <div style={{ position: "absolute", top: 12, right: 12, zIndex: 10 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: "50%", background: meta.bgAlpha,
                      border: `2px solid var(--surface)`, color: meta.color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18, fontWeight: 800, fontFamily: "var(--font-display)",
                      boxShadow: "var(--shadow-card)",
                    }}>{grade}</div>
                  </div>
                )}
                
                {/* Image */}
                <div style={{ height: 180, background: "var(--surface-container-low)", position: "relative", padding: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {p.image_url ? (
                    <Image src={p.image_url} alt={p.product_name} fill style={{ objectFit: "contain", padding: 16 }} sizes="300px" />
                  ) : (
                    <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--on-surface-variant)", opacity: 0.5 }}>inventory_2</span>
                  )}
                </div>

                {/* Details */}
                <div style={{ padding: 16, flexGrow: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--primary)" }}>{p.brand || "Unknown"}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--on-surface-variant)", background: "var(--surface-container)", padding: "2px 6px", borderRadius: 4 }}>100g ref</span>
                  </div>
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "var(--fg)", marginBottom: 12, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {p.product_name}
                  </h3>
                  
                  {/* Mini nutrients */}
                  <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--surface-container-high)", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 8, background: (n?.sugar_g ?? 0) > 20 ? "rgba(186,26,26,0.05)" : "var(--surface-container-low)", borderRadius: 8, color: (n?.sugar_g ?? 0) > 20 ? "var(--error)" : "inherit" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.8, textTransform: "uppercase" }}>Sugar</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600 }}>{n?.sugar_g ?? "-"}g</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 8, background: (n?.fat_g ?? 0) > 20 ? "rgba(186,26,26,0.05)" : "var(--surface-container-low)", borderRadius: 8, color: (n?.fat_g ?? 0) > 20 ? "var(--error)" : "inherit" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.8, textTransform: "uppercase" }}>Fat</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600 }}>{n?.fat_g ?? "-"}g</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 8, background: (n?.protein_g ?? 0) > 10 ? "rgba(26,122,60,0.05)" : "var(--surface-container-low)", borderRadius: 8, color: (n?.protein_g ?? 0) > 10 ? "#1a7a3c" : "inherit" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.8, textTransform: "uppercase" }}>Protein</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600 }}>{n?.protein_g ?? "-"}g</span>
                    </div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
        
        {/* Empty State */}
        {!loading && products.length === 0 && (
          <div style={{ textAlign: "center", padding: 48, background: "var(--surface-container-lowest)", borderRadius: 16, border: "1px solid var(--outline-variant)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--on-surface-variant)", marginBottom: 16 }}>search_off</span>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "var(--fg)" }}>No products found</h3>
            <p style={{ color: "var(--on-surface-variant)" }}>We haven&apos;t scanned any products in this category yet.</p>
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
            <button 
              onClick={handleLoadMore} 
              disabled={loading}
              style={{
                padding: "12px 32px", borderRadius: 8, border: "2px solid var(--primary)",
                color: "var(--primary)", background: "transparent", fontWeight: 600, fontSize: 15,
                cursor: loading ? "wait" : "pointer", transition: "all 0.2s",
                opacity: loading ? 0.7 : 1
              }}
              onMouseOver={e => { if(!loading) { (e.currentTarget as HTMLButtonElement).style.background = "var(--primary)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--on-primary)"; } }}
              onMouseOut={e => { if(!loading) { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--primary)"; } }}
            >
              {loading ? "Loading..." : `Load More ${categoryName}`}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
