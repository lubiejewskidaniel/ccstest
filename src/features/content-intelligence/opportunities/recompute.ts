import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/supabase/adminAuth";
import { scoreOpportunity } from "./score";
import { getLatestCalibrationMultiplier } from "../learning/calibration";

export type RecomputeResult =
	| { ok: true; opportunitiesUpdated: number }
	| { ok: false; kind: "auth"; message: string }
	| { ok: false; kind: "persistence"; message: string };

type MetricRow = { query: string; locale: string | null; impressions: number; clicks: number; avg_position: number | null };

/**
 * Aggregates every ingested `search_performance_metrics` row (across
 * source and date) by query, scores each with `scoreOpportunity()`, and
 * upserts the result into `content_opportunities`. Re-running this
 * always reflects the latest ingested data — it's a recompute, not an
 * append (docs/INSIGHTS_DATABASE.md-equivalent note in the migration).
 *
 * "Already covered" detection is a simple heuristic: a query matches an
 * existing published article when the query text appears in that
 * article's title or excerpt (case-insensitive substring). This stays a
 * heuristic on purpose even after Checkpoint 9 added a real page-URL→
 * article join (`monitoring/matchArticleUrl.ts`, used by performance
 * analysis and cannibalisation detection) — that join answers "is this
 * URL actually ranking for this query", a different question from "is
 * there already an article that could plausibly cover this topic",
 * which is all "already covered" here needs to answer.
 */
export async function recomputeOpportunities(): Promise<RecomputeResult> {
	const session = await getAdminSession();
	if (!session?.isEditor) return { ok: false, kind: "auth", message: "You must be signed in as an editor to do this." };

	const supabase = await createSupabaseServerClient();
	if (!supabase) return { ok: false, kind: "persistence", message: "Supabase isn't configured in this environment." };

	const { data: metrics, error: metricsError } = await supabase
		.from("search_performance_metrics")
		.select("query, locale, impressions, clicks, avg_position");

	if (metricsError) return { ok: false, kind: "persistence", message: metricsError.message };
	if (!metrics || metrics.length === 0) return { ok: true, opportunitiesUpdated: 0 };

	const byQuery = new Map<string, { locale: string | null; impressions: number; clicks: number; positions: number[] }>();
	for (const row of metrics as MetricRow[]) {
		const existing = byQuery.get(row.query) ?? { locale: row.locale, impressions: 0, clicks: 0, positions: [] };
		existing.impressions += row.impressions;
		existing.clicks += row.clicks;
		if (row.avg_position !== null) existing.positions.push(row.avg_position);
		byQuery.set(row.query, existing);
	}

	// Candidate articles for the "already covered" match — title/excerpt
	// only (public columns, no need for the full CMS admin read here).
	const { data: articles } = await supabase
		.from("insights_articles")
		.select("id, title, excerpt")
		.eq("status", "published");

	function findMatchedArticleId(query: string): string | null {
		const needle = query.toLowerCase();
		const match = (articles ?? []).find(
			(article) => article.title.toLowerCase().includes(needle) || article.excerpt.toLowerCase().includes(needle),
		);
		return match?.id ?? null;
	}

	// Checkpoint 9 "adaptive scoring" — a single, auditable multiplier
	// derived from how past opportunity scores actually played out
	// (learning/calibration.ts), applied uniformly here rather than
	// changing scoreOpportunity()'s own formula. Defaults to 1 (no
	// change in behavior) until at least one calibration has run.
	const calibration = await getLatestCalibrationMultiplier();

	const rows = Array.from(byQuery.entries()).map(([query, agg]) => {
		const avgPosition = agg.positions.length > 0 ? agg.positions.reduce((a, b) => a + b, 0) / agg.positions.length : null;
		const baseScore = scoreOpportunity({ totalImpressions: agg.impressions, totalClicks: agg.clicks, avgPosition });
		return {
			query,
			locale: agg.locale,
			total_clicks: agg.clicks,
			total_impressions: agg.impressions,
			avg_position: avgPosition,
			opportunity_score: Math.round(baseScore * calibration * 100) / 100,
			matched_article_id: findMatchedArticleId(query),
		};
	});

	const { error: upsertError } = await supabase.from("content_opportunities").upsert(rows, { onConflict: "query" });
	if (upsertError) return { ok: false, kind: "persistence", message: upsertError.message };

	return { ok: true, opportunitiesUpdated: rows.length };
}
