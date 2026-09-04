"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const NAV_LINKS = [
  { label: "Home", href: "/scan" },
  { label: "Scan", href: "/scan" },
  { label: "My Contributions", href: "/contributions" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, loading: authLoading, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <nav style={{
      position: "fixed",
      top: 0, left: 0, right: 0,
      zIndex: 100,
      height: 68,
      backgroundColor: "rgba(252,249,248,0.85)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--outline-variant)",
      boxShadow: "0 1px 12px rgba(140,79,0,0.06)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 48px",
      fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
    }}>
      {/* Logo */}
      <Link href="/scan" style={{
        display: "flex", alignItems: "center", gap: 10,
        textDecoration: "none", color: "inherit",
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 28, color: "var(--primary)", fontWeight: 700 }}>
          barcode_scanner
        </span>
        <span style={{
          fontFamily: "var(--font-display, 'Bricolage Grotesque', sans-serif)",
          fontWeight: 900, fontSize: 22,
          letterSpacing: "-0.03em", color: "var(--on-surface)",
        }}>PacketPeek</span>
      </Link>

      {/* Nav Links */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {NAV_LINKS.map(({ label, href }) => {
          const isActive = pathname === href;
          return (
            <Link key={label} href={href} style={{
              fontSize: 15,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? "var(--primary)" : "var(--on-surface-variant)",
              textDecoration: "none",
              padding: "6px 14px",
              borderRadius: 8,
              backgroundColor: isActive ? "rgba(255,102,0,0.08)" : "transparent",
              transition: "all 0.15s",
            }}>
              {label}
            </Link>
          );
        })}
      </div>

      {/* Auth Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {authLoading ? (
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface-container)" }} />
        ) : user ? (
          <div ref={dropdownRef} style={{ position: "relative" }}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              style={{
                width: 40, height: 40, borderRadius: "50%",
                border: "2px solid var(--primary)",
                overflow: "hidden", cursor: "pointer", padding: 0,
                background: "var(--surface-container-low)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 8px rgba(255,102,0,0.2)",
                transition: "box-shadow 0.15s",
              }}
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
              <div style={{
                position: "absolute", top: "calc(100% + 10px)", right: 0,
                background: "var(--surface)",
                border: "1px solid var(--outline-variant)",
                borderRadius: 14, boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
                minWidth: 220, zIndex: 200, overflow: "hidden",
              }}>
                {/* User info */}
                <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--outline-variant)" }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--on-surface)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user.displayName || "User"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--on-surface-variant)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user.email}
                  </div>
                </div>

                {/* Dropdown nav items */}
                {[
                  { label: "My Contributions", href: "/contributions", icon: "inventory_2" },
                ].map(({ label, href, icon }) => (
                  <Link key={href} href={href}
                    onClick={() => setDropdownOpen(false)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "12px 18px", textDecoration: "none",
                      fontSize: 14, fontWeight: 600, color: "var(--on-surface)",
                      transition: "background 0.15s",
                    }}
                    onMouseOver={e => e.currentTarget.style.background = "var(--surface-container-low)"}
                    onMouseOut={e => e.currentTarget.style.background = "transparent"}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--primary)" }}>{icon}</span>
                    {label}
                  </Link>
                ))}

                {/* Sign out */}
                <button
                  onClick={async () => { await logout(); setDropdownOpen(false); }}
                  style={{
                    width: "100%", padding: "12px 18px",
                    background: "none", border: "none", borderTop: "1px solid var(--outline-variant)",
                    textAlign: "left", cursor: "pointer",
                    fontSize: 14, fontWeight: 600, color: "var(--error)",
                    display: "flex", alignItems: "center", gap: 10,
                    fontFamily: "var(--font-body)", transition: "background 0.15s",
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = "var(--error-container)")}
                  onMouseOut={e => (e.currentTarget.style.background = "none")}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link href="/login" style={{
            backgroundColor: "var(--primary)", color: "#fff",
            textDecoration: "none", borderRadius: 10,
            padding: "9px 20px", fontSize: 14, fontWeight: 700,
            fontFamily: "var(--font-body)",
            boxShadow: "0 4px 14px -4px rgba(255,102,0,0.45)",
            whiteSpace: "nowrap", transition: "opacity 0.15s",
          }}>
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}
