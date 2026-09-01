import type { MetadataRoute } from "next";

import { routes, locales, caseStudyPath, type RouteKey } from "@/lib/routes";

import { getAllProjects } from "@/features/work/projects";
import { listPublishedArticlesForSitemap } from "@/features/insights/data/queries";
import { articlePath } from "@/features/insights/seo/paths";

import { siteUrl } from "@/lib/seo/metadata";

// Admin/auth/API routes are not part of the public route map,
// so currently there is nothing additional to exclude here.
const EXCLUDED: RouteKey[] = [];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const entries: MetadataRoute.Sitemap = [];

	(Object.keys(routes) as RouteKey[])
		.filter((key) => !EXCLUDED.includes(key))
		.forEach((key) => {
			const enPath = routes[key].en;

			entries.push({
				url: new URL(enPath, siteUrl).toString(),

				changeFrequency: key === "home" ? "weekly" : "monthly",

				priority: key === "home" ? 1 : 0.6,

				alternates: {
					languages: Object.fromEntries(
						locales.map((locale) => [locale, new URL(routes[key][locale], siteUrl).toString()]),
					),
				},
			});
		});

	// Dynamic project / case-study routes.
	getAllProjects().forEach((project) => {
		entries.push({
			url: new URL(caseStudyPath(project.slug, "en"), siteUrl).toString(),

			changeFrequency: "monthly",

			priority: 0.7,

			alternates: {
				languages: Object.fromEntries(
					locales.map((locale) => [locale, new URL(caseStudyPath(project.slug, locale), siteUrl).toString()]),
				),
			},
		});
	});

	// Dynamic Insights article routes. `lastModified` comes from each
	// article's real `updated_at` (docs/INSIGHTS_AUDIT.md §4 "duplicate
	// sitemap logic" risk — never a static default here). Only published
	// rows are ever returned (RLS-enforced), so nothing in-progress can
	// leak into the sitemap. EN/PL pairing isn't assumed at the sitemap
	// level (an article's slug in one locale has no guaranteed
	// counterpart) — each locale's articles are listed independently
	// rather than guessing a cross-locale `alternates` entry.
	for (const locale of locales) {
		const articles = await listPublishedArticlesForSitemap(locale);
		articles.forEach((article) => {
			entries.push({
				url: new URL(articlePath(article.slug, locale), siteUrl).toString(),
				lastModified: new Date(article.updatedAt),
				changeFrequency: "monthly",
				priority: 0.65,
			});
		});
	}

	return entries;
}
