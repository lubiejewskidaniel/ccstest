import { createSupabaseServerClient } from "@/lib/supabase/server";
import { matchArticleUrl } from "../monitoring/matchArticleUrl";
import type { Locale } from "@/lib/routes";

export type CannibalisationPage = { locale: Locale; slug: string; impressions: number; clicks: number; avgPosition: number | null };
export type CannibalisationRow = { query: string; pages: CannibalisationPage[]; totalImpressions: number };

/**
 * Flags queries where two or more distinct, real Insights articles both
 * received search impressions in the same window — a direct signal that
 * the site is competing with itself for a term instead of one article
 * clearly owning it (master instruction Checkpoint 9 "cannibalisation").
 * Uses the same `matchArticleUrl` join as `monitoring/performanceAnalysis.ts`
 * so a page URL that doesn't resolve to a real article can't be
 * miscounted as a second competing page.
 */
export async function detectCannibalisation(daysBack = 30, limit = 25): Promise<CannibalisationRow[]> {
	const supabase = await createSupabaseServerClient();
	if (!supabase) return [];

	const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

	const { data } = await supabase
		.from("search_performance_metrics")
		.select("query, page_url, impressions, clicks, avg_position")
		.gte("metric_date", cutoff)
		.neq("page_url", "");

	const byQuery = new Map<string, Map<string, CannibalisationPage>>();

	for (const row of data ?? []) {
		const match = matchArticleUrl(row.page_url);
		if (!match) continue;

		const pages = byQuery.get(row.query) ?? new Map<string, CannibalisationPage>();
		const pageKey = `${match.locale}:${match.slug}`;
		const existing = pages.get(pageKey) ?? { locale: match.locale, slug: match.slug, impressions: 0, clicks: 0, avgPosition: null };

		existing.impressions += row.impressions ?? 0;
		existing.clicks += row.clicks ?? 0;
		if (row.avg_position !== null) {
			existing.avgPosition = existing.avgPosition === null ? Number(row.avg_position) : (existing.avgPosition + Number(row.avg_position)) / 2;
		}

		pages.set(pageKey, existing);
		byQuery.set(row.query, pages);
	}

	const rows: CannibalisationRow[] = [];
	for (const [query, pages] of byQuery) {
		if (pages.size < 2) continue; // only one article for this query - not cannibalisation
		const pageList = Array.from(pages.values());
		rows.push({
			query,
			pages: pageList.sort((a, b) => b.impressions - a.impressions),
			totalImpressions: pageList.reduce((sum, page) => sum + page.impressions, 0),
		});
	}

	return rows.sort((a, b) => b.totalImpressions - a.totalImpressions).slice(0, limit);
}
