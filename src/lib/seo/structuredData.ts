import { routes, caseStudyPath, type Locale, type RouteKey } from "@/lib/routes";
import { siteUrl, siteName } from "./metadata";
import type { Project } from "@/features/work/projects";
import type { Article } from "@/features/insights/types/article";
import { articlePath } from "@/features/insights/seo/paths";

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


/** WebPage schema for one project's case-study page - the dynamic-route
 * sibling of `webPageSchema` above (case studies aren't `RouteKey`
 * entries, so they need their own path rather than a `routes[key]`
 * lookup). */
export function projectWebPageSchema({
  project,
  locale,
}: {
  project: Project;
  locale: Locale;
}) {
  const path = caseStudyPath(project.slug, locale);
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: project.seo.title[locale],
    description: project.seo.description[locale],
    url: new URL(path, siteUrl).toString(),
    inLanguage: locale === "pl" ? "pl-PL" : "en-US",
    isPartOf: { "@type": "WebSite", name: siteName, url: siteUrl },
  };
}

/** Home > Work > Project breadcrumb trail for a case-study page. */
export function projectBreadcrumbs({
  project,
  locale,
}: {
  project: Project;
  locale: Locale;
}) {
  return breadcrumbSchema([
    { name: HOME_LABEL[locale], path: routes.home[locale] },
    {
      name: locale === "pl" ? "Realizacje" : "Work",
      path: routes.work[locale],
    },
    { name: project.name, path: caseStudyPath(project.slug, locale) },
  ]);
}

/**
 * `BlogPosting` schema for an Insights article (master instruction §12
 * "Article schema" — a `BlogPosting` is a more accurate `Article` subtype
 * for editorial content than the bare `Article` type). Only fields the
 * article record actually has are emitted — no invented author bios or
 * publisher logos beyond what `organizationSchema()` already provides,
 * matching the same "never misleading" rule the rest of this file
 * follows for `Person`/`Service` schema.
 */
export function articleSchema({ article, locale }: { article: Article; locale: Locale }) {
  const path = articlePath(article.slug, locale);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.excerpt,
    url: new URL(path, siteUrl).toString(),
    inLanguage: locale === "pl" ? "pl-PL" : "en-US",
    datePublished: article.publishedAt ?? undefined,
    dateModified: article.updatedAt,
    author: { "@type": "Person", name: article.authorName },
    publisher: { "@type": "Organization", name: siteName, url: siteUrl },
    image: article.coverImageUrl ?? undefined,
    articleSection: article.category.name,
    isPartOf: { "@type": "WebSite", name: siteName, url: siteUrl },
  };
}

/** Home > Insights > Article breadcrumb trail. */
export function articleBreadcrumbs({ article, locale }: { article: Article; locale: Locale }) {
  return breadcrumbSchema([
    { name: HOME_LABEL[locale], path: routes.home[locale] },
    { name: locale === "pl" ? "Wiedza" : "Insights", path: routes.insights[locale] },
    { name: article.title, path: articlePath(article.slug, locale) },
  ]);
}
