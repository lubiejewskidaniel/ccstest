import { routes, locales, type Locale } from "@/lib/routes";

/**
 * Matches a raw `page_url` from `search_performance_metrics` (as
 * reported by Google Search Console; Bing's rows never have one, see
 * `content-intelligence/bing/BingWebmasterProvider.ts`) back to an
 * Insights article's locale + slug — the precise join Checkpoint 6
 * deliberately deferred ("a real 'does this specific published URL
 * actually rank for this query' join is real, separate work... build it
 * when Checkpoint 9's content-refresh workflow needs that precision").
 * Shared by `monitoring/performanceAnalysis.ts` and
 * `opportunities/cannibalisation.ts` so the same matching rule can't
 * drift between the two.
 *
 * Deliberately excludes category/tag/search sub-paths (anything with a
 * further `/` after the hub segment) — only an exact article path
 * counts.
 */
export function matchArticleUrl(pageUrl: string | null | undefined): { locale: Locale; slug: string } | null {
	if (!pageUrl) return null;

	let path: string;
	try {
		path = new URL(pageUrl).pathname;
	} catch {
		path = pageUrl;
	}
	path = path.replace(/\/+$/, "");

	for (const locale of locales) {
		const hub = routes.insights[locale];
		if (path.startsWith(`${hub}/`)) {
			const rest = path.slice(hub.length + 1);
			if (rest && !rest.includes("/")) return { locale, slug: rest };
		}
	}

	return null;
}
