import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getArticlePerformance, type ArticlePerformanceRow } from "../monitoring/performanceAnalysis";
import { matchArticleUrl } from "../monitoring/matchArticleUrl";

export type RefreshCandidate = ArticlePerformanceRow & {
	ageDays: number;
	reasons: string[];
	refreshScore: number;
};

const DEFAULT_STALE_DAYS = 180;

function staleDaysThreshold(): number {
	const days = Number(process.env.CONTENT_REFRESH_STALE_DAYS);
	return Number.isFinite(days) && days > 0 ? days : DEFAULT_STALE_DAYS;
}

/**
 * Compares each article's average search position over the last 30 days
 * against the prior 30 days (days 31-60 back) — a rising number means a
 * falling position (position 1 is best), which is the concrete "this
 * article is losing ground" signal Decision 13 ("content refresh is as
 * important as new content generation") needs something other than raw
 * age to act on.
 */
async function positionTrendByKey(): Promise<Map<string, { recent: number; prior: number }>> {
	const supabase = await createSupabaseServerClient();
	const result = new Map<string, { recent: number; prior: number }>();
	if (!supabase) return result;

	const now = Date.now();
	const day = 24 * 60 * 60 * 1000;
	const recentCutoff = new Date(now - 30 * day).toISOString().slice(0, 10);
	const priorCutoff = new Date(now - 60 * day).toISOString().slice(0, 10);

	const { data } = await supabase
		.from("search_performance_metrics")
		.select("page_url, metric_date, avg_position")
		.gte("metric_date", priorCutoff)
		.not("avg_position", "is", null);

	const buckets = new Map<string, { recent: number[]; prior: number[] }>();
	for (const row of data ?? []) {
		const match = matchArticleUrl(row.page_url);
		if (!match) continue;
		const key = `${match.locale}:${match.slug}`;
		const bucket = buckets.get(key) ?? { recent: [], prior: [] };
		if (row.metric_date >= recentCutoff) bucket.recent.push(Number(row.avg_position));
		else bucket.prior.push(Number(row.avg_position));
		buckets.set(key, bucket);
	}

	for (const [key, bucket] of buckets) {
		if (bucket.recent.length === 0 || bucket.prior.length === 0) continue;
		result.set(key, {
			recent: bucket.recent.reduce((a, b) => a + b, 0) / bucket.recent.length,
			prior: bucket.prior.reduce((a, b) => a + b, 0) / bucket.prior.length,
		});
	}

	return result;
}

/**
 * Ranks published articles by how much they need editorial attention —
 * age past the stale threshold and/or a worsening search position trend
 * both count, and both are surfaced as explicit `reasons` rather than a
 * single opaque number, so an editor can see *why* something was
 * flagged, not just that it was.
 */
export async function listRefreshCandidates(limit = 25): Promise<RefreshCandidate[]> {
	const [performance, trends] = await Promise.all([getArticlePerformance(30), positionTrendByKey()]);

	const staleDays = staleDaysThreshold();
	const now = Date.now();

	const candidates: RefreshCandidate[] = performance.map((article) => {
		const anchor = article.publishedAt ?? article.updatedAt;
		const ageDays = Math.floor((now - new Date(anchor).getTime()) / (24 * 60 * 60 * 1000));

		const reasons: string[] = [];
		let refreshScore = 0;

		if (ageDays >= staleDays) {
			reasons.push(`Not updated in ${ageDays} days (threshold: ${staleDays}).`);
			refreshScore += Math.min(ageDays / staleDays, 3) * 10;
		}

		const trend = trends.get(`${article.locale}:${article.slug}`);
		if (trend && trend.recent > trend.prior + 2) {
			const drop = trend.recent - trend.prior;
			reasons.push(`Average search position worsened by ${drop.toFixed(1)} over the last 30 days.`);
			refreshScore += Math.min(drop, 20);
		}

		if (article.searchImpressions > 0 && article.searchClicks === 0) {
			reasons.push("Getting search impressions but no clicks — title/excerpt may no longer match search intent.");
			refreshScore += 5;
		}

		return { ...article, ageDays, reasons, refreshScore };
	});

	return candidates
		.filter((candidate) => candidate.reasons.length > 0)
		.sort((a, b) => b.refreshScore - a.refreshScore)
		.slice(0, limit);
}
