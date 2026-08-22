import type { MetadataRoute } from "next";
import { routes, locales, type RouteKey } from "@/lib/routes";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://codeconsultingstudio.com";

// Admin, auth and form-confirmation states are deliberately excluded from
// the sitemap (doc 10 "SEO & content architecture" - only public, indexable
// hubs are submitted).
const EXCLUDED: RouteKey[] = [];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  (Object.keys(routes) as RouteKey[])
    .filter((key) => !EXCLUDED.includes(key))
    .forEach((key) => {
      const enPath = routes[key].en;
      entries.push({
        url: new URL(enPath, siteUrl).toString(),
        lastModified: new Date(),
        changeFrequency: key === "home" ? "weekly" : "monthly",
        priority: key === "home" ? 1 : 0.6,
        alternates: {
          languages: Object.fromEntries(
            locales.map((locale) => [locale, new URL(routes[key][locale], siteUrl).toString()])
          ),
        },
      });
    });

  return entries;
}
