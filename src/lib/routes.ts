/**
 * EN/PL route map. English is the default language; every public hub has a
 * stable Polish equivalent so switching language preserves conceptual
 * location (doc 04 principle: "language switch resolves equivalent resource").
 */

export type Locale = "en" | "pl";

export const locales: Locale[] = ["en", "pl"];
export const defaultLocale: Locale = "en";

export type RouteKey =
  | "home"
  | "services"
  | "work"
  | "products"
  | "growth"
  | "mentoring"
  | "mentoringEnquire"
  | "insights"
  | "about"
  | "contact"
  | "privacy"
  | "cookies"
  | "terms"
  | "accessibility"
  | "academicIntegrity";

export const routes: Record<RouteKey, Record<Locale, string>> = {
  home: { en: "/", pl: "/pl" },
  services: { en: "/services", pl: "/pl/uslugi" },
  work: { en: "/work", pl: "/pl/realizacje" },
  products: { en: "/products", pl: "/pl/produkty" },
  growth: { en: "/growth", pl: "/pl/marketing" },
  mentoring: { en: "/mentoring", pl: "/pl/mentoring" },
  mentoringEnquire: { en: "/mentoring/enquire", pl: "/pl/mentoring/zapytaj" },
  insights: { en: "/insights", pl: "/pl/wiedza" },
  about: { en: "/about", pl: "/pl/o-nas" },
  contact: { en: "/contact", pl: "/pl/kontakt" },
  privacy: { en: "/privacy", pl: "/pl/prywatnosc" },
  cookies: { en: "/cookies", pl: "/pl/cookies" },
  terms: { en: "/terms", pl: "/pl/regulamin" },
  accessibility: { en: "/accessibility", pl: "/pl/dostepnosc" },
  academicIntegrity: { en: "/academic-integrity", pl: "/pl/integrity" },
};

export function routeFor(key: RouteKey, locale: Locale): string {
  return routes[key][locale];
}

/** Given the current path, find its RouteKey + locale (used by the language switcher). */
export function resolveRoute(pathname: string): { key: RouteKey; locale: Locale } | null {
  for (const key of Object.keys(routes) as RouteKey[]) {
    for (const locale of locales) {
      if (routes[key][locale] === pathname) {
        return { key, locale };
      }
    }
  }
  return null;
}

/** The equivalent path in the other language, preserving conceptual location. */
export function alternatePath(pathname: string): string {
  const resolved = resolveRoute(pathname);
  if (!resolved) return pathname;
  const otherLocale: Locale = resolved.locale === "en" ? "pl" : "en";
  return routes[resolved.key][otherLocale];
}

/**
 * Path for one project's case-study page, e.g. "/work/takblisko" or
 * "/pl/realizacje/takblisko" - built on top of the "work" hub route so a
 * case study is always addressed relative to wherever /work actually
 * lives, instead of a second, hardcoded routing table for project slugs.
 */
export function caseStudyPath(slug: string, locale: Locale): string {
  return `${routes.work[locale]}/${slug}`;
}
