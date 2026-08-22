import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { bricolageGrotesque, hankenGrotesk, ibmPlexMono } from "@/lib/fonts";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { SiteChrome } from "@/components/navigation/SiteChrome";
import { MotionSystem } from "@/components/MotionSystem";
import { SectionReveal } from "@/components/SectionReveal";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { AttributionCapture } from "@/features/attribution";
import { PageViewTracker } from "@/lib/analytics/PageViewTracker";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationSchema, websiteSchema } from "@/lib/seo/structuredData";
import { siteUrl } from "@/lib/seo/metadata";

/**
 * Single root layout for the whole bilingual tree (Next.js allows exactly
 * one <html>/<body> pair). `<html lang>` starts as "en" and is corrected to
 * "pl" on `/pl/...` routes by MotionSystem's pathname-driven effect - see
 * the comment there for why this is the pragmatic choice over a
 * [locale]-segment restructure.
 *
 * Default metadata is the English identity; every route under `src/app/**`
 * overrides `title`/`description`/`alternates` with its own
 * `generateMetadata`/`metadata` export (doc 10 "SEO & content architecture" -
 * every indexable page ships its own title, description and hreflang pair).
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Code Consulting Studio - Engineered software, products & growth",
    template: "%s · Code Consulting Studio",
  },
  description:
    "Code Consulting Studio builds software, owns products, grows businesses online, and teaches the people behind them - BUILD, CREATE, GROW, TEACH.",
  alternates: { languages: { en: "/", pl: "/pl" } },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "Code Consulting Studio",
    title: "Code Consulting Studio - Engineered software, products & growth",
    description:
      "Software development, owned products, digital growth and 1:1 mentoring - one engineering-led studio.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#02060f" },
    { media: "(prefers-color-scheme: light)", color: "#f6f8fc" },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${bricolageGrotesque.variable} ${hankenGrotesk.variable} ${ibmPlexMono.variable}`}
    >
      <body>
        <JsonLd data={[organizationSchema(), websiteSchema()]} />
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <div className="progress-rail" aria-hidden="true">
          <i id="progressFill" />
        </div>
        <div className="boot-curtain" id="bootCurtain" aria-hidden="true">
          <svg viewBox="0 0 100 100">
            <defs>
              <linearGradient id="bootGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#0aa9ff" />
                <stop offset="100%" stopColor="#1267e8" />
              </linearGradient>
            </defs>
            <path d="M64 20c-16 0-30 13-30 30s14 30 30 30" />
          </svg>
        </div>

        <ThemeProvider>
          <div className="spine" aria-hidden="true" />
          <SiteChrome>{children}</SiteChrome>
          <button className="to-top" id="toTop" type="button" aria-label="Back to top">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </ThemeProvider>

        <MotionSystem />
        <SectionReveal />
        <AttributionCapture />
        <PageViewTracker />
        <GoogleAnalytics />
      </body>
    </html>
  );
}
