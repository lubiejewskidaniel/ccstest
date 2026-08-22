import type { Metadata } from "next";
import { routes, type Locale, type RouteKey } from "@/lib/routes";

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://codeconsultingstudio.com";
export const siteName = "Code Consulting Studio";

export type PageMetadataInput = {
  /** Route key from `src/lib/routes.ts` - the single source of truth for
   * this page's path in every locale, so canonical/hreflang can never drift
   * out of sync with the actual route map (brief §11: "canonicals must not
   * suppress either language version"). */
  routeKey: RouteKey;
  locale: Locale;
  /** Short page title - Next's root-layout title template ("%s · Code
   * Consulting Studio") applies this automatically to the <title> tag. */
  title: string;
  description: string;
  /** Set true only for pages that should never be indexed (the brief's
   * public/bilingual pages should not need this - admin routes already
   * set their own `robots` metadata directly). */
  noindex?: boolean;
};

/**
 * Single seam for per-page title/description/canonical/hreflang/OG/Twitter
 * metadata (brief §10-§13 "systematic SEO... via reusable helpers, not
 * per-page duplication"). Before this helper, every `page.tsx` hand-wrote
 * its own `alternates.languages` pair - duplicating data that already
 * lives once in `routes.ts`, and one missed edit there would have silently
 * broken hreflang for that page. Every public page should call this
 * instead of building its own `Metadata` object.
 */
export function buildPageMetadata({ routeKey, locale, title, description, noindex = false }: PageMetadataInput): Metadata {
  const pair = routes[routeKey];
  const canonicalPath = pair[locale];

  // x-default points at the English version (the studio's default
  // language per `defaultLocale` in routes.ts) - brief §11 "correct
  // bilingual SEO / hreflang".
  const languages: Record<string, string> = { en: pair.en, pl: pair.pl, "x-default": pair.en };

  const fullTitle = `${title} · ${siteName}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath, languages },
    robots: noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "website",
      url: canonicalPath,
      title: fullTitle,
      description,
      siteName,
      locale: locale === "pl" ? "pl_PL" : "en_US",
    },
    twitter: { card: "summary_large_image", title: fullTitle, description },
  };
}
