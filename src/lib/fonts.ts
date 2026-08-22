import { Bricolage_Grotesque, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";

/**
 * Self-hosted, build-time-optimized Google Fonts (doc 06 "Type" - Bricolage
 * Grotesque / display, Hanken Grotesk / body, IBM Plex Mono / signal-data).
 *
 * Replaces the old `<link rel="stylesheet" href="https://fonts.googleapis.com/...">`
 * in `src/app/layout.tsx`, which triggered ESLint's `@next/next/no-page-custom-font`
 * (see https://nextjs.org/docs/messages/no-page-custom-font). `next/font/google`
 * downloads and self-hosts the font files at build time instead of fetching
 * them from Google at request time, which removes the third-party network
 * request and its render-blocking risk, avoids layout shift (it injects a
 * size-adjusted fallback automatically), and means no user data ever reaches
 * Google's font CDN.
 *
 * Each font exposes a CSS custom property via `variable`, matching the
 * `--font-display` / `--font-body` / `--font-mono` names already used
 * throughout `src/styles/*.css` - so no other stylesheet needed to change.
 * The `.variable` class names are applied to `<html>` in the root layout.
 *
 * `latin-ext` is included alongside `latin` because the site ships a full
 * Polish translation (`/pl/**`) and Polish diacritics (ą, ć, ę, ł, ń, ó, ś,
 * ź, ż) live in the Latin Extended-A block, not plain Latin.
 */
export const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

export const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-body",
  display: "swap",
});

export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});
