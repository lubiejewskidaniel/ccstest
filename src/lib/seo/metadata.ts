import type { Metadata } from "next";

import {
	routes,
	caseStudyPath,
	type Locale,
	type RouteKey,
} from "@/lib/routes";

import type { Project } from "@/features/work/projects";
import type { Article } from "@/features/insights/types/article";
import { articlePath } from "@/features/insights/seo/paths";

export const siteUrl =
	process.env.NEXT_PUBLIC_SITE_URL ?? "https://codeconsultingstudio.com";

export const siteName = "Code Consulting Studio";

const ogImage = {
	url: "/og-image.png",
	width: 1200,
	height: 630,
	alt: "Code Consulting Studio - Software, Products, Growth and Mentoring",
};

export type PageMetadataInput = {
	/**
	 * Route key from `src/lib/routes.ts` - the single source of truth for
	 * this page's path in every locale.
	 */
	routeKey: RouteKey;

	locale: Locale;

	/**
	 * Short page title - Next's root-layout title template
	 * ("%s · Code Consulting Studio") applies this automatically
	 * to the <title> tag.
	 */
	title: string;

	description: string;

	/**
	 * Set true only for pages that should never be indexed.
	 */
	noindex?: boolean;
};

/**
 * Generates metadata for standard public pages.
 *
 * Handles:
 * - canonical URLs
 * - hreflang
 * - x-default
 * - Open Graph
 * - Twitter/X cards
 * - optional noindex
 */
export function buildPageMetadata({
	routeKey,
	locale,
	title,
	description,
	noindex = false,
}: PageMetadataInput): Metadata {
	const pair = routes[routeKey];
	const canonicalPath = pair[locale];

	const languages: Record<string, string> = {
		en: pair.en,
		pl: pair.pl,
		"x-default": pair.en,
	};

	const fullTitle = `${title} · ${siteName}`;

	return {
		title,
		description,

		alternates: {
			canonical: canonicalPath,
			languages,
		},

		robots: noindex
			? {
					index: false,
					follow: false,
				}
			: undefined,

		openGraph: {
			type: "website",
			url: canonicalPath,
			title: fullTitle,
			description,
			siteName,
			locale: locale === "pl" ? "pl_PL" : "en_GB",
			images: [ogImage],
		},

		twitter: {
			card: "summary_large_image",
			title: fullTitle,
			description,
			images: ["/og-image.png"],
		},
	};
}

export type ArticleMetadataInput = {
	article: Article;
	locale: Locale;
	/** The resolved translation's canonical path, when one exists — passed
	 * in by the page (it already resolves this for the UI's language
	 * switch link) rather than looked up again here, since this function
	 * stays synchronous like its siblings. Omit when no translation exists
	 * yet; hreflang for that locale is simply not emitted rather than
	 * pointing at a page that doesn't exist. */
	translatedPath?: string;
};

/**
 * Generates metadata for an individual Insights article — the third
 * dynamic-content variant alongside `buildPageMetadata` (static hubs) and
 * `buildProjectMetadata` (case studies). `seoTitle`/`seoDescription`
 * override the on-page `title`/`excerpt` when an editor has set them
 * (docs/INSIGHTS_DATABASE.md §2.3), matching how the CMS is expected to
 * let a title be tuned for search without changing the on-page headline.
 */
export function buildArticleMetadata({ article, locale, translatedPath }: ArticleMetadataInput): Metadata {
	const canonicalPath = articlePath(article.slug, locale);
	const title = article.seoTitle ?? article.title;
	const description = article.seoDescription ?? article.excerpt;
	const fullTitle = `${title} · ${siteName}`;

	const languages: Record<string, string> | undefined = translatedPath
		? { [locale]: canonicalPath, [locale === "en" ? "pl" : "en"]: translatedPath }
		: undefined;

	return {
		title,
		description,

		alternates: {
			canonical: canonicalPath,
			languages,
		},

		openGraph: {
			type: "article",
			url: canonicalPath,
			title: fullTitle,
			description,
			siteName,
			locale: locale === "pl" ? "pl_PL" : "en_GB",
			images: article.coverImageUrl ? [{ url: article.coverImageUrl, alt: article.coverImageAlt ?? title }] : [ogImage],
			publishedTime: article.publishedAt ?? undefined,
			modifiedTime: article.updatedAt,
			authors: [article.authorName],
		},

		twitter: {
			card: "summary_large_image",
			title: fullTitle,
			description,
			images: [article.coverImageUrl ?? "/og-image.png"],
		},
	};
}

export type ProjectMetadataInput = {
	project: Project;
	locale: Locale;
};

/**
 * Generates metadata for individual project / case-study pages.
 *
 * Dynamic project URLs are built using `caseStudyPath`,
 * while title and description come from the project's SEO data.
 */
export function buildProjectMetadata({
	project,
	locale,
}: ProjectMetadataInput): Metadata {
	const canonicalPath = caseStudyPath(project.slug, locale);

	const languages: Record<string, string> = {
		en: caseStudyPath(project.slug, "en"),
		pl: caseStudyPath(project.slug, "pl"),
		"x-default": caseStudyPath(project.slug, "en"),
	};

	const title = project.seo.title[locale];
	const description = project.seo.description[locale];

	return {
		title,
		description,

		alternates: {
			canonical: canonicalPath,
			languages,
		},

		openGraph: {
			type: "article",
			url: canonicalPath,
			title,
			description,
			siteName,
			locale: locale === "pl" ? "pl_PL" : "en_GB",
			images: [ogImage],
		},

		twitter: {
			card: "summary_large_image",
			title,
			description,
			images: ["/og-image.png"],
		},
	};
}
