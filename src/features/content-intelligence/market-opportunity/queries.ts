import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/supabase/adminAuth";
import { findMarketKeywordId, listMarketKeywordObservationsById } from "../market/queries";
import type { MarketKeywordObservationRow } from "../market/queries";
import { evaluateMarketOpportunity, matchFirstPartyQuery } from "./marketOpportunity";
import type { EvaluateMarketOpportunityInput, FirstPartyOpportunityCandidate } from "./marketOpportunity";
import type { ArticleCandidateForCoverage } from "./contentCoverage";
import type { ArticleStatus } from "../../insights/types/article";
import type { TrendSnapshot } from "../opportunities/trend";
import type { MarketOpportunityEvidence, MarketOpportunitySubject } from "./types";

/**
 * Phase 3C.1E — Market Opportunity Query / Data Orchestration Layer.
 *
 * The one server-only boundary that turns a `MarketOpportunitySubject`
 * into a real `MarketOpportunityEvidence` by fetching the data
 * `evaluateMarketOpportunity()` needs from Supabase and handing it over
 * unchanged. This module GATHERS data; it never INTERPRETS it — no
 * direction/coverage/relevance/confidence logic lives here, and the only
 * "decision" this file makes is which single first-party candidate (if
 * any) needs an `opportunity_score_history` fetch, using the exact same
 * exported `matchFirstPartyQuery()` that `evaluateMarketOpportunity()`
 * itself uses — never a second, competing implementation of that
 * matching logic.
 *
 * -- Auth / RLS -----------------------------------------------------
 * `import "server-only"` (matching `insights/cms/service.ts` /
 * `leads/service.ts`) keeps this out of client bundles entirely. Every
 * query uses `createSupabaseServerClient()` (the normal,
 * session-cookie-based, RLS-respecting client) — never
 * `createSupabasePrivilegedClient()` (service-role). RLS policies on
 * `market_keywords`/`market_keyword_observations`/`content_opportunities`/
 * `insights_articles` already gate select access to
 * `is_active_editor_or_admin()`; the explicit `getAdminSession()` check
 * below is deliberate defense-in-depth on top of that, not a
 * replacement for it. Configuration is checked BEFORE the auth check
 * (rather than after, as `opportunities/recompute.ts` does) so an
 * unconfigured environment is never misreported as an auth failure —
 * see the module's own test file for the scenario this avoids.
 *
 * -- Error semantics --------------------------------------------------
 * A genuine Supabase/query failure always becomes `storage_error`, never
 * silently reinterpreted as "no data" (an observations query error is
 * NOT the same as zero observations; an opportunities query error is NOT
 * the same as zero candidates). Conversely, real absence — a keyword
 * that exists but has no observations yet, zero first-party candidates,
 * zero matching articles — flows through to `evaluateMarketOpportunity()`
 * exactly as it would for any other caller, because those are evidence
 * states the evaluator already knows how to describe (insufficient_data,
 * weak_evidence, etc.), not failures to hide behind an error. Only a
 * missing `market_keywords` row gets its own named result
 * (`market_keyword_not_found`) — "never tracked at all" is a
 * categorically different fact from "tracked, but no data yet", and is
 * never fabricated into an empty evidence object.
 */

export type GetMarketOpportunityEvidenceResult =
	| { ok: true; evidence: MarketOpportunityEvidence }
	| { ok: false; kind: "auth"; message: string }
	| { ok: false; kind: "not_configured"; message: string }
	| { ok: false; kind: "market_keyword_not_found"; message: string }
	| { ok: false; kind: "storage_error"; message: string };

type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

type Outcome<T> = { status: "ok"; rows: T[] } | { status: "error"; message: string };

// ---------------------------------------------------------------------------
// Raw row shapes and mappers — one field-for-field mapping per table, no
// interpretation. See the module doc comment on "GATHERS, never
// INTERPRETS".
// ---------------------------------------------------------------------------

type RawFirstPartyOpportunityRow = {
	id: string;
	query: string;
	total_impressions: number;
	total_clicks: number;
	avg_position: number | null;
	google_impressions: number;
	bing_impressions: number;
	opportunity_score: number;
};

function mapFirstPartyOpportunityRow(row: RawFirstPartyOpportunityRow): FirstPartyOpportunityCandidate {
	return {
		id: row.id,
		query: row.query,
		totalImpressions: row.total_impressions,
		totalClicks: row.total_clicks,
		avgPosition: row.avg_position,
		googleImpressions: row.google_impressions,
		bingImpressions: row.bing_impressions,
		opportunityScore: row.opportunity_score,
		// Populated only for the single matched candidate — see
		// getMarketOpportunityEvidence()'s history-fetch step.
		scoreHistory: [],
	};
}

type RawScoreHistoryRow = {
	opportunity_score: number;
	total_impressions: number;
	total_clicks: number;
	avg_position: number | null;
	computed_at: string;
};

function mapScoreHistoryRow(row: RawScoreHistoryRow): TrendSnapshot {
	return {
		opportunityScore: row.opportunity_score,
		totalImpressions: row.total_impressions,
		totalClicks: row.total_clicks,
		avgPosition: row.avg_position,
		computedAt: row.computed_at,
	};
}

type RawArticleRow = {
	id: string;
	locale: "en" | "pl";
	slug: string;
	title: string;
	excerpt: string;
	status: string;
};

function mapArticleRow(row: RawArticleRow): ArticleCandidateForCoverage {
	return {
		id: row.id,
		locale: row.locale,
		slug: row.slug,
		title: row.title,
		excerpt: row.excerpt,
		status: row.status as ArticleStatus,
	};
}

// ---------------------------------------------------------------------------
// I/O helpers — each surfaces a genuine query error distinctly from
// "zero rows" (an empty `rows` array with `status: "ok"` is a normal
// result, never conflated with `status: "error"`).
// ---------------------------------------------------------------------------

/**
 * Every content_opportunities row, unfiltered — the pure matcher decides
 * which one (if any) is relevant. No raw/normalized filtering is done in
 * SQL: Postgres has no built-in equivalent of the application's
 * NFKC/punctuation/whitespace `normalize()`, and an approximate SQL-side
 * filter could disagree with it. No `status` (workflow) filter either —
 * that's an editorial-workflow concern `FirstPartyOpportunityCandidate`
 * doesn't carry and has no bearing on whether a query is legitimate
 * first-party evidence.
 */
async function fetchFirstPartyCandidates(supabase: SupabaseServerClient): Promise<Outcome<FirstPartyOpportunityCandidate>> {
	const { data, error } = await supabase
		.from("content_opportunities")
		.select("id, query, total_impressions, total_clicks, avg_position, google_impressions, bing_impressions, opportunity_score")
		.order("id", { ascending: true });

	if (error) return { status: "error", message: error.message };
	return { status: "ok", rows: ((data ?? []) as RawFirstPartyOpportunityRow[]).map(mapFirstPartyOpportunityRow) };
}

/** Called at most once per evaluation — only for a unique exact/normalized_exact match. */
async function fetchScoreHistory(supabase: SupabaseServerClient, opportunityId: string): Promise<Outcome<TrendSnapshot>> {
	const { data, error } = await supabase
		.from("opportunity_score_history")
		.select("opportunity_score, total_impressions, total_clicks, avg_position, computed_at")
		.eq("opportunity_id", opportunityId)
		.order("computed_at", { ascending: true });

	if (error) return { status: "error", message: error.message };
	return { status: "ok", rows: ((data ?? []) as RawScoreHistoryRow[]).map(mapScoreHistoryRow) };
}

/**
 * Published articles in both supported locales. `status = "published"`
 * is filtered in SQL — safe because it's an exact, literal equality
 * against the same value `contentCoverage.ts` itself checks, so it can
 * never disagree with that module's own rule; it only ever narrows
 * volume. Locale is deliberately NOT filtered in SQL even though
 * `subject.market` determines exactly one eligible locale:
 * `marketToEligibleArticleLocale` is a private, unexported mapping
 * inside `contentCoverage.ts`, and duplicating even a currently-trivial
 * switch here would create a second owner of a rule that module already
 * owns. Ordered by `published_at desc, id asc` — see the accompanying
 * report for why `published_at` is safe to rely on for exactly this
 * (published-only) row set.
 */
async function fetchArticleCandidates(supabase: SupabaseServerClient): Promise<Outcome<ArticleCandidateForCoverage>> {
	const { data, error } = await supabase
		.from("insights_articles")
		.select("id, locale, slug, title, excerpt, status")
		.eq("status", "published")
		.order("published_at", { ascending: false })
		.order("id", { ascending: true });

	if (error) return { status: "error", message: error.message };
	return { status: "ok", rows: ((data ?? []) as RawArticleRow[]).map(mapArticleRow) };
}

// ---------------------------------------------------------------------------
// Public orchestration
// ---------------------------------------------------------------------------

/**
 * Resolves one `MarketOpportunitySubject` to real `MarketOpportunityEvidence`
 * by fetching exactly the data `evaluateMarketOpportunity()` needs and
 * calling it exactly once. See the module doc comment for the full error
 * and auth model.
 */
export async function getMarketOpportunityEvidence(subject: MarketOpportunitySubject): Promise<GetMarketOpportunityEvidenceResult> {
	const supabase = await createSupabaseServerClient();
	if (!supabase) {
		return { ok: false, kind: "not_configured", message: "Supabase isn't configured in this environment." };
	}

	const session = await getAdminSession();
	if (!session?.isEditor) {
		return { ok: false, kind: "auth", message: "You must be signed in as an editor to view market opportunity evidence." };
	}

	const keywordLookup = await findMarketKeywordId(subject.provider, subject.keyword, subject.market);
	if (keywordLookup.status === "error") {
		return { ok: false, kind: "storage_error", message: keywordLookup.message };
	}
	if (keywordLookup.status === "not_found") {
		return {
			ok: false,
			kind: "market_keyword_not_found",
			message: "This keyword has never been tracked for this provider and market.",
		};
	}

	const observationsResult = await listMarketKeywordObservationsById(keywordLookup.id);
	if (observationsResult.status === "error") {
		return { ok: false, kind: "storage_error", message: observationsResult.message };
	}
	const marketObservations: MarketKeywordObservationRow[] = observationsResult.rows;

	const candidatesResult = await fetchFirstPartyCandidates(supabase);
	if (candidatesResult.status === "error") {
		return { ok: false, kind: "storage_error", message: candidatesResult.message };
	}
	const firstPartyCandidates = candidatesResult.rows;

	// Run the exact same pure matcher evaluateMarketOpportunity() will run
	// internally, purely to decide whether a history fetch is needed and
	// for which one candidate — never to reinterpret the match itself.
	const match = matchFirstPartyQuery(subject.keyword, firstPartyCandidates);

	let candidatesWithHistory = firstPartyCandidates;
	if (match.kind === "exact" || match.kind === "normalized_exact") {
		const historyResult = await fetchScoreHistory(supabase, match.opportunityId);
		if (historyResult.status === "error") {
			return { ok: false, kind: "storage_error", message: historyResult.message };
		}
		candidatesWithHistory = firstPartyCandidates.map((candidate) =>
			candidate.id === match.opportunityId ? { ...candidate, scoreHistory: historyResult.rows } : candidate,
		);
	}
	// "none" and "ambiguous" -> zero history queries, by construction.

	const articlesResult = await fetchArticleCandidates(supabase);
	if (articlesResult.status === "error") {
		return { ok: false, kind: "storage_error", message: articlesResult.message };
	}

	const input: EvaluateMarketOpportunityInput = {
		subject,
		marketObservations,
		firstPartyCandidates: candidatesWithHistory,
		articleCandidates: articlesResult.rows,
	};

	return { ok: true, evidence: evaluateMarketOpportunity(input) };
}
