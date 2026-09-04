import type { Metadata } from "next";
import {
  Bricolage_Grotesque,
  Plus_Jakarta_Sans,
  JetBrains_Mono,
} from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/context/AuthContext";
import Footer from "@/components/Footer";
import "./globals.css";

/* ── PacketPeek tri-font stack (DESIGN.md — Saffron Health Pulse) ─────────
   Variable names mirror --font-* in globals.css @theme so Tailwind utilities
   (font-display, font-body, font-mono) resolve automatically.
─────────────────────────────────────────────────────────────────────────── */

const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PacketPeek — Zaika Score",
  description:
    "Scan packaged food barcodes to get ingredient and nutrition data. Phase 1.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${bricolageGrotesque.variable} ${plusJakartaSans.variable} ${jetBrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Material Symbols Outlined — used by Home screen + ProductResult for icons */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
        <style>{`.material-symbols-outlined{font-family:'Material Symbols Outlined';font-weight:normal;font-style:normal;font-size:24px;line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;white-space:nowrap;word-wrap:normal;direction:ltr;-webkit-font-smoothing:antialiased;}`}</style>
      </head>
      <body>
        {/*
          ThemeProvider (next-themes):
          - attribute="class"       → adds/removes .dark on <html>
          - defaultTheme="system"   → respects OS preference on first visit
          - disableTransitionOnChange=false → keeps the 0.2s CSS transition in globals.css
        */}
        <AuthProvider>
          <ThemeProvider>
            <div className="flex flex-col min-h-screen">
              <main className="flex-1 flex flex-col">
                {children}
              </main>
              <Footer />
            </div>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
