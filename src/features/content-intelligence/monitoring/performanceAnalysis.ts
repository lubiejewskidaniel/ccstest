import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listArticlesForAdmin, getTopArticles, getCtaClickCounts, type PerformanceWindow } from "@/features/insights/cms/queries";
import { matchArticleUrl } from "./matchArticleUrl";
import type { Locale } from "@/lib/routes";

export type { PerformanceWindow };

export type ArticlePerformanceRow = {
	articleId: string;
	locale: Locale;
	slug: string;
	title: string;
	publishedAt: string | null;
	updatedAt: string;
	views: number;
	ctaClicks: number;
	searchImpressions: number;
	searchClicks: number;
	avgPosition: number | null;
};

/**
 * The shared read every other Checkpoint 9 module builds on
 * (`refresh/staleness.ts` for trend detection, `learning/calibration.ts`
 * for adaptive-scoring feedback) — computed once here rather than each
 * caller re-deriving its own version of "how is this article doing".
 *
 * Reuses three existing reads rather than re-deriving their aggregation
 * logic: `listArticlesForAdmin` (Checkpoint 3), `getTopArticles`/
 * `getCtaClickCounts` (Checkpoint 5's `insights_top_articles`/
 * `insights_cta_click_counts` RPCs). Only the search-performance join
 * (`search_performance_metrics` → article, via `matchArticleUrl`) is new
 * — everything else is composition, not duplication.
 *
 * `window`, when given, replaces the default trailing-from-now behaviour
 * with an explicit `[start, end)` range — used by refresh evaluation so a
 * baseline/after comparison is anchored to the refresh date, not to
 * whenever the comparison happens to run (see
 * `content-intelligence/refresh/refreshLog.ts`). Every other caller keeps
 * calling this with just `daysBack`, unaffected.
 */
export async function getArticlePerformance(daysBack = 30, window?: PerformanceWindow): Promise<ArticlePerformanceRow[]> {
	const supabase = await createSupabaseServerClient();
	if (!supabase) return [];

	const [articles, viewRows, ctaRows] = await Promise.all([
		listArticlesForAdmin({ status: "published" }),
		getTopArticles(daysBack, 500, window),
		getCtaClickCounts(daysBack, window),
	]);

	if (articles.length === 0) return [];

	// search_performance_metrics is daily data (metric_date, not a
	// timestamp) -- window.start/end get truncated to a calendar date
	// here, unlike the first-party side above which keeps full precision.
	let searchQuery = supabase.from("search_performance_metrics").select("page_url, impressions, clicks, avg_position");
	if (window) {
		searchQuery = searchQuery
			.gte("metric_date", window.start.toISOString().slice(0, 10))
			.lt("metric_date", window.end.toISOString().slice(0, 10));
	} else {
		const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
		searchQuery = searchQuery.gte("metric_date", cutoff);
	}
	const { data: searchRows } = await searchQuery;

	const viewsByKey = new Map<string, number>();
	for (const row of viewRows) viewsByKey.set(`${row.locale}:${row.slug}`, row.viewCount);

	const ctaBySlug = new Map<string, number>();
	for (const row of ctaRows) {
		ctaBySlug.set(row.slug, (ctaBySlug.get(row.slug) ?? 0) + row.clickCount);
	}

	const searchByKey = new Map<string, { impressions: number; clicks: number; positions: number[] }>();
	for (const row of searchRows ?? []) {
		const match = matchArticleUrl(row.page_url);
		if (!match) continue;
		const key = `${match.locale}:${match.slug}`;
		const existing = searchByKey.get(key) ?? { impressions: 0, clicks: 0, positions: [] };
		existing.impressions += row.impressions ?? 0;
		existing.clicks += row.clicks ?? 0;
		if (row.avg_position !== null) existing.positions.push(Number(row.avg_position));
		searchByKey.set(key, existing);
	}

	return articles.map((article): ArticlePerformanceRow => {
		const key = `${article.locale}:${article.slug}`;
		const search = searchByKey.get(key);
		const avgPosition =
			search && search.positions.length > 0 ? search.positions.reduce((a, b) => a + b, 0) / search.positions.length : null;

		return {
			articleId: article.id,
			locale: article.locale,
			slug: article.slug,
			title: article.title,
			publishedAt: article.publishedAt,
			updatedAt: article.updatedAt,
			views: viewsByKey.get(key) ?? 0,
			ctaClicks: ctaBySlug.get(article.slug) ?? 0,
			searchImpressions: search?.impressions ?? 0,
			searchClicks: search?.clicks ?? 0,
			avgPosition,
		};
	});
}
