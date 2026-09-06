import { routes, type Locale } from "@/lib/routes";
import { siteUrl } from "@/lib/seo/metadata";

/**
 * Builds Insights dynamic-segment URLs on top of the `insights` hub path
 * from `routes.ts`, the same way `caseStudyPath()` builds case-study URLs
 * on top of the `work` hub — a slug is always addressed relative to
 * wherever the hub actually lives, instead of a second hardcoded path
 * table (docs/INSIGHTS_ARCHITECTURE.md §2).
 */

export function articlePath(slug: string, locale: Locale): string {
  return `${routes.insights[locale]}/${slug}`;
}

const CATEGORY_SEGMENT: Record<Locale, string> = { en: "category", pl: "kategoria" };
const TAG_SEGMENT: Record<Locale, string> = { en: "tag", pl: "tag" };
const SEARCH_SEGMENT: Record<Locale, string> = { en: "search", pl: "szukaj" };

export function categoryPath(slug: string, locale: Locale): string {
  return `${routes.insights[locale]}/${CATEGORY_SEGMENT[locale]}/${slug}`;
}

export function tagPath(slug: string, locale: Locale): string {
  return `${routes.insights[locale]}/${TAG_SEGMENT[locale]}/${slug}`;
}

export function searchPath(locale: Locale, query?: string): string {
  const base = `${routes.insights[locale]}/${SEARCH_SEGMENT[locale]}`;
  return query ? `${base}?q=${encodeURIComponent(query)}` : base;
}

export function feedPath(locale: Locale): string {
  return `${routes.insights[locale]}/feed.xml`;
}

/** Absolute, locale-correct URL for an article — the one place
 * `new URL(articlePath(...), siteUrl)` is built, so every IndexNow
 * caller (the scheduler's publish route, the CMS publish/update
 * paths) submits through the same construction instead of
 * re-deriving it at each call site. */
export function articleUrl(slug: string, locale: Locale): string {
  return new URL(articlePath(slug, locale), siteUrl).toString();
}
