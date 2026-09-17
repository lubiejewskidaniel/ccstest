import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/supabase/adminAuth";
import { getArticlePerformance, type PerformanceWindow } from "../monitoring/performanceAnalysis";
import { getRefreshSignalsForArticle } from "./staleness";
import type { Locale } from "@/lib/routes";

/**
 * Refresh Intelligence Feedback Loop — Phase 1. Measurement and evidence
 * only: nothing here writes to or reads from scoring_calibration,
 * content_opportunities, or recomputeOpportunities().
 */

const MAX_BASELINE_DAYS = 30;
// Below this many days live, there isn't enough prior signal to ever
// compare against, no matter how long we wait afterwards.
const MIN_BASELINE_DAYS = 7;
// Same floor calibration.ts already uses for "long enough to judge a
// performance change" — reused rather than inventing a second number.
const MIN_EVALUATION_DAYS = 14;
// A baseline engagement score below this is too small a base for a
// percentage change to mean anything (e.g. 1 view -> 2 views isn't "+100%").
const MIN_ENGAGEMENT_BASE = 5;
const ENGAGEMENT_CHANGE_THRESHOLD = 0.2;
const POSITION_CHANGE_THRESHOLD = 3;
// Same weighting calibration.ts already uses (views + ctaClicks*5) —
// traffic alone doesn't determine success (Decision 12).
const CTA_CLICK_WEIGHT = 5;

export type RefreshEvaluationStatus = "pending" | "improved" | "neutral" | "declined" | "insufficient_data";

export type RefreshLogRow = {
	id: string;
	articleId: string;
	locale: Locale;
	triggeredAt: string;
	reasons: string[];
	baselineWindowDays: number;
	baselineViews: number;
	baselineCtaClicks: number;
	baselineSearchImpressions: number;
	baselineSearchClicks: number;
	baselineAvgPosition: number | null;
	evaluationWindowDays: number | null;
	evaluationStatus: RefreshEvaluationStatus;
	evaluatedAt: string | null;
	afterViews: number | null;
	afterCtaClicks: number | null;
	afterSearchImpressions: number | null;
	afterSearchClicks: number | null;
	afterAvgPosition: number | null;
};

type RefreshMetrics = {
	views: number;
	ctaClicks: number;
	searchImpressions: number;
	searchClicks: number;
	avgPosition: number | null;
};

/** Pure and deterministic — conservative on purpose: a mixed signal (one
 * dimension up, the other down) is "neutral", never forced into
 * improved/declined. No single magic score. */
export function classifyRefreshOutcome(baseline: RefreshMetrics, after: RefreshMetrics): RefreshEvaluationStatus {
	const beforeEngagement = baseline.views + baseline.ctaClicks * CTA_CLICK_WEIGHT;
	const afterEngagement = after.views + after.ctaClicks * CTA_CLICK_WEIGHT;
	const hasPosition = baseline.avgPosition !== null && after.avgPosition !== null;

	if (beforeEngagement === 0 && afterEngagement === 0 && !hasPosition) return "insufficient_data";

	type Signal = "up" | "down" | "flat";
	let engagementSignal: Signal | null = null;
	if (beforeEngagement === 0 && afterEngagement > 0) {
		engagementSignal = "up";
	} else if (beforeEngagement >= MIN_ENGAGEMENT_BASE) {
		const pct = (afterEngagement - beforeEngagement) / beforeEngagement;
		engagementSignal = pct >= ENGAGEMENT_CHANGE_THRESHOLD ? "up" : pct <= -ENGAGEMENT_CHANGE_THRESHOLD ? "down" : "flat";
	}

	let positionSignal: Signal | null = null;
	if (hasPosition) {
		// Lower position is better, so a positive delta is improvement.
		const delta = baseline.avgPosition! - after.avgPosition!;
		positionSignal = delta >= POSITION_CHANGE_THRESHOLD ? "up" : delta <= -POSITION_CHANGE_THRESHOLD ? "down" : "flat";
	}

	if (engagementSignal === null && positionSignal === null) return "insufficient_data";

	const signals = [engagementSignal, positionSignal].filter((s): s is Signal => s !== null);
	const up = signals.includes("up");
	const down = signals.includes("down");

	if (up && !down) return "improved";
	if (down && !up) return "declined";
	return "neutral";
}

/** Same rule `evaluateRefresh` enforces server-side, exported so the
 * refresh page can show/hide the Evaluate button without duplicating it. */
export function isEligibleForEvaluation(row: Pick<RefreshLogRow, "evaluationStatus" | "triggeredAt" | "evaluationWindowDays">): boolean {
	if (row.evaluationStatus !== "pending" || row.evaluationWindowDays === null) return false;
	const requiredDays = Math.max(row.evaluationWindowDays, MIN_EVALUATION_DAYS);
	const elapsedDays = Math.floor((Date.now() - new Date(row.triggeredAt).getTime()) / (24 * 60 * 60 * 1000));
	return elapsedDays >= requiredDays;
}

/** Days remaining until `isEligibleForEvaluation` would return true. 0 if
 * already eligible or terminal. */
export function daysUntilEvaluable(row: Pick<RefreshLogRow, "evaluationStatus" | "triggeredAt" | "evaluationWindowDays">): number {
	if (row.evaluationStatus !== "pending" || row.evaluationWindowDays === null) return 0;
	const requiredDays = Math.max(row.evaluationWindowDays, MIN_EVALUATION_DAYS);
	const elapsedDays = Math.floor((Date.now() - new Date(row.triggeredAt).getTime()) / (24 * 60 * 60 * 1000));
	return Math.max(0, requiredDays - elapsedDays);
}

function mapRow(row: Record<string, unknown>): RefreshLogRow {
	return {
		id: row.id as string,
		articleId: row.article_id as string,
		locale: row.locale as Locale,
		triggeredAt: row.triggered_at as string,
		reasons: (row.reasons as string[]) ?? [],
		baselineWindowDays: row.baseline_window_days as number,
		baselineViews: row.baseline_views as number,
		baselineCtaClicks: row.baseline_cta_clicks as number,
		baselineSearchImpressions: row.baseline_search_impressions as number,
		baselineSearchClicks: row.baseline_search_clicks as number,
		baselineAvgPosition: row.baseline_avg_position === null ? null : Number(row.baseline_avg_position),
		evaluationWindowDays: row.evaluation_window_days as number | null,
		evaluationStatus: row.evaluation_status as RefreshEvaluationStatus,
		evaluatedAt: row.evaluated_at as string | null,
		afterViews: row.after_views as number | null,
		afterCtaClicks: row.after_cta_clicks as number | null,
		afterSearchImpressions: row.after_search_impressions as number | null,
		afterSearchClicks: row.after_search_clicks as number | null,
		afterAvgPosition: row.after_avg_position === null ? null : (row.after_avg_position as number | null),
	};
}

export type RecordRefreshResult =
	| { ok: true; created: boolean }
	| { ok: false; kind: "auth"; message: string }
	| { ok: false; kind: "not_found"; message: string }
	| { ok: false; kind: "persistence"; message: string };

/** What the caller (updateArticleAction, the only real caller) must
 * establish itself, from the actual save path, before this function ever
 * runs -- never re-derived here from a post-save read. `triggeredAt` is
 * captured right after `updateArticle` resolves successfully, the
 * closest this codebase's CMS write path gets to "the save boundary"
 * without updateArticle itself returning the row's new updated_at.
 * `articleUpdatedAtBefore` must come from a read taken before that same
 * updateArticle call. */
export type RefreshSaveContext = {
	triggeredAt: Date;
	articleUpdatedAtBefore: string;
};

// Postgres SQLSTATE for a unique-constraint violation -- the real code
// Supabase's PostgrestError carries, not a message-text guess.
const UNIQUE_VIOLATION = "23505";

/**
 * Called only from a successful article save originating from the
 * refresh workflow (src/lib/actions/insightsCms.ts). Re-derives the
 * article's current reasons/baseline from real data — the caller's
 * "this was a refresh save" intent is trusted, nothing else is; even
 * `context`'s two fields are the caller's own server-derived facts about
 * the save it just performed, never anything from the submitted form.
 *
 * `created: false` means a pending episode already exists for this
 * article (found by the pre-check, or by losing a genuine race on the
 * insert itself -- see the unique partial index in migration 016) and
 * nothing new was written. Not an error either way.
 */
export async function recordRefreshIfEligible(articleId: string, context: RefreshSaveContext): Promise<RecordRefreshResult> {
	const session = await getAdminSession();
	if (!session?.isEditor) return { ok: false, kind: "auth", message: "You must be signed in as an editor to do this." };

	const supabase = await createSupabaseServerClient();
	if (!supabase) return { ok: false, kind: "persistence", message: "Supabase isn't configured in this environment." };

	const { data: existingPending } = await supabase
		.from("article_refresh_log")
		.select("id")
		.eq("article_id", articleId)
		.eq("evaluation_status", "pending")
		.limit(1)
		.maybeSingle();
	if (existingPending) return { ok: true, created: false };

	const signals = await getRefreshSignalsForArticle(articleId);
	if (!signals) return { ok: false, kind: "not_found", message: "Article isn't published, or has no performance data yet." };
	const { article, reasons } = signals;

	const { triggeredAt } = context;
	const daysLive = article.publishedAt
		? Math.floor((triggeredAt.getTime() - new Date(article.publishedAt).getTime()) / (24 * 60 * 60 * 1000))
		: 0;
	const baselineWindowDays = Math.max(1, Math.min(MAX_BASELINE_DAYS, daysLive));
	const window: PerformanceWindow = {
		start: new Date(triggeredAt.getTime() - baselineWindowDays * 24 * 60 * 60 * 1000),
		end: triggeredAt,
	};

	const baseline = (await getArticlePerformance(baselineWindowDays, window)).find((row) => row.articleId === articleId);

	const isSufficient = baselineWindowDays >= MIN_BASELINE_DAYS;

	const { error } = await supabase.from("article_refresh_log").insert({
		article_id: articleId,
		locale: article.locale,
		triggered_at: triggeredAt.toISOString(),
		reasons,
		article_updated_at_before: context.articleUpdatedAtBefore,
		baseline_window_days: baselineWindowDays,
		baseline_views: baseline?.views ?? 0,
		baseline_cta_clicks: baseline?.ctaClicks ?? 0,
		baseline_search_impressions: baseline?.searchImpressions ?? 0,
		baseline_search_clicks: baseline?.searchClicks ?? 0,
		baseline_avg_position: baseline?.avgPosition ?? null,
		evaluation_window_days: isSufficient ? baselineWindowDays : null,
		evaluation_status: isSufficient ? "pending" : "insufficient_data",
		created_by: session.userId,
	});

	if (error) {
		// Lost a genuine race against another concurrent refresh-originated
		// save for this same article -- a pending episode exists either way.
		if (error.code === UNIQUE_VIOLATION) return { ok: true, created: false };
		return { ok: false, kind: "persistence", message: error.message };
	}
	return { ok: true, created: true };
}

export type EvaluateRefreshResult =
	| { ok: true; status: RefreshEvaluationStatus }
	| { ok: false; kind: "auth"; message: string }
	| { ok: false; kind: "not_found"; message: string }
	| { ok: false; kind: "not_eligible"; message: string }
	| { ok: false; kind: "persistence"; message: string };

/** Manually triggered only -- no cron, no auto-evaluate on page load. */
export async function evaluateRefresh(refreshLogId: string): Promise<EvaluateRefreshResult> {
	const session = await getAdminSession();
	if (!session?.isEditor) return { ok: false, kind: "auth", message: "You must be signed in as an editor to do this." };

	const supabase = await createSupabaseServerClient();
	if (!supabase) return { ok: false, kind: "persistence", message: "Supabase isn't configured in this environment." };

	const { data: row } = await supabase.from("article_refresh_log").select("*").eq("id", refreshLogId).maybeSingle();
	if (!row) return { ok: false, kind: "not_found", message: "Refresh record not found." };

	if (row.evaluation_status !== "pending") {
		// Already resolved -- idempotent, never re-evaluated or overwritten.
		return { ok: true, status: row.evaluation_status as RefreshEvaluationStatus };
	}

	const triggeredAt = new Date(row.triggered_at as string);
	const evaluationWindowDays = row.evaluation_window_days as number;
	const mapped = mapRow(row);
	if (!isEligibleForEvaluation(mapped)) {
		const remaining = daysUntilEvaluable(mapped);
		return { ok: false, kind: "not_eligible", message: `Evaluation is available in ${remaining} more day(s).` };
	}

	const window: PerformanceWindow = {
		start: triggeredAt,
		end: new Date(triggeredAt.getTime() + evaluationWindowDays * 24 * 60 * 60 * 1000),
	};
	const after = (await getArticlePerformance(evaluationWindowDays, window)).find((r) => r.articleId === row.article_id);

	// The article is no longer in the published performance set (e.g.
	// unpublished since the refresh) -- nothing real to compare.
	const status: RefreshEvaluationStatus = !after
		? "insufficient_data"
		: classifyRefreshOutcome(
				{
					views: row.baseline_views as number,
					ctaClicks: row.baseline_cta_clicks as number,
					searchImpressions: row.baseline_search_impressions as number,
					searchClicks: row.baseline_search_clicks as number,
					avgPosition: row.baseline_avg_position === null ? null : Number(row.baseline_avg_position),
				},
				{
					views: after.views,
					ctaClicks: after.ctaClicks,
					searchImpressions: after.searchImpressions,
					searchClicks: after.searchClicks,
					avgPosition: after.avgPosition,
				},
			);

	// The `.eq("evaluation_status", "pending")` guard is the actual
	// concurrency control -- Postgres serializes concurrent updates to the
	// same row, so only one racing evaluateRefresh() call can match it.
	// `.select()` gets back the row(s) this call itself transitioned,
	// which is what tells the loser it lost -- a zero-row result is a
	// *successful* no-op response from Supabase, not an error.
	const { data: transitioned, error } = await supabase
		.from("article_refresh_log")
		.update({
			after_views: after?.views ?? null,
			after_cta_clicks: after?.ctaClicks ?? null,
			after_search_impressions: after?.searchImpressions ?? null,
			after_search_clicks: after?.searchClicks ?? null,
			after_avg_position: after?.avgPosition ?? null,
			evaluation_status: status,
			evaluated_at: new Date().toISOString(),
		})
		.eq("id", refreshLogId)
		.eq("evaluation_status", "pending")
		.select("evaluation_status");

	if (error) return { ok: false, kind: "persistence", message: error.message };

	if (!transitioned || transitioned.length === 0) {
		// Lost the race -- another evaluateRefresh() call already resolved
		// this episode. Read back the actual stored status rather than
		// claiming our own, possibly different, locally-computed one.
		const { data: current } = await supabase.from("article_refresh_log").select("evaluation_status").eq("id", refreshLogId).maybeSingle();
		return { ok: true, status: (current?.evaluation_status as RefreshEvaluationStatus | undefined) ?? status };
	}

	return { ok: true, status };
}

export async function listRefreshHistory(limit = 25): Promise<RefreshLogRow[]> {
	const supabase = await createSupabaseServerClient();
	if (!supabase) return [];

	const { data } = await supabase.from("article_refresh_log").select("*").order("triggered_at", { ascending: false }).limit(limit);

	return (data ?? []).map(mapRow);
}

/** Whether this article currently has an open (pending) measurement
 * episode -- the refresh page uses this to tell an editor "already being
 * measured" instead of silently doing nothing on their next save. */
export async function hasPendingRefresh(articleId: string): Promise<boolean> {
	const supabase = await createSupabaseServerClient();
	if (!supabase) return false;

	const { data } = await supabase
		.from("article_refresh_log")
		.select("id")
		.eq("article_id", articleId)
		.eq("evaluation_status", "pending")
		.limit(1)
		.maybeSingle();

	return Boolean(data);
}
