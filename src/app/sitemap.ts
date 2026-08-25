import type { MetadataRoute } from "next";

import { routes, locales, caseStudyPath, type RouteKey } from "@/lib/routes";

import { getAllProjects } from "@/features/work/projects";

import { siteUrl } from "@/lib/seo/metadata";

// Admin/auth/API routes are not part of the public route map,
// so currently there is nothing additional to exclude here.
const EXCLUDED: RouteKey[] = [];

export default function sitemap(): MetadataRoute.Sitemap {
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
						locales.map((locale) => [
							locale,
							new URL(routes[key][locale], siteUrl).toString(),
						]),
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
					locales.map((locale) => [
						locale,
						new URL(caseStudyPath(project.slug, locale), siteUrl).toString(),
					]),
				),
			},
		});
	});

	return entries;
}
