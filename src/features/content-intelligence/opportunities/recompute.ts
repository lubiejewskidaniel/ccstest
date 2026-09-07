import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/supabase/adminAuth";
import { scoreOpportunity } from "./score";
import { getLatestCalibrationMultiplier } from "../learning/calibration";

export type RecomputeResult =
	| { ok: true; opportunitiesUpdated: number; historyWarning: string | null }
	| { ok: false; kind: "auth"; message: string }
	| { ok: false; kind: "persistence"; message: string };

type MetricRow = {
	query: string;
	locale: string | null;
	source: "google" | "bing";
	impressions: number;
	clicks: number;
	avg_position: number | null;
};

type QueryAggregate = {
	// Every distinct non-null locale seen across this query's contributing
	// rows — a Set, not "whichever row came first", so the final locale
	// resolution below is deterministic instead of accidental. See the
	// resolution rule in the map() below for why more than one distinct
	// value collapses to `null` rather than picking one arbitrarily.
	locales: Set<string>;
	googleImpressions: number;
	googleClicks: number;
	bingImpressions: number;
	bingClicks: number;
	// Accumulated for an impression-weighted average position (see
	// below) rather than a flat list of already-averaged values.
	positionWeightedSum: number;
	positionWeight: number;
};

type ComputedOpportunityRow = {
	query: string;
	locale: string | null;
	total_clicks: number;
	total_impressions: number;
	avg_position: number | null;
	opportunity_score: number;
	matched_article_id: string | null;
	google_impressions: number;
	google_clicks: number;
	bing_impressions: number;
	bing_clicks: number;
};

// Shape returned by both the pre-upsert read (existing state) and the
// post-upsert `.select()` (new state) — same columns either way, used to
// decide whether a change is worth a history snapshot.
type OpportunitySnapshot = {
	id: string;
	query: string;
	opportunity_score: number;
	total_impressions: number;
	total_clicks: number;
	avg_position: number | null;
	google_impressions: number;
	google_clicks: number;
	bing_impressions: number;
	bing_clicks: number;
};

const HISTORY_COLUMNS =
	"id, query, opportunity_score, total_impressions, total_clicks, avg_position, google_impressions, google_clicks, bing_impressions, bing_clicks";

/** Rounds to 2dp before comparing — `avg_position`/`opportunity_score`
 * are both `numeric(_, 2)` columns, but values read back through
 * supabase-js can carry float noise (e.g. `12.099999999999998`) that a
 * strict `!==` would treat as "changed" even though nothing meaningful
 * did. */
function round2(value: number | null): number | null {
	return value === null ? null : Math.round(value * 100) / 100;
}

/**
 * Whether `next` differs from `existing` in any field a history snapshot
 * should care about. `existing` is `undefined` for a query that has no
 * `content_opportunities` row yet — always a "change" (the first
 * snapshot for a brand-new opportunity).
 */
function hasMeaningfulChange(existing: OpportunitySnapshot | undefined, next: OpportunitySnapshot): boolean {
	if (!existing) return true;
	return (
		round2(existing.opportunity_score) !== round2(next.opportunity_score) ||
		existing.total_impressions !== next.total_impressions ||
		existing.total_clicks !== next.total_clicks ||
		round2(existing.avg_position) !== round2(next.avg_position) ||
		existing.google_impressions !== next.google_impressions ||
		existing.google_clicks !== next.google_clicks ||
		existing.bing_impressions !== next.bing_impressions ||
		existing.bing_clicks !== next.bing_clicks
	);
}

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
 *
 * Grouping key is `query` only, deliberately NOT `(locale, query)` —
 * documented as a temporary Phase 1 limitation, not the final
 * architecture. `search_performance_metrics.locale` is never populated
 * by either provider today (`keywords/ingest.ts` doesn't set it), so
 * every row currently has `locale = null`; grouping by a field that's
 * null for 100% of current data would be indistinguishable from
 * grouping by query alone today, while introducing a real risk if
 * locale population is added later out of band (rows for the same query
 * could split into fragmented opportunities the moment some rows gain a
 * locale and others don't). CCS is bilingual (EN/PL), and identical
 * technical queries — "SEO", "SaaS", "React", "API", "CRM", "AI" — can
 * legitimately occur in both locales, so `(locale, query)` grouping is a
 * real, deliberate future direction, to be revisited once locale
 * provenance is actually designed and populated upstream — not
 * something to half-implement on data that doesn't exist yet.
 *
 * What *is* fixed here: locale resolution is now deterministic instead
 * of "whichever row the aggregation Map happened to see first" (a pure
 * accident of iteration order, not a real decision). A query's resolved
 * locale is: the single distinct non-null locale, if exactly one
 * appears across its contributing rows; `null` if none appear (today's
 * universal case); and `null` if two or more conflicting non-null
 * locales appear for the same query text, rather than arbitrarily
 * keeping whichever was seen first — a genuine cross-locale collision
 * (e.g. a shared brand term or English loanword typed by both an EN and
 * a PL searcher) shouldn't be mislabeled with a single locale that only
 * fits part of its traffic.
 *
 * Source attribution: `google_impressions`/`google_clicks` and
 * `bing_impressions`/`bing_clicks` are tracked separately through
 * aggregation (rather than summed into one opaque total, as before) so
 * `content_opportunities` — and, from it, the planner UI — can tell
 * whether an opportunity's demand comes from Google, Bing, or both.
 * `total_impressions`/`total_clicks` remain the sum of both, unchanged
 * in value from before this change, just no longer the only thing
 * stored.
 *
 * `avg_position` is now an impression-weighted mean across every
 * contributing row, not a flat average of already-averaged per-row
 * values. The previous flat mean let a low-volume day/source (e.g. 5
 * impressions at position 40) count exactly as much as a high-volume
 * one (5,000 impressions at position 8) — mathematically misleading,
 * since the high-volume day represents far more of the query's real
 * search visibility. Weighting by impressions (not clicks) is
 * deliberate: position describes how a query ranks for every
 * impression, not just the smaller, CTR-dependent clicked-through
 * subset, so weighting by clicks would let an unusually high-CTR day
 * dominate a day with far more actual ranking volume.
 */
export async function recomputeOpportunities(): Promise<RecomputeResult> {
	const session = await getAdminSession();
	if (!session?.isEditor) return { ok: false, kind: "auth", message: "You must be signed in as an editor to do this." };

	const supabase = await createSupabaseServerClient();
	if (!supabase) return { ok: false, kind: "persistence", message: "Supabase isn't configured in this environment." };

	const { data: metrics, error: metricsError } = await supabase
		.from("search_performance_metrics")
		.select("query, locale, source, impressions, clicks, avg_position");

	if (metricsError) return { ok: false, kind: "persistence", message: metricsError.message };
	if (!metrics || metrics.length === 0) return { ok: true, opportunitiesUpdated: 0, historyWarning: null };

	const byQuery = new Map<string, QueryAggregate>();
	for (const row of metrics as MetricRow[]) {
		const existing = byQuery.get(row.query) ?? {
			locales: new Set<string>(),
			googleImpressions: 0,
			googleClicks: 0,
			bingImpressions: 0,
			bingClicks: 0,
			positionWeightedSum: 0,
			positionWeight: 0,
		};

		if (row.locale) existing.locales.add(row.locale);

		if (row.source === "google") {
			existing.googleImpressions += row.impressions;
			existing.googleClicks += row.clicks;
		} else {
			existing.bingImpressions += row.impressions;
			existing.bingClicks += row.clicks;
		}

		if (row.avg_position !== null && row.impressions > 0) {
			existing.positionWeightedSum += row.avg_position * row.impressions;
			existing.positionWeight += row.impressions;
		}

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
	// Unchanged by this phase — still the same multiply-after-scoring
	// step, now just applied to a correctly source-attributed,
	// correctly-weighted set of inputs.
	const calibration = await getLatestCalibrationMultiplier();

	const rows: ComputedOpportunityRow[] = Array.from(byQuery.entries()).map(([query, agg]) => {
		const totalImpressions = agg.googleImpressions + agg.bingImpressions;
		const totalClicks = agg.googleClicks + agg.bingClicks;
		const avgPosition = agg.positionWeight > 0 ? agg.positionWeightedSum / agg.positionWeight : null;
		const locale = agg.locales.size === 1 ? (Array.from(agg.locales)[0] ?? null) : null;

		const baseScore = scoreOpportunity({ totalImpressions, totalClicks, avgPosition });

		return {
			query,
			locale,
			total_clicks: totalClicks,
			total_impressions: totalImpressions,
			avg_position: avgPosition,
			opportunity_score: Math.round(baseScore * calibration * 100) / 100,
			matched_article_id: findMatchedArticleId(query),
			google_impressions: agg.googleImpressions,
			google_clicks: agg.googleClicks,
			bing_impressions: agg.bingImpressions,
			bing_clicks: agg.bingClicks,
		};
	});

	// Read pre-upsert state for every query about to be written, so the
	// history insert below can tell a genuine change from a no-op
	// recompute. A query with no existing row yet simply won't appear in
	// `existingByQuery` — treated as "new" (always snapshotted) by
	// `hasMeaningfulChange()`.
	const queries = rows.map((row) => row.query);
	const { data: existingRows } = await supabase
		.from("content_opportunities")
		.select(HISTORY_COLUMNS)
		.in("query", queries);

	const existingByQuery = new Map<string, OpportunitySnapshot>((existingRows ?? []).map((row) => [row.query, row]));

	// `.select()` after `.upsert()` returns the post-upsert rows
	// (including `id`, generated for brand-new queries) via PostgREST's
	// `Prefer: return=representation` — one round trip instead of a
	// second fetch just to learn the ids history needs.
	const { data: upserted, error: upsertError } = await supabase
		.from("content_opportunities")
		.upsert(rows, { onConflict: "query" })
		.select(HISTORY_COLUMNS);

	if (upsertError) return { ok: false, kind: "persistence", message: upsertError.message };

	// --- Consistency note (opportunity upsert vs. history insert) -----
	// These are two separate Supabase calls, not one transaction. If the
	// upsert above succeeds and the history insert below fails, the
	// *current* opportunity data (scores, source attribution — the
	// primary, user-facing product of this function) is already correct
	// and committed; only the secondary audit trail is missing an entry
	// for this run. A failure here does not roll back the upsert, and
	// deliberately doesn't retry it either — recompute is idempotent and
	// safe to re-run, but a later re-run with unchanged inputs would see
	// content_opportunities already reflecting the new values and
	// (correctly) conclude nothing changed, so it would NOT retroactively
	// backfill the missed snapshot. That's judged an acceptable trade-off
	// for one internal analytics table: the failure mode is a gap in an
	// audit log, not incorrect live data, and this codebase's own
	// established pattern for multi-step Supabase writes (see
	// briefs/promote.ts's handling of a primary-article success /
	// localized-article failure) is to accept partial completion and
	// surface it clearly rather than wrap everything in an RPC
	// transaction. What must NOT happen is silently reporting `ok: true`
	// with no indication anything was wrong — `historyWarning` carries
	// that forward to the caller (and from there, the toolbar UI) instead
	// of swallowing it.
	const historyRows = (upserted ?? [])
		.filter((row) => hasMeaningfulChange(existingByQuery.get(row.query), row))
		.map((row) => ({
			opportunity_id: row.id,
			opportunity_score: row.opportunity_score,
			total_impressions: row.total_impressions,
			total_clicks: row.total_clicks,
			avg_position: row.avg_position,
			google_impressions: row.google_impressions,
			google_clicks: row.google_clicks,
			bing_impressions: row.bing_impressions,
			bing_clicks: row.bing_clicks,
		}));

	let historyWarning: string | null = null;
	if (historyRows.length > 0) {
		const { error: historyError } = await supabase.from("opportunity_score_history").insert(historyRows);
		if (historyError) {
			historyWarning = `Opportunity scores were updated, but ${historyRows.length} history snapshot(s) failed to save: ${historyError.message}`;
		}
	}

	return { ok: true, opportunitiesUpdated: rows.length, historyWarning };
}
