"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import ProductResult from "@/components/ProductResult";
import ProductCapture from "@/components/ProductCapture";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

const BarcodeScanner = dynamic(() => import("@/components/BarcodeScanner"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 text-on-surface-variant text-sm">
      Initialising camera…
    </div>
  ),
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export interface IProductData {
  _id?: string;
  barcode: string;
  brand_key: string | null;
  product_name: string;
  brand: string | null;
  image_url: string | null;
  ingredients_text: string | null;
  ingredients_list: string[] | null;
  nutrients_per_100g: {
    energy_kcal: number | null;
    sugar_g: number | null;
    protein_g: number | null;
    fat_g: number | null;
    saturated_fat_g: number | null;
    fibre_g: number | null;
    sodium_mg: number | null;
  } | null;
  nutri_score: "A" | "B" | "C" | "D" | "E" | null;
  nova_group?: 1 | 2 | 3 | 4 | null;
  vegetarian_status?: "veg" | "non-veg" | "unknown";
  allergens_tags?: string[];
  category: string | null;
  sub_category: string | null;
  flagged_additives: string[];
  source: "off" | "manual";
  // ── Child-safety inputs ──────────────────────────────────────────────────
  added_sugar_g?: number | null;
  has_honey?: boolean | null;
  has_artificial_sweeteners?: boolean | null;
  artificial_colors?: string[] | null;
  childSafetyVerdict?: {
    isRecommended: boolean;
    minimumAge: number;
    reasons: string[];
  } | null;
}

type ScanState = "idle" | "scanning" | "loading" | "found" | "not_found" | "error" | "adding_product";

export default function ScanPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [lastBarcode, setLastBarcode] = useState<string | null>(null);
  const [product, setProduct] = useState<IProductData | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
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

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [searchResults, setSearchResults] = useState<IProductData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchCache = useRef(new Map<string, IProductData[]>());

  // OCR Scanner State
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrPreview, setOcrPreview] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<IProductData | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const ocrInputRef = useRef<HTMLInputElement>(null);

  const handleOcrFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrFile(file);
    setOcrResult(null);
    setOcrError(null);
    const url = URL.createObjectURL(file);
    setOcrPreview(url);
  };

  const handleOcrSubmit = async () => {
    if (!ocrFile || !user) return;
    setOcrLoading(true);
    setOcrError(null);
    setOcrResult(null);
    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append("image", ocrFile);
      const res = await fetch(`${API_URL}/api/products/analyze-image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? `Server error ${res.status}`);
      }
      const data = await res.json();
      setOcrResult(data.product);
    } catch (err: any) {
      setOcrError(err.message);
    } finally {
      setOcrLoading(false);
    }
  };

  const resetOcr = () => {
    setOcrFile(null);
    setOcrPreview(null);
    setOcrResult(null);
    setOcrError(null);
    if (ocrInputRef.current) ocrInputRef.current.value = "";
  };

  useEffect(() => {
    const query = debouncedSearchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    if (searchCache.current.has(query)) {
      setSearchResults(searchCache.current.get(query)!);
      return;
    }

    const fetchSearch = async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`${API_URL}/api/product/search/query?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        searchCache.current.set(query, data);
        setSearchResults(data);
      } catch (err) {
        console.error("Search error", err);
      } finally {
        setIsSearching(false);
      }
    };

    fetchSearch();
  }, [debouncedSearchQuery]);

  const handleScan = useCallback(async (barcode: string) => {
    setLastBarcode(barcode);
    setScanState("loading");
    setProduct(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/product/${barcode}`);
      const data = await res.json();
      if (!res.ok || !data.found) {
        setErrorMsg(data.error ?? "Product not found in our database.");
        setScanState("not_found");
      } else {
        setProduct(data.product as IProductData);
        setScanState("found");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
      setScanState("error");
    }
  }, []);

  const handleReset = () => {
    setProduct(null);
    setLastBarcode(null);
    setCameraError(null);
    setErrorMsg(null);
    setScanState("scanning");
  };

  const handleStart = () => {
    setCameraError(null);
    setScanState("scanning");
  };

  if (scanState === "found" && product) {
    return <ProductResult product={product} onScanAnother={handleReset} />;
  }

  return (
    <div data-page="scan" style={{ 
      zoom: 0.9, color: "#1c1b1b", minHeight: "100vh", fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)", position: "relative",
      backgroundImage: "url('/website_background_4k_transparent.jpg')",
      backgroundSize: "100% auto",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "center -150px",
    }}>
      
      {/* Floating Animations + Mobile Overrides */}
      <style>{`
        @keyframes float-icon {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        @media (max-width: 767px) {
          .hero-inner { flex-direction: column !important; align-items: center !important; gap: 32px !important; }
          .category-cards { grid-template-columns: 1fr !important; }
          [data-nav="scan"] { padding: 0 16px !important; }
          [data-desktop-links] { display: none !important; }
          [data-hamburger] { display: flex !important; }
          [data-floating-icons] { display: none !important; }
          [data-hero] { padding: 24px 16px 32px !important; }
          [data-hero-title] { font-size: 36px !important; }
          [data-scanner-col] { max-width: 320px !important; flex: none !important; }
          [data-text-col] { width: 100% !important; align-items: center !important; text-align: center !important; }
          [data-ocr-section] { padding: 32px 16px 48px !important; }
          [data-category-grid-section] { padding: 48px 16px !important; }
        }
      `}</style>

      {/* Background Image Layer applied to parent div */}

      {/* Floating Background Icons (Spaced far out to the edges of the white space, away from text) */}
      <div data-floating-icons style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1000, overflow: "hidden", zIndex: 0, pointerEvents: "none" }}>
        {[
          // High up, middle (above text)
          { icon: "cookie", top: "10%", left: "52%", size: 65, delay: 2.7, duration: 8.5 },
          // High up, right side
          { icon: "local_cafe", top: "15%", right: "18%", size: 55, delay: 2.9, duration: 6.8 },
          
          // Mid-height, pushed as far right as possible before hitting the yellow edge
          { icon: "local_pizza", top: "45%", right: "12%", size: 80, delay: 0.8, duration: 9 },
          
          // Very low down, right side (below search bar)
          { icon: "set_meal", top: "82%", right: "22%", size: 60, delay: 1.9, duration: 7.5 },
          // Very low down, middle (underneath search bar)
          { icon: "ramen_dining", top: "85%", left: "52%", size: 75, delay: 1.7, duration: 8.2 },
        ].map((item, i) => (
          <span 
            key={i} 
            className="material-symbols-outlined" 
            style={{ 
              position: "absolute", 
              top: item.top, 
              left: item.left, 
              right: item.right, 
              fontSize: item.size, 
              color: "#aaa", // Darker gray to stand out more
              opacity: 0.35, // Increased visibility
              animation: `float-icon ${item.duration}s ease-in-out infinite`,
              animationDelay: `${item.delay}s`
            }}
          >
            {item.icon}
          </span>
        ))}
      </div>

      {/* ── Top Nav ──────────────────────────────────────────────────────── */}
      <nav data-nav="scan" style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 50, height: 80,
        background: "transparent",
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        padding: "0 48px",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#111" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 32, fontWeight: 800 }}>barcode_scanner</span>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, letterSpacing: "-0.02em" }}>
            PacketPeek
          </div>
        </div>

          {/* Right: Auth-Aware Action Group */}
          <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
            <div data-desktop-links style={{ display: "flex", gap: 36, fontSize: 17, fontWeight: 700, alignItems: "center" }}>
              <a href="/scan" style={{ color: "var(--primary)", textDecoration: "none", borderBottom: "2px solid var(--primary)", paddingBottom: 4 }}>Scan</a>
              {/* Categories Dropdown */}
              <div style={{ position: "relative" }}
                onMouseEnter={e => { const d = e.currentTarget.querySelector("[data-dropdown]") as HTMLElement; if(d) d.style.display = "block"; }}
                onMouseLeave={e => { const d = e.currentTarget.querySelector("[data-dropdown]") as HTMLElement; if(d) d.style.display = "none"; }}
              >
                <span style={{ color: "#1c1b1b", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
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
                    <a key={label} href={`/category/${encodeURIComponent(label)}`} style={{ display: "block", padding: "9px 18px", textDecoration: "none", fontSize: 13, fontWeight: 600, color: "var(--on-surface-variant)", transition: "background 0.15s", fontFamily: "var(--font-body)" }}
                      onMouseOver={e => { e.currentTarget.style.background = "var(--surface-container-low)"; e.currentTarget.style.color = "var(--primary)"; }}
                      onMouseOut={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--on-surface-variant)"; }}
                    >
                      {label}
                    </a>
                  ))}
                  </div>
                </div>
              </div>
              <a href="/contributions" style={{ color: "#111", fontWeight: 700, textDecoration: "none" }}>My Contributions</a>
            </div>

            {authLoading ? (
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#ede8e6", animation: "pulse 1.5s ease-in-out infinite" }} />
            ) : user ? (
              /* ── Authenticated: Avatar + Dropdown ── */
              <div ref={dropdownRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setDropdownOpen(o => !o)}
                  style={{
                    width: 40, height: 40, borderRadius: "50%",
                    border: "2px solid #E06000",
                    overflow: "hidden", cursor: "pointer",
                    padding: 0, background: "#f6f3f2",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 2px 8px rgba(224,96,0,0.25)",
                  }}
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} referrerPolicy="no-referrer" />
                  ) : (
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#E06000", textTransform: "uppercase", fontFamily: "var(--font-display)" }}>
                      {(user.displayName || user.email || "U").charAt(0)}
                    </span>
                  )}
                </button>

                {/* Dropdown */}
                {dropdownOpen && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 10px)", right: 0,
                    background: "#fff", border: "1px solid #ede8e6",
                    borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
                    minWidth: 200, zIndex: 100, overflow: "hidden",
                  }}>
                    <div style={{ padding: "14px 16px", borderBottom: "1px solid #f0eded" }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#1c1b1b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {user.displayName || "User"}
                      </div>
                      <div style={{ fontSize: 12, color: "#887362", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {user.email}
                      </div>
                    </div>
                    <a href="/contributions" style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", textDecoration: "none", fontSize: 14, fontWeight: 600, color: "#1c1b1b" }}>
                      My Contributions
                    </a>
                    <button
                      onClick={async () => { await logout(); setDropdownOpen(false); }}
                      style={{
                        width: "100%", padding: "12px 16px", background: "none",
                        border: "none", borderTop: "1px solid #f0eded", textAlign: "left", cursor: "pointer",
                        fontSize: 14, fontWeight: 600, color: "#ba1a1a",
                        display: "flex", alignItems: "center", gap: 8,
                        fontFamily: "var(--font-body)",
                        transition: "background 0.15s",
                      }}
                      onMouseOver={e => e.currentTarget.style.background = "#fff5f5"}
                      onMouseOut={e => e.currentTarget.style.background = "none"}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* ── Guest: Sign In Button ── */
              <a
                href="/login"
                style={{
                  backgroundColor: "#E06000", color: "#fff",
                  textDecoration: "none", borderRadius: "10px",
                  padding: "9px 20px", fontSize: "14px", fontWeight: 700,
                  fontFamily: "var(--font-body)",
                  boxShadow: "0 4px 14px -4px rgba(224,96,0,0.45)",
                  whiteSpace: "nowrap",
                }}
              >
                Sign In
              </a>
            )}
          <button data-hamburger onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ display: "none", alignItems: "center", justifyContent: "center", width: 44, height: 44, background: "none", border: "none", cursor: "pointer", color: "#111" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 28 }}>{mobileMenuOpen ? 'close' : 'menu'}</span>
          </button>
          </div>
        </nav>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div data-mobile-menu style={{
            position: "fixed", top: 80, left: 0, right: 0, background: "#fdfaf8",
            borderBottom: "1px solid #ede8e6", boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
            zIndex: 40, display: "flex", flexDirection: "column", padding: 24, gap: 24,
          }}>
            <a href="/scan" style={{ fontWeight: 700, fontSize: 17, color: "var(--primary)", textDecoration: "none" }}>Scan</a>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#1c1b1b" }}>Categories</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingLeft: 16, borderLeft: "2px solid #ede8e6" }}>
              {["Biscuits", "Cold Drinks", "Snacks", "Chocolates"].map((label) => (
                <a key={label} href={`/category/${encodeURIComponent(label)}`} style={{ fontSize: 15, fontWeight: 600, color: "#555", textDecoration: "none" }}>{label}</a>
              ))}
            </div>
            <a href="/contributions" style={{ fontWeight: 700, fontSize: 17, color: "#111", textDecoration: "none" }}>My Contributions</a>
          </div>
        )}

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <main style={{ display: "flex", flexDirection: "column", paddingTop: 100 }}>
        
        {/* ── Hero Section ─────────────────────────────────────────────── */}
        <section data-hero style={{ 
          padding: "80px 48px 80px", 
          position: "relative",
          display: "flex",
          justifyContent: "center",
        }}>
          <div data-hero-inner className="hero-inner" style={{ maxWidth: 1200, width: "100%", gap: isMobile ? 32 : 64, display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: "center" }}>
            
            {/* Left: Scanner Mockup */}
            <div data-scanner-col style={{ flex: 1, display: "flex", justifyContent: "center", position: "relative" }}>
              
              <div style={{ 
                width: "100%", maxWidth: 400, background: "#111", // Dark phone-like bezel
                borderRadius: 40, padding: 12, boxShadow: "0 32px 64px rgba(0,0,0,0.3)",
                border: "4px solid #333", zIndex: 1,
                position: "relative", overflow: "hidden", height: 540
              }}>
                {/* Scanner Interface */}
                {scanState === "idle" && (
                  <div 
                    onClick={handleStart}
                    style={{
                      height: "100%", background: "rgba(255,255,255,0.9)", borderRadius: 28,
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", transition: "all 0.2s"
                    }} 
                    onMouseOver={e => (e.currentTarget.style.background = "#fff")} 
                    onMouseOut={e => (e.currentTarget.style.background = "rgba(255,255,255,0.9)")}
                  >
                    <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#ff6600", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, boxShadow: "0 8px 24px rgba(255, 102, 0, 0.4)" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 40, color: "white" }}>barcode_scanner</span>
                    </div>
                    <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: "#111", margin: "0 0 8px" }}>Tap to Scan</p>
                    <p style={{ color: "#444", margin: 0, textAlign: "center", padding: "0 20px", fontWeight: 500 }}>Point your camera at any food barcode to reveal the truth.</p>
                  </div>
                )}

                {/* ── Camera error ── */}
                {cameraError && (
                  <div style={{ background: '#fef2f2', borderRadius: 28, padding: 24, height: "100%" }}>
                    <strong style={{ color: '#dc2626' }}>Camera error:</strong>
                    <p style={{ margin: '4px 0 0', color: '#7f1d1d', fontSize: 14 }}>{cameraError}</p>
                  </div>
                )}

                {/* ── Scanner ── */}
                {scanState === 'scanning' && (
                  <div style={{ height: "100%", borderRadius: 28, overflow: "hidden", background: "#000" }}>
                    <BarcodeScanner
                      onScan={handleScan}
                      onError={(msg) => { setCameraError(msg); setScanState('idle'); }}
                      active={scanState === 'scanning'}
                    />
                  </div>
                )}

                {/* ── Loading ── */}
                {scanState === "loading" && (
                  <div style={{ height: "100%", background: "rgba(255, 255, 255, 0.95)", borderRadius: 28, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
                    <div style={{ width: 64, height: 64, borderRadius: "50%", border: "6px solid #ff6600", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
                    <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: "#111", margin: 0 }}>Scanning...</p>
                  </div>
                )}

                {/* ── Not found ── */}
                {scanState === 'not_found' && (
                  <div style={{ background: '#fffbeb', borderRadius: 28, padding: 24, height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <p style={{ fontSize: 20, margin: 0, fontWeight: 700 }}>Product not found</p>
                    <p style={{ color: '#78350f', margin: '8px 0 24px', fontSize: 14 }}>
                      Barcode <code>{lastBarcode}</code> is not in our database yet.
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <button onClick={handleReset} style={{ padding: "12px 24px", background: "#ff6600", color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>Scan another</button>
                      {user && (
                        <button onClick={() => setScanState('adding_product')} style={{ padding: "12px 24px", background: "transparent", color: "#ff6600", border: "2px solid #ff6600", borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>Add this product</button>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Adding Product ── */}
                {scanState === 'adding_product' && (
                  <div style={{ background: '#fff', borderRadius: 28, padding: 24, height: "100%", display: "flex", flexDirection: "column", overflowY: "auto" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <p style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>Add Product</p>
                      <button onClick={() => setScanState('not_found')} style={{ background: "none", border: "none", cursor: "pointer", color: "#666" }}>
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>
                    <ProductCapture 
                      barcode={lastBarcode || undefined} 
                      onSuccess={(barcode) => handleScan(barcode)} 
                    />
                  </div>
                )}

                {/* ── Error ── */}
                {scanState === 'error' && (
                  <div style={{ background: '#fef2f2', borderRadius: 28, padding: 24, height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <p style={{ fontSize: 20, margin: 0, fontWeight: 700 }}>❌ Error</p>
                    <p style={{ color: '#7f1d1d', margin: '8px 0 24px', fontSize: 14 }}>{errorMsg}</p>
                    <button onClick={handleReset} style={{ padding: "12px 24px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>Try again</button>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Typography & Search */}
            <div data-text-col style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start", position: "relative", zIndex: 10 }}>
              <h1 data-hero-title style={{
                fontFamily: "var(--font-display)", fontSize: 64, fontWeight: 900, lineHeight: 1.05,
                color: "#111", marginBottom: 24, letterSpacing: "-0.04em"
              }}>
                Unveil What&apos;s <br />
                Inside Your Food <br />
                instantly.
              </h1>
              <p style={{ color: "#333", fontSize: 20, lineHeight: 1.6, maxWidth: 480, marginBottom: 40, fontWeight: 600 }}>
                PacketPeek scans, analyzes, and decodes ingredients from any food product.
              </p>

              <div style={{ position: "relative", width: "100%", maxWidth: 500, display: "flex", flexDirection: "column", zIndex: 20 }}>
                <div style={{ display: "flex", background: "white", borderRadius: searchResults.length > 0 ? "16px 16px 0 0" : 16, overflow: "hidden", boxShadow: "0 12px 32px rgba(0,0,0,0.15)", position: "relative" }}>
                  <span className="material-symbols-outlined" style={{ position: "absolute", left: 16, top: 20, color: "#666", fontSize: 22, pointerEvents: "none" }}>search</span>
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      flex: 1, padding: "20px 16px 20px 52px", fontSize: 16,
                      border: "none", outline: "none", background: "transparent", color: "#111",
                      fontWeight: 600
                    }}
                    placeholder="Search thousands of foods..."
                  />
                  <button
                    onClick={() => {
                      if (searchResults.length > 0) {
                        setProduct(searchResults[0]);
                        setScanState("found");
                        setSearchQuery("");
                        setSearchResults([]);
                      }
                    }}
                    style={{
                      padding: "0 28px", background: "#111", color: "white",
                      border: "none", fontSize: 15, fontWeight: 700,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                      transition: "background 0.2s"
                    }}
                    onMouseOver={e => e.currentTarget.style.background = "#ff6600"}
                    onMouseOut={e => e.currentTarget.style.background = "#111"}
                  >
                    {isSearching ? "..." : "Search"}
                  </button>
                </div>

                {/* Dropdown Results */}
                {searchResults.length > 0 && (
                  <div style={{ 
                    position: "absolute", top: "100%", left: 0, right: 0, 
                    background: "white", borderTop: "1px solid #eee", 
                    borderRadius: "0 0 16px 16px", boxShadow: "0 12px 32px rgba(0,0,0,0.15)",
                    maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column"
                  }}>
                    {searchResults.map((item) => (
                      <div 
                        key={item.barcode} 
                        onClick={() => {
                          setProduct(item);
                          setScanState("found");
                          setSearchQuery("");
                          setSearchResults([]);
                        }}
                        style={{
                          padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
                          cursor: "pointer", borderBottom: "1px solid #f5f5f5", transition: "background 0.2s"
                        }}
                        onMouseOver={e => e.currentTarget.style.background = "#fff8f0"}
                        onMouseOut={e => e.currentTarget.style.background = "transparent"}
                      >
                        <div style={{ width: 40, height: 40, background: "#eee", borderRadius: 8, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.product_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#999" }}>fastfood</span>
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, color: "#111", fontSize: 15 }}>{item.product_name}</div>
                          {item.brand && <div style={{ fontSize: 12, color: "#666" }}>{item.brand}</div>}
                        </div>
                        {item.nutri_score && (
                          <div style={{ 
                            padding: "4px 8px", borderRadius: 4, fontWeight: 800, fontSize: 12,
                            background: item.nutri_score === "A" || item.nutri_score === "B" ? "#dcfce7" : item.nutri_score === "C" ? "#fef08a" : "#fee2e2",
                            color: item.nutri_score === "A" || item.nutri_score === "B" ? "#166534" : item.nutri_score === "C" ? "#854d0e" : "#991b1b"
                          }}>
                            {item.nutri_score.toUpperCase()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
          </div>
        </section>

        {/* ── OCR AI Scanner Section ─────────────────────────── */}
        <section data-ocr-section style={{ padding: "160px 48px 80px", display: "flex", justifyContent: "center", position: "relative", zIndex: 1 }}>
          <div style={{ maxWidth: 1200, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 52, fontWeight: 900, color: "#111", margin: "0 0 12px", letterSpacing: "-0.02em" }}>
                AI Ingredient Scanner
              </h2>
              <p style={{ color: "#554334", fontSize: 18, margin: 0, fontWeight: 600 }}>
                Take a photo of any food packaging and let AI analyze it instantly.
              </p>
            </div>

            {user ? (
              /* ── Authenticated: Full OCR Scanner ── */
              <div style={{
                width: "100%", maxWidth: 600,
                background: "#fff", borderRadius: 20,
                border: "1px solid #ede8e6",
                boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
                overflow: "hidden",
              }}>
                {/* Header row */}
                <div style={{ padding: "24px 28px 20px", borderBottom: "1px solid #f0eded", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 26, color: "#E06000" }}>photo_camera</span>
                    <span style={{ fontWeight: 800, fontSize: 17, fontFamily: "var(--font-display)", color: "#1c1b1b" }}>AI Image Analyzer</span>
                  </div>
                  <span style={{ fontSize: 12, color: "#887362", background: "#f6f3f2", padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>
                    {user.displayName || user.email}
                  </span>
                </div>

                <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Upload Zone */}
                  {!ocrPreview ? (
                    <label
                      htmlFor="ocr-upload"
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        gap: 12, width: "100%", minHeight: 200,
                        border: "2px dashed #E06000", borderRadius: 14, cursor: "pointer",
                        background: "#fff9f5", transition: "background 0.2s", boxSizing: "border-box",
                      }}
                      onMouseOver={e => e.currentTarget.style.background = "#fff3eb"}
                      onMouseOut={e => e.currentTarget.style.background = "#fff9f5"}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 52, color: "#E06000", opacity: 0.75 }}>add_photo_alternate</span>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontWeight: 700, color: "#E06000", fontSize: 15 }}>Click to Upload Image</div>
                        <div style={{ fontSize: 12, color: "#887362", marginTop: 4 }}>JPG, PNG or WEBP • Max 10MB</div>
                      </div>
                      <input
                        id="ocr-upload"
                        ref={ocrInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        style={{ display: "none" }}
                        onChange={handleOcrFileChange}
                      />
                    </label>
                  ) : (
                    /* Preview */
                    <div style={{ position: "relative", width: "100%", borderRadius: 14, overflow: "hidden", border: "1.5px solid #ede8e6" }}>
                      <img
                        src={ocrPreview}
                        alt="Selected product"
                        style={{ width: "100%", maxHeight: 320, objectFit: "contain", background: "#f6f3f2", display: "block" }}
                      />
                      {/* File name + change button */}
                      <div style={{ padding: "10px 14px", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #f0eded" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#E06000" }}>image</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#1c1b1b", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ocrFile?.name}</span>
                        </div>
                        <button
                          onClick={resetOcr}
                          style={{ background: "none", border: "1px solid #dbc2ae", borderRadius: 7, padding: "4px 12px", fontSize: 12, fontWeight: 700, color: "#887362", cursor: "pointer" }}
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {ocrError && (
                    <div style={{ background: "#fff0f0", border: "1px solid #fcc", borderRadius: 10, padding: "12px 16px", color: "#ba1a1a", fontSize: 13, fontWeight: 600 }}>
                      ⚠️ {ocrError}
                    </div>
                  )}

                  {/* Result card */}
                  {ocrResult && (
                    <div style={{ background: "#f6fff8", border: "1.5px solid #86efac", borderRadius: 14, padding: "16px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 18 }}>✅</span>
                        <span style={{ fontWeight: 800, fontSize: 15, color: "#166534" }}>Analysis Complete!</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: "#1c1b1b", marginBottom: 4 }}>{ocrResult.product_name}</div>
                      {ocrResult.brand && <div style={{ fontSize: 13, color: "#887362", marginBottom: 8 }}>{ocrResult.brand}</div>}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {ocrResult.nutri_score && (
                          <span style={{ background: "#dcfce7", color: "#166534", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 800 }}>Nutri-Score {ocrResult.nutri_score}</span>
                        )}
                        {ocrResult.nova_group && (
                          <span style={{ background: "#fff3eb", color: "#9a3412", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 800 }}>NOVA {ocrResult.nova_group}</span>
                        )}
                      </div>
                      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                        <button
                          onClick={resetOcr}
                          style={{ flex: 1, background: "#fff", border: "1px solid #ede8e6", borderRadius: 8, padding: "8px", fontSize: 13, fontWeight: 700, color: "#554334", cursor: "pointer" }}
                        >
                          Scan Another
                        </button>
                        <a
                          href="/contributions"
                          style={{ flex: 1, textAlign: "center", background: "#E06000", color: "#fff", borderRadius: 8, padding: "8px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}
                        >
                          View My Contributions
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Analyse button (only when file picked and no result yet) */}
                  {ocrFile && !ocrResult && (
                    <button
                      onClick={handleOcrSubmit}
                      disabled={ocrLoading}
                      style={{
                        width: "100%", background: ocrLoading ? "#dbc2ae" : "#E06000", color: "#fff",
                        border: "none", borderRadius: 12, padding: "15px",
                        fontSize: 15, fontWeight: 700, cursor: ocrLoading ? "not-allowed" : "pointer",
                        boxShadow: ocrLoading ? "none" : "0 6px 18px -4px rgba(224,96,0,0.45)",
                        fontFamily: "var(--font-body)", transition: "all 0.2s",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                      }}
                    >
                      {ocrLoading ? (
                        <>
                          <div style={{ width: 18, height: 18, border: "2.5px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                          Analyzing Image…
                        </>
                      ) : (
                        <>✦ Analyze with AI</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* ── Guest: Sign In Prompt Inside Upload Zone ── */
              <div style={{
                width: "100%", maxWidth: 600,
                background: "#fff", borderRadius: 20,
                border: "1px solid #ede8e6",
                boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
                overflow: "hidden",
              }}>
                {/* Header row */}
                <div style={{ padding: "24px 28px 20px", borderBottom: "1px solid #f0eded", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 26, color: "#E06000" }}>photo_camera</span>
                    <span style={{ fontWeight: 800, fontSize: 17, fontFamily: "var(--font-display)", color: "#1c1b1b" }}>AI Image Analyzer</span>
                  </div>
                </div>

                <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Guest Dotted Upload Zone */}
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    gap: 12, width: "100%", minHeight: 200,
                    border: "2px dashed #E06000", borderRadius: 14,
                    background: "#fff9f5", boxSizing: "border-box", textAlign: "center", padding: "24px"
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 44, color: "#E06000", opacity: 0.6 }}>lock</span>
                    <div>
                      <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "#1c1b1b", margin: "0 0 4px" }}>
                        Sign in to add the products
                      </h3>
                      <p style={{ color: "#887362", fontSize: 13, margin: 0 }}>
                        You must be logged in to upload images and use the AI Scanner.
                      </p>
                    </div>
                    <a
                      href="/login"
                      style={{
                        background: "#E06000", color: "#fff",
                        textDecoration: "none", borderRadius: 10,
                        padding: "10px 24px", fontSize: 14, fontWeight: 700,
                        fontFamily: "var(--font-body)",
                        display: "flex", alignItems: "center", gap: 8,
                        marginTop: 4
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>login</span>
                      Sign In
                    </a>
                  </div>

                  <div style={{ width: "100%", height: 48, background: "#f6f3f2", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "#b8aaa0", fontWeight: 700, fontSize: 15 }}>
                    ✦ Analyze with AI
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Browse by Category ────────────────────────────── */}
        <section data-category-grid-section style={{ padding: "100px 48px", background: "#fcf9f8", display: "flex", justifyContent: "center", position: "relative", zIndex: 1, borderTop: "1px solid rgba(0,0,0,0.05)" }}>
          <div style={{ maxWidth: 1200, width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 40 }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 800, color: "#1c1b1b", margin: 0, letterSpacing: "-0.02em" }}>Browse by Category</h2>
              <a href="#" style={{ color: "var(--primary)", fontSize: 16, fontWeight: 700, textDecoration: "none" }}>View All</a>
            </div>
            
            <div data-category-cards className="category-cards" style={{ gap: 24, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)" }}>
              {[
                { label: "Biscuits", img: "/images/biscuits.jpg", bg: "#e8dcd0" },
                { label: "Cold Drinks", img: "/images/drinks.jpg", bg: "#f3d9b1" },
                { label: "Snacks", img: "/images/snacks.jpg", bg: "#ffcca8" },
                { label: "Chocolates", img: "/images/chocolates.jpg", bg: "#e3dad3" },
              ].map(({ label, img, bg }) => (
                <a key={label} href={`/category/${encodeURIComponent(label)}`} style={{
                  textDecoration: "none", display: "flex", flexDirection: "column",
                  position: "relative",
                  transition: "transform 0.2s", overflow: "visible",
                  filter: "drop-shadow(0 16px 24px rgba(0,0,0,0.08))"
                }}
                onMouseOver={e => e.currentTarget.style.transform = "translateY(-8px)"}
                onMouseOut={e => e.currentTarget.style.transform = "translateY(0)"}
                >
                  {/* Image Area */}
                  <div style={{ 
                    height: 240, background: bg, borderRadius: "8px 8px 0 0", 
                    display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative", overflow: "hidden"
                  }}>
                    <img src={img} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.3s" }} 
                         onMouseOver={e => e.currentTarget.style.transform = "scale(1.05)"}
                         onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
                    />
                  </div>
                  
                  {/* Middle Torn Edge */}
                  <div style={{ position: "absolute", top: 240, left: 0, right: 0, height: 16, background: "#fff", clipPath: "polygon(0% 100%, 4% 15%, 8% 85%, 12% 10%, 16% 95%, 20% 5%, 24% 80%, 28% 20%, 32% 90%, 36% 15%, 40% 85%, 44% 5%, 48% 95%, 52% 20%, 56% 80%, 60% 10%, 64% 90%, 68% 15%, 72% 85%, 76% 5%, 80% 95%, 84% 20%, 88% 80%, 92% 10%, 96% 90%, 100% 100%)", marginTop: -15, zIndex: 2 }} />

                  {/* Details Area */}
                  <div style={{ 
                    padding: "32px 24px 40px", background: "#fff", 
                    clipPath: "polygon(0 0, 100% 0, 100% 95%, 96% 100%, 92% 92%, 88% 100%, 84% 94%, 80% 100%, 76% 91%, 72% 98%, 68% 92%, 64% 100%, 60% 93%, 56% 99%, 52% 94%, 48% 100%, 44% 91%, 40% 98%, 36% 93%, 32% 100%, 28% 92%, 24% 99%, 20% 93%, 16% 100%, 12% 92%, 8% 98%, 4% 94%, 0 100%)",
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center"
                  }}>
                    <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: "#111", margin: 0, lineHeight: 1.2 }}>
                      {label}
                    </h3>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
