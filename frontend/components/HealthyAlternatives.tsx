"use client";

/**
 * HealthyAlternatives.tsx
 * Fetches 3 RAG-powered healthier alternatives for a given product barcode
 * and renders them in a card row that matches the PacketPeek design system.
 */

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface Alternative {
  name: string;
  barcode: string;
  image: string;
  reason_why: string;
}

/* ─── Skeleton Card ─────────────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div
      style={{
        minWidth: 220,
        flex: "0 0 220px",
        background: "var(--surface-container-lowest)",
        borderRadius: 20,
        border: "1px solid var(--outline-variant)",
        overflow: "hidden",
        animation: "pp-pulse 1.6s ease-in-out infinite",
      }}
    >
      <div style={{ height: 160, background: "var(--surface-variant)" }} />
      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ height: 14, borderRadius: 8, background: "var(--surface-variant)", width: "70%" }} />
        <div style={{ height: 11, borderRadius: 8, background: "var(--surface-variant)", width: "90%" }} />
        <div style={{ height: 11, borderRadius: 8, background: "var(--surface-variant)", width: "60%" }} />
      </div>
    </div>
  );
}

/* ─── Alternative Card ──────────────────────────────────────────────────────── */
function AlternativeCard({ alt }: { alt: Alternative }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);

  const handleClick = () => {
    if (alt.barcode) router.push(`/product/${alt.barcode}`);
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minWidth: 220,
        flex: "0 0 220px",
        background: "var(--surface-container-lowest)",
        borderRadius: 20,
        border: hovered ? "1.5px solid var(--primary)" : "1px solid var(--outline-variant)",
        overflow: "hidden",
        cursor: alt.barcode ? "pointer" : "default",
        boxShadow: hovered
          ? "0 8px 32px rgba(0, 98, 153, 0.15)"
          : "var(--shadow-card)",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        transition: "all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Product image */}
      <div
        style={{
          height: 160,
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Healthier badge */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            zIndex: 10,
            background: "rgba(26,122,60,0.92)",
            backdropFilter: "blur(6px)",
            color: "#fff",
            fontSize: 9,
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "4px 10px",
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 11 }}>
            eco
          </span>
          Healthier
        </div>

        {alt.image ? (
          <Image
            src={alt.image}
            alt={alt.name}
            fill
            sizes="220px"
            style={{ objectFit: "contain", padding: 20 }}
            unoptimized
          />
        ) : (
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 56, color: "var(--on-surface-variant)", opacity: 0.4 }}
          >
            inventory_2
          </span>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 14,
            fontWeight: 700,
            color: "var(--fg)",
            margin: 0,
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {alt.name}
        </h3>

        {/* Reason pill */}
        <div
          style={{
            background: "rgba(26,122,60,0.07)",
            border: "1px solid rgba(26,122,60,0.18)",
            borderRadius: 10,
            padding: "8px 10px",
            display: "flex",
            alignItems: "flex-start",
            gap: 6,
            marginTop: 4,
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 13, color: "#1a7a3c", flexShrink: 0, marginTop: 1 }}
          >
            check_circle
          </span>
          <p
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "#1a7a3c",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {alt.reason_why}
          </p>
        </div>

        {alt.barcode && (
          <div
            style={{
              marginTop: "auto",
              paddingTop: 8,
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              color: "var(--on-surface-variant)",
              opacity: 0.6,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
              qr_code
            </span>
            #{alt.barcode}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────────────────── */
export default function HealthyAlternatives({ barcode }: { barcode: string }) {
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!barcode) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(false);
        const res = await fetch(`${API_URL}/api/product/${barcode}/alternatives`);
        if (!res.ok) throw new Error("Non-OK response");
        const data = await res.json();
        if (!cancelled) setAlternatives(data.alternatives ?? []);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [barcode]);

  // Don't render anything if no results and no loading/error
  if (!loading && !error && alternatives.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes pp-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
        .pp-alt-scroll::-webkit-scrollbar { height: 4px; }
        .pp-alt-scroll::-webkit-scrollbar-track { background: transparent; }
        .pp-alt-scroll::-webkit-scrollbar-thumb {
          background: var(--outline-variant);
          border-radius: 999px;
        }
      `}</style>

      <section
        style={{
          background: "var(--surface-container-lowest)",
          borderRadius: 20,
          padding: 32,
          boxShadow: "var(--shadow-card)",
          border: "1px solid var(--outline-variant)",
        }}
      >
        {/* Section header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 20,
            borderBottom: "1px solid var(--outline-variant)",
            marginBottom: 24,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 18,
              fontWeight: 600,
              color: "var(--fg)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              margin: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ color: "#1a7a3c" }}>
              eco
            </span>
            Healthy Alternatives
          </h2>
          <span
            style={{
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              color: "var(--on-surface-variant)",
              background: "var(--surface-container)",
              padding: "4px 14px",
              borderRadius: 999,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            AI · RAG Powered
          </span>
        </div>

        {/* Error state */}
        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "var(--on-surface-variant)",
              fontSize: 13,
              fontFamily: "var(--font-mono)",
              padding: "16px 0",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              error_outline
            </span>
            Could not load alternatives right now.
          </div>
        )}

        {/* Scrollable card row */}
        {!error && (
          <div
            className="pp-alt-scroll"
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 16,
              overflowX: "auto",
              paddingBottom: 8,
              scrollSnapType: "x mandatory",
            }}
          >
            {loading
              ? [1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)
              : alternatives.map((alt, i) => (
                  <div key={i} style={{ scrollSnapAlign: "start" }}>
                    <AlternativeCard alt={alt} />
                  </div>
                ))}
          </div>
        )}

        {/* Footer disclaimer */}
        {!loading && !error && alternatives.length > 0 && (
          <p
            style={{
              marginTop: 20,
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--on-surface-variant)",
              opacity: 0.6,
              display: "flex",
              alignItems: "center",
              gap: 6,
              margin: "20px 0 0 0",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
              info
            </span>
            Suggestions are generated by AI based on nutritional data. Always read labels.
          </p>
        )}
      </section>
    </>
  );
}
