import { JsonLd } from "./JsonLd";
import { webPageSchema, breadcrumbsFor, serviceSchema } from "@/lib/seo/structuredData";
import type { Locale, RouteKey } from "@/lib/routes";

type Props = {
  routeKey: RouteKey;
  locale: Locale;
  title: string;
  description: string;
  /** Set for a page that describes exactly one accurately-scoped service
   * offer (see `serviceSchema` in `structuredData.ts` for why most pages
   * should leave this unset). */
  service?: { name: string; description: string };
};

/**
 * Per-page structured data: `WebPage` always, `BreadcrumbList` for every
 * non-home route, and an optional single `Service` entry. Bundles the
 * common combination so individual `page.tsx` files don't each hand-wire
 * three schema builders (brief §10 "via reusable helpers, not per-page
 * duplication" applies to structured data the same way it does metadata).
 */
export function PageStructuredData({ routeKey, locale, title, description, service }: Props) {
  const schemas: object[] = [webPageSchema({ routeKey, locale, title, description })];

  const breadcrumbs = breadcrumbsFor(routeKey, locale, title);
  if (breadcrumbs) schemas.push(breadcrumbs);

  if (service) {
    schemas.push(serviceSchema({ routeKey, locale, name: service.name, description: service.description }));
  }

  return <JsonLd data={schemas} />;
}
