"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

interface Nutrient {
  energy_kcal?: number | null;
  sugar_g?: number | null;
  protein_g?: number | null;
  fat_g?: number | null;
}

interface Contribution {
  _id: string;
  barcode?: string;
  product_name: string;
  brand?: string | null;
  image_url?: string | null;
  nutri_score?: string | null;
  nova_group?: number | null;
  ingredients_text?: string | null;
  allergens_tags?: string[];
  flagged_additives?: string[];
  vegetarian_status?: string;
  created_at: string;
}

interface EditState {
  barcode: string;
  product_name: string;
  image_url: string;
}

const NUTRI_COLORS: Record<string, { bg: string; text: string }> = {
  A: { bg: "#dcfce7", text: "#166534" },
  B: { bg: "#d1fae5", text: "#065f46" },
  C: { bg: "#fef9c3", text: "#854d0e" },
  D: { bg: "#ffedd5", text: "#9a3412" },
  E: { bg: "#fee2e2", text: "#991b1b" },
};

export default function ContributionsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const [products, setProducts] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit modal state
  const [editTarget, setEditTarget] = useState<Contribution | null>(null);
  const [editForm, setEditForm] = useState<EditState>({
    barcode: "", product_name: "", image_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Fetch contributions ────────────────────────────────────────────────────
  const fetchContributions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${API_URL}/api/product/contributions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setProducts(data.products ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!authLoading && user) {
      fetchContributions();
    }
  }, [authLoading, user, router, fetchContributions]);

  // ── Open edit modal ────────────────────────────────────────────────────────
  const openEdit = (p: Contribution) => {
    setEditTarget(p);
    setSaveError(null);
    setEditForm({
      barcode: p.barcode ?? "",
      product_name: p.product_name,
      image_url: p.image_url ?? "",
    });
  };

  // ── Save edits ─────────────────────────────────────────────────────────────
  const saveEdit = async () => {
    if (!user || !editTarget) return;
    setSaving(true);
    setSaveError(null);
    try {
      const token = await user.getIdToken();
      const body: Record<string, any> = {
        barcode: editForm.barcode || undefined,
        product_name: editForm.product_name,
        image_url: editForm.image_url || null,
      };
      const res = await fetch(`${API_URL}/api/product/${editTarget._id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? `Error ${res.status}`);
      }
      const data = await res.json();
      setProducts((prev) =>
        prev.map((p) => (p._id === editTarget._id ? { ...p, ...data.product } : p))
      );
      setEditTarget(null);
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  // ── Loading / auth states ──────────────────────────────────────────────────
  if (authLoading || (loading && !error)) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#fafafa" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 40, height: 40, border: "3px solid #ede8e6", borderTopColor: "#E06000", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: "#887362", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14 }}>Loading contributions…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#fafafa", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`
        @media (max-width: 767px) {
          .contrib-stats { flex-direction: column !important; }
          .contrib-grid  { grid-template-columns: 1fr !important; }
          [data-contrib-header] { padding: 0 16px !important; height: auto !important; min-height: 56px !important; flex-wrap: wrap !important; padding-top: 10px !important; padding-bottom: 10px !important; }
        }
      `}</style>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header data-contrib-header style={{
        backgroundColor: "#fff", borderBottom: "1px solid #ede8e6",
        padding: "0 48px", height: 64, display: "flex", alignItems: "center",
        justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => router.back()}
            style={{ background: "none", border: "1.5px solid #ede8e6", borderRadius: 8, padding: "5px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#554334" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            Back
          </button>
          <div style={{ width: 1, height: 20, backgroundColor: "#ede8e6", margin: "0 4px" }} />
          <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 20, color: "#1c1b1b", margin: 0, letterSpacing: "-0.02em" }}>
            My Contributions
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Avatar" style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #E06000", objectFit: "cover" }} referrerPolicy="no-referrer" />
          ) : (
            <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#fff3eb", border: "2px solid #E06000", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: "#E06000" }}>
              {(user?.displayName || user?.email || "U").charAt(0).toUpperCase()}
            </div>
          )}
          <span style={{ fontSize: 13, fontWeight: 600, color: "#554334" }}>{user?.displayName || user?.email}</span>
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px 80px" }}>
        {/* Stats row */}
        <div data-contrib-stats className="contrib-stats" style={{ display: "flex", gap: 16, marginBottom: 40, flexDirection: isMobile ? "column" : "row" }}>
          {[
            { label: "Total Contributions", value: products.length, icon: "inventory_2" },
            { label: "With Nutri-Score", value: products.filter(p => p.nutri_score).length, icon: "grade" },
            { label: "With Ingredients", value: products.filter(p => p.ingredients_text).length, icon: "description" },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: "#fff", border: "1px solid #ede8e6", borderRadius: 16, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#fff3eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 22, color: "#E06000" }}>{s.icon}</span>
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#1c1b1b", lineHeight: 1, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "#887362", marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: "#fff0f0", border: "1px solid #fcc", borderRadius: 12, padding: "14px 18px", color: "#ba1a1a", fontSize: 14, marginBottom: 24 }}>
            {error} — <button onClick={fetchContributions} style={{ background: "none", border: "none", color: "#E06000", fontWeight: 700, cursor: "pointer", padding: 0 }}>Retry</button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && products.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 64, color: "#dbc2ae" }}>inventory_2</span>
            <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 24, fontWeight: 800, color: "#1c1b1b", margin: 0 }}>No contributions yet</h2>
            <p style={{ color: "#887362", fontSize: 15, margin: 0 }}>Use the AI Scanner to analyze a product image and it will appear here.</p>
            <a href="/scan" style={{ backgroundColor: "#E06000", color: "#fff", textDecoration: "none", borderRadius: 10, padding: "11px 24px", fontSize: 14, fontWeight: 700, boxShadow: "0 6px 18px -4px rgba(224,96,0,0.4)" }}>
              Go to Scanner
            </a>
          </div>
        )}

        {/* Product grid */}
        {products.length > 0 && (
          <div data-contrib-grid className="contrib-grid" style={{ display: "grid", gap: 20, gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {products.map((p) => {
              const nc = p.nutri_score ? NUTRI_COLORS[p.nutri_score.toUpperCase()] : null;
              return (
                <div
                  key={p._id}
                  style={{ background: "#fff", border: "1px solid #ede8e6", borderRadius: 18, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column" }}
                >
                  {/* Product image */}
                  <div style={{ height: 160, background: "#f6f3f2", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.product_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span className="material-symbols-outlined" style={{ fontSize: 56, color: "#dbc2ae" }}>fastfood</span>
                    )}
                    {nc && (
                      <div style={{ position: "absolute", top: 10, right: 10, backgroundColor: nc.bg, color: nc.text, borderRadius: 6, padding: "3px 10px", fontWeight: 800, fontSize: 13, border: `1px solid ${nc.text}33` }}>
                        {p.nutri_score?.toUpperCase()}
                      </div>
                    )}
                    {p.nova_group && (
                      <div style={{ position: "absolute", top: 10, left: 10, backgroundColor: "rgba(0,0,0,0.6)", color: "#fff", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700 }}>
                        NOVA {p.nova_group}
                      </div>
                    )}
                  </div>

                  {/* Card body */}
                  <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <h3 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 16, color: "#1c1b1b", margin: 0, lineHeight: 1.3 }}>{p.product_name}</h3>
                    {p.brand && <p style={{ fontSize: 13, color: "#887362", margin: 0, fontWeight: 600 }}>{p.brand}</p>}
                    <p style={{ fontSize: 11, color: "#bbb", margin: 0 }}>Added {formatDate(p.created_at)}</p>
                    {p.barcode && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14, color: "#887362" }}>barcode</span>
                        <span style={{ fontSize: 12, color: "#554334", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{p.barcode}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div style={{ padding: "12px 18px", borderTop: "1px solid #f6f3f2" }}>
                    <button
                      onClick={() => openEdit(p)}
                      style={{ width: "100%", background: "#fff3eb", border: "1.5px solid #E06000", color: "#E06000", borderRadius: 10, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s" }}
                      onMouseOver={e => { e.currentTarget.style.backgroundColor = "#E06000"; e.currentTarget.style.color = "#fff"; }}
                      onMouseOut={e => { e.currentTarget.style.backgroundColor = "#fff3eb"; e.currentTarget.style.color = "#E06000"; }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Edit Modal ─────────────────────────────────────────────────────── */}
      {editTarget && (
        <div
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setEditTarget(null); }}
        >
          <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            {/* Modal header */}
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f0eded", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 18, fontWeight: 800, color: "#1c1b1b", margin: 0 }}>Edit Product</h2>
              <button onClick={() => setEditTarget(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#887362", display: "flex" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Form */}
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              {saveError && (
                <div style={{ background: "#fff0f0", border: "1px solid #fcc", borderRadius: 10, padding: "10px 14px", color: "#ba1a1a", fontSize: 13 }}>{saveError}</div>
              )}

              {/* Photo URL */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#554334", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>Photo URL</label>
                {editForm.image_url && (
                  <img src={editForm.image_url} alt="preview" style={{ width: "100%", height: 140, objectFit: "contain", background: "#f6f3f2", borderRadius: 10, marginBottom: 8 }} />
                )}
                <input
                  type="url"
                  value={editForm.image_url}
                  onChange={e => setEditForm(prev => ({ ...prev, image_url: e.target.value }))}
                  placeholder="https://…"
                  style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px", background: "#f6f3f2", border: "1.5px solid transparent", borderRadius: 10, fontSize: 14, color: "#1c1b1b", outline: "none", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  onFocus={e => { e.target.style.background = "#fff"; e.target.style.borderColor = "rgba(224,96,0,0.4)"; e.target.style.boxShadow = "0 0 0 3px rgba(224,96,0,0.07)"; }}
                  onBlur={e => { e.target.style.background = "#f6f3f2"; e.target.style.borderColor = "transparent"; e.target.style.boxShadow = "none"; }}
                />
              </div>

              {/* Product Name */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#554334", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>Product Name *</label>
                <input
                  type="text"
                  value={editForm.product_name}
                  onChange={e => setEditForm(prev => ({ ...prev, product_name: e.target.value }))}
                  placeholder="e.g. Haldiram Aloo Bhujia"
                  style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px", background: "#f6f3f2", border: "1.5px solid transparent", borderRadius: 10, fontSize: 14, color: "#1c1b1b", outline: "none", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  onFocus={e => { e.target.style.background = "#fff"; e.target.style.borderColor = "rgba(224,96,0,0.4)"; e.target.style.boxShadow = "0 0 0 3px rgba(224,96,0,0.07)"; }}
                  onBlur={e => { e.target.style.background = "#f6f3f2"; e.target.style.borderColor = "transparent"; e.target.style.boxShadow = "none"; }}
                />
              </div>

              {/* Barcode */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#554334", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>Barcode (EAN)</label>
                <input
                  type="text"
                  value={editForm.barcode}
                  onChange={e => setEditForm(prev => ({ ...prev, barcode: e.target.value }))}
                  placeholder="e.g. 8901072004017"
                  style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px", background: "#f6f3f2", border: "1.5px solid transparent", borderRadius: 10, fontSize: 14, color: "#1c1b1b", outline: "none", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  onFocus={e => { e.target.style.background = "#fff"; e.target.style.borderColor = "rgba(224,96,0,0.4)"; e.target.style.boxShadow = "0 0 0 3px rgba(224,96,0,0.07)"; }}
                  onBlur={e => { e.target.style.background = "#f6f3f2"; e.target.style.borderColor = "transparent"; e.target.style.boxShadow = "none"; }}
                />
              </div>
            </div>

            {/* Modal footer */}
            <div style={{ padding: "16px 24px 24px", display: "flex", gap: 10 }}>
              <button
                onClick={() => setEditTarget(null)}
                style={{ flex: 1, padding: "12px", background: "#f6f3f2", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, color: "#554334", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving || !editForm.product_name.trim()}
                style={{ flex: 2, padding: "12px", background: saving ? "#dbc2ae" : "#E06000", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", boxShadow: saving ? "none" : "0 6px 18px -4px rgba(224,96,0,0.4)", transition: "all 0.15s" }}
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-weight: normal; font-style: normal;
          font-size: 24px; line-height: 1;
          letter-spacing: normal; text-transform: none;
          display: inline-block; white-space: nowrap;
          -webkit-font-smoothing: antialiased;
        }
      `}</style>
    </div>
  );
}
