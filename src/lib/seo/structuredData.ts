import { routes, type Locale, type RouteKey } from "@/lib/routes";
import { siteUrl, siteName } from "./metadata";

/**
 * JSON-LD builders (brief §12: "valid structured data... only where
 * accurate - never misleading"). Deliberately narrow: a `Person` schema is
 * NOT provided here because the app has no verified, publishable
 * named-individual data (no team/founder page ships real names/roles yet)
 * - inventing one to satisfy the brief's example list would violate the
 * same brief's accuracy requirement. Add it once that content exists; see
 * docs/SEO_AEO.md.
 */

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: siteUrl,
    logo: new URL("/favicon.svg", siteUrl).toString(),
    // `sameAs` (social profile URLs) intentionally omitted - none are
    // configured anywhere else in this app, and guessing them here would
    // risk publishing an inaccurate claim of ownership over a profile.
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url: siteUrl,
  };
}

export function webPageSchema({
  routeKey,
  locale,
  title,
  description,
}: {
  routeKey: RouteKey;
  locale: Locale;
  title: string;
  description: string;
}) {
  const path = routes[routeKey][locale];
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: new URL(path, siteUrl).toString(),
    inLanguage: locale === "pl" ? "pl-PL" : "en-US",
    isPartOf: { "@type": "WebSite", name: siteName, url: siteUrl },
  };
}

/** For a page that describes exactly one accurately-scoped service offer
 * (currently: the Growth and Mentoring pages). The Services hub page lists
 * six offerings at once and deliberately does NOT get a Service schema
 * here - see docs/SEO_AEO.md for why that's a scoped-out follow-up rather
 * than an oversight. */
export function serviceSchema({
  routeKey,
  locale,
  name,
  description,
}: {
  routeKey: RouteKey;
  locale: Locale;
  name: string;
  description: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    description,
    provider: { "@type": "Organization", name: siteName, url: siteUrl },
    url: new URL(routes[routeKey][locale], siteUrl).toString(),
  };
}

export function breadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: new URL(item.path, siteUrl).toString(),
    })),
  };
}

const HOME_LABEL: Record<Locale, string> = { en: "Home", pl: "Strona główna" };

/** Home > current page breadcrumb trail for any non-home route. Returns
 * `null` for the home route itself (a single-item trail is meaningless). */
export function breadcrumbsFor(routeKey: RouteKey, locale: Locale, pageTitle: string) {
  if (routeKey === "home") return null;
  return breadcrumbSchema([
    { name: HOME_LABEL[locale], path: routes.home[locale] },
    { name: pageTitle, path: routes[routeKey][locale] },
  ]);
}
