"use client";

/**
 * ThemeProvider.tsx
 * Wraps the app with next-themes, configured for class-based dark mode.
 *
 * attribute="class"  → next-themes adds/removes the "dark" class on <html>
 * defaultTheme="system" → respects OS preference on first visit
 * enableSystem         → allows toggling back to system preference
 *
 * This connects directly to the .dark block in globals.css, which reassigns
 * all CSS custom properties (--bg, --primary, --surface, etc.) to their
 * dark-mode equivalents. Tailwind utilities (bg-background, text-foreground,
 * text-primary, etc.) automatically reflect the active theme because @theme
 * points to those same CSS vars.
 *
 * Usage — toggle theme anywhere in the app:
 *   import { useTheme } from "next-themes";
 *   const { theme, setTheme } = useTheme();
 *   setTheme("dark");    // → adds .dark to <html>
 *   setTheme("light");   // → removes .dark from <html>
 *   setTheme("system");  // → follows OS preference
 */

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
