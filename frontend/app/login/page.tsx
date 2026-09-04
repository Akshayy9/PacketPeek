"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

// Barcode + PacketPeek inline logo
function PacketPeekLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const barcodeW = size === "sm" ? 52 : size === "lg" ? 96 : 80;
  const barcodeH = size === "sm" ? 28 : size === "lg" ? 52 : 44;
  const fontSize = size === "sm" ? "13px" : size === "lg" ? "26px" : "22px";
  const vbW = 64; const vbH = 36;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px" }}>
      <svg width={barcodeW} height={barcodeH} viewBox={`0 0 ${vbW} ${vbH}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2"  y="0" width="2"  height="36" fill="#1c1b1b" />
        <rect x="6"  y="0" width="1"  height="36" fill="#1c1b1b" />
        <rect x="9"  y="0" width="3"  height="36" fill="#1c1b1b" />
        <rect x="14" y="0" width="1"  height="36" fill="#1c1b1b" />
        <rect x="17" y="0" width="2"  height="36" fill="#1c1b1b" />
        <rect x="21" y="0" width="1"  height="36" fill="#1c1b1b" />
        <rect x="24" y="0" width="3"  height="36" fill="#1c1b1b" />
        <rect x="29" y="0" width="1"  height="36" fill="#1c1b1b" />
        <rect x="32" y="0" width="2"  height="36" fill="#1c1b1b" />
        <rect x="36" y="0" width="1"  height="36" fill="#1c1b1b" />
        <rect x="39" y="0" width="3"  height="36" fill="#E06000" />
        <rect x="44" y="0" width="1"  height="36" fill="#1c1b1b" />
        <rect x="47" y="0" width="2"  height="36" fill="#1c1b1b" />
        <rect x="51" y="0" width="1"  height="36" fill="#1c1b1b" />
        <rect x="54" y="0" width="3"  height="36" fill="#1c1b1b" />
        <rect x="59" y="0" width="1"  height="36" fill="#E06000" />
        <rect x="62" y="0" width="2"  height="36" fill="#1c1b1b" />
      </svg>
      <div style={{ display: "flex", alignItems: "center", gap: "1px" }}>
        <span style={{ fontSize, fontWeight: 800, letterSpacing: "-0.03em", color: "#1c1b1b", fontFamily: "'Bricolage Grotesque', sans-serif", lineHeight: 1 }}>
          Packet
        </span>
        <span style={{ fontSize, fontWeight: 800, letterSpacing: "-0.03em", color: "#E06000", fontFamily: "'Bricolage Grotesque', sans-serif", lineHeight: 1 }}>
          Peek
        </span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      setError(null);
      await signInWithGoogle();
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      if (isLogin) {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    paddingLeft: "40px",
    paddingRight: "14px",
    paddingTop: "11px",
    paddingBottom: "11px",
    backgroundColor: "#f6f3f2",
    border: "1.5px solid transparent",
    borderRadius: "10px",
    fontSize: "14px",
    color: "#1c1b1b",
    outline: "none",
    boxSizing: "border-box",
    transition: "all 0.18s",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#fafafa", fontFamily: "'Plus Jakarta Sans', sans-serif", position: "relative" }}>

      {/* ── Floating Back Button (top-left) ── */}
      <button
        onClick={() => router.back()}
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: "#fff",
          border: "1.5px solid #ede8e6",
          borderRadius: "8px",
          padding: "7px 14px",
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: 600,
          color: "#554334",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          zIndex: 10,
          transition: "all 0.15s",
        }}
        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "#f6f3f2"; e.currentTarget.style.borderColor = "#dbc2ae"; }}
        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "#fff"; e.currentTarget.style.borderColor = "#ede8e6"; }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back
      </button>

      {/* ── Page body ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 16px",
          minHeight: "100vh",
        }}
      >

      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          backgroundColor: "#ffffff",
          borderRadius: "20px",
          boxShadow: "0 2px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)",
          border: "1px solid #ede8e6",
          padding: "36px 36px 32px",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
          <PacketPeekLogo />
        </div>

        {/* Heading */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "#1c1b1b",
              margin: 0,
              marginBottom: "5px",
              fontFamily: "'Bricolage Grotesque', sans-serif",
              letterSpacing: "-0.02em",
            }}
          >
            {isLogin ? "Welcome back" : "Create account"}
          </h1>
          <p style={{ fontSize: "13px", color: "#887362", margin: 0 }}>
            {isLogin ? "Sign in to continue to your account." : "Start scanning and analyzing products."}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              backgroundColor: "#fff0f0",
              border: "1px solid #fcc",
              color: "#ba1a1a",
              borderRadius: "10px",
              padding: "10px 14px",
              fontSize: "13px",
              textAlign: "center",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleEmailAuth}>
          {/* Email */}
          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#554334", marginBottom: "6px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Email
            </label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "13px", top: "50%", transform: "translateY(-50%)", color: "#bbb", display: "flex" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={inputStyle}
                onFocus={(e) => {
                  e.target.style.backgroundColor = "#fff";
                  e.target.style.borderColor = "rgba(224,96,0,0.4)";
                  e.target.style.boxShadow = "0 0 0 3px rgba(224,96,0,0.07)";
                }}
                onBlur={(e) => {
                  e.target.style.backgroundColor = "#f6f3f2";
                  e.target.style.borderColor = "transparent";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#554334", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Password
              </label>
              {isLogin && (
                <a href="#" style={{ fontSize: "12px", color: "#887362", textDecoration: "none", fontWeight: 500 }}>
                  Forgot?
                </a>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "13px", top: "50%", transform: "translateY(-50%)", color: "#bbb", display: "flex" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{ ...inputStyle, letterSpacing: "0.12em" }}
                onFocus={(e) => {
                  e.target.style.backgroundColor = "#fff";
                  e.target.style.borderColor = "rgba(224,96,0,0.4)";
                  e.target.style.boxShadow = "0 0 0 3px rgba(224,96,0,0.07)";
                }}
                onBlur={(e) => {
                  e.target.style.backgroundColor = "#f6f3f2";
                  e.target.style.borderColor = "transparent";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            style={{
              width: "100%",
              backgroundColor: "#E06000",
              color: "#fff",
              border: "none",
              borderRadius: "11px",
              padding: "13px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 6px 18px -4px rgba(224,96,0,0.42)",
              transition: "all 0.18s",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              letterSpacing: "0.01em",
            }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "#c95500"; e.currentTarget.style.boxShadow = "0 8px 22px -4px rgba(224,96,0,0.5)"; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "#E06000"; e.currentTarget.style.boxShadow = "0 6px 18px -4px rgba(224,96,0,0.42)"; }}
          >
            {isLogin ? "Sign In" : "Sign Up"}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", margin: "20px 0 16px" }}>
          <div style={{ flex: 1, height: "1px", backgroundColor: "#ede8e6" }} />
          <span style={{ padding: "0 12px", fontSize: "11px", color: "#bbb", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase" }}>
            or
          </span>
          <div style={{ flex: 1, height: "1px", backgroundColor: "#ede8e6" }} />
        </div>

        {/* Social */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <button
            onClick={handleGoogleSignIn}
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              backgroundColor: "#fff",
              border: "1.5px solid #ede8e6",
              borderRadius: "10px",
              padding: "11px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              color: "#1c1b1b",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              transition: "all 0.18s",
            }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "#f9f6f4"; e.currentTarget.style.borderColor = "#dbc2ae"; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "#fff"; e.currentTarget.style.borderColor = "#ede8e6"; }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            Google
          </button>
          <button
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              backgroundColor: "#fff",
              border: "1.5px solid #ede8e6",
              borderRadius: "10px",
              padding: "11px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              color: "#1c1b1b",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              transition: "all 0.18s",
            }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "#f9f6f4"; e.currentTarget.style.borderColor = "#dbc2ae"; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "#fff"; e.currentTarget.style.borderColor = "#ede8e6"; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            Facebook
          </button>
        </div>

        {/* Toggle */}
        <p style={{ marginTop: "22px", textAlign: "center", fontSize: "13px", color: "#887362", margin: "22px 0 0" }}>
          {isLogin ? "No account? " : "Have an account? "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            style={{
              background: "none",
              border: "none",
              color: "#E06000",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
              padding: 0,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            {isLogin ? "Sign Up" : "Sign In"}
          </button>
        </p>
      </div>
      </div>
    </div>
  );
}
