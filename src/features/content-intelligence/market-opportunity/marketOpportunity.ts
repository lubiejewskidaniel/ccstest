import type { MarketKeywordObservationRow } from "../market/queries";
import { evaluateMarketTrend } from "../market/trend";
import type { MarketTrendResult } from "../market/trend";
import { evaluateOpportunityTrend } from "../opportunities/trend";
import type { TrendResult, TrendSnapshot } from "../opportunities/trend";
import { evaluateBusinessRelevance, normalize } from "./businessRelevance";
import { evaluateContentCoverage } from "./contentCoverage";
import type { ArticleCandidateForCoverage } from "./contentCoverage";
import { evaluateEvidenceConfidence } from "./evidenceConfidence";
import type {
	BusinessRelevanceEvidence,
	CcsTrendEvidence,
	CcsVisibilityEvidence,
	ContentCoverageEvidence,
	EvidenceConfidenceEvidence,
	FirstPartyQueryMatchEvidence,
	MarketDemandEvidence,
	MarketOpportunityClassification,
	MarketOpportunityEvidence,
	MarketOpportunitySubject,
} from "./types";

/**
 * Phase 3C.1D — Market Opportunity Assembly & Evidence Classification.
 *
 * Assembles market-demand evidence, first-party CCS visibility/trend,
 * business relevance, content coverage, and evidence confidence into
 * one explainable `MarketOpportunityEvidence` per subject, plus a small
 * set of deterministic, non-actionable evidence classifications. This
 * module never adds an action recommendation ("write this", "publish
 * that") and never computes a marketOpportunityScore — those are
 * explicitly out of scope.
 *
 * -- Purity -------------------------------------------------------------
 * Pure assembly only: no Supabase, no environment access, no `Date.now`,
 * no side effects. Every real evaluator this module depends on
 * (`evaluateMarketTrend`, `evaluateOpportunityTrend`,
 * `evaluateBusinessRelevance`, `evaluateContentCoverage`,
 * `evaluateEvidenceConfidence`) is called exactly as documented on its
 * own module, unmodified, and its result is either passed through
 * verbatim or read from (never re-derived). The I/O side — fetching
 * `marketObservations`/`firstPartyCandidates`/`articleCandidates` from
 * Supabase — is a future Phase 3C.1E orchestrator's job, not this one's.
 *
 * -- Query matching: conservative by design ----------------------------
 * `content_opportunities.query` and `market_keywords.keyword` are both
 * stored raw/verbatim (no normalization at write time — see
 * `keywords/ingest.ts` and `opportunities/recompute.ts`), so a market
 * keyword and a first-party query naming the same real-world search term
 * can differ in case, whitespace, or punctuation without differing in
 * meaning. `matchFirstPartyQuery` below tries raw exact equality first,
 * then `normalize()`d equality (reused from `businessRelevance.ts`, not
 * reimplemented) — and stops there. It deliberately does NOT attempt
 * phrase containment: unlike business-relevance/content-coverage's
 * containment check (a known vocabulary term inside free-form prose),
 * both sides here are already specific, comparable-granularity search
 * queries — containment between two queries risks silently conflating a
 * broad head-term with an unrelated, more specific long-tail query. A
 * missed match (false negative) is preferred over a wrong one (false
 * confidence). No fuzzy matching, embeddings, or LLM involved.
 *
 * -- Ambiguity is never silently resolved -------------------------------
 * When two or more distinct first-party queries normalize to the same
 * keyword, NO candidate is chosen and NO history is aggregated — there
 * is no mathematically justified rule to blend two unrelated
 * opportunities' visibility or trend. `ccsHistory` in that case is
 * `null`, which `evaluateEvidenceConfidence()` already handles correctly
 * (medium-cap, `first_party_history_missing`) without any change to that
 * module — ambiguity is preserved separately in `firstPartyMatch`/
 * `ccsTrend.status`, not smuggled into confidence's own vocabulary.
 *
 * -- Latest raw market values: independent per channel ------------------
 * `market/trend.ts`'s own `MarketTrendResult` never exposes a raw
 * "latest observed value" (only window means and period-start strings),
 * so `latestObserved()` below fills that specific, narrow gap — picking
 * the single most recent eligible row per channel, using the exact same
 * eligibility filter and `periodStart`/`fetchedAt` tie-break that
 * `market/trend.ts` already uses internally, copied for consistency, not
 * reinvented. Strict and broad are selected in two entirely separate
 * passes: a row that is strict-eligible but not broad-eligible (or vice
 * versa) must never cause one channel's latest value to leak into, or
 * erase, the other's.
 */

export type FirstPartyOpportunityCandidate = {
	id: string;
	/** Raw content_opportunities.query, as stored. */
	query: string;
	totalImpressions: number;
	totalClicks: number;
	avgPosition: number | null;
	googleImpressions: number;
	bingImpressions: number;
	opportunityScore: number;
	/** This candidate's opportunity_score_history rows — any order,
	 * `evaluateOpportunityTrend` sorts internally by `computedAt`. */
	scoreHistory: TrendSnapshot[];
};

export type EvaluateMarketOpportunityInput = {
	subject: MarketOpportunitySubject;
	/** Every observation ever recorded for this subject's
	 * (provider, keyword, market) — any order, both evaluateMarketTrend
	 * and latestObserved() sort/filter internally. */
	marketObservations: MarketKeywordObservationRow[];
	/** Candidate content_opportunities rows to match subject.keyword
	 * against — not pre-filtered or pre-matched by the caller. */
	firstPartyCandidates: FirstPartyOpportunityCandidate[];
	/** Candidate published articles, passed through unchanged to
	 * evaluateContentCoverage(). */
	articleCandidates: ArticleCandidateForCoverage[];
};

// ---------------------------------------------------------------------------
// First-party query matching
// ---------------------------------------------------------------------------

function matchFirstPartyQuery(
	keyword: string,
	candidates: FirstPartyOpportunityCandidate[],
): FirstPartyQueryMatchEvidence {
	const rawExactMatches = candidates.filter((candidate) => candidate.query === keyword);
	if (rawExactMatches.length === 1) {
		const match = rawExactMatches[0]!;
		return { kind: "exact", opportunityId: match.id, matchedQuery: match.query };
	}

	// Raw exact equality is expected to be unique by construction
	// (content_opportunities.query carries a database UNIQUE constraint),
	// so `rawExactMatches.length > 1` should never occur against real
	// data. If a caller nonetheless supplies duplicate raw-equal rows
	// (e.g. a hand-built test fixture), falling through here is still
	// safe: those same rows are also normalized-exact matches of each
	// other, so they correctly resolve to "ambiguous" below rather than
	// this function silently picking one of them.

	const keywordNormalized = normalize(keyword);
	const normalizedMatches = candidates.filter((candidate) => normalize(candidate.query) === keywordNormalized);

	if (normalizedMatches.length === 0) {
		return { kind: "none" };
	}

	if (normalizedMatches.length === 1) {
		const match = normalizedMatches[0]!;
		return { kind: "normalized_exact", opportunityId: match.id, matchedQuery: match.query };
	}

	const candidateOpportunityIds = Array.from(new Set(normalizedMatches.map((candidate) => candidate.id))).sort(
		(a, b) => (a < b ? -1 : a > b ? 1 : 0),
	);

	return { kind: "ambiguous", candidateOpportunityIds };
}

// ---------------------------------------------------------------------------
// Latest raw market evidence (per channel, independent)
// ---------------------------------------------------------------------------

type LatestObservedValue = { latestObservedImpressions: number | null; latestObservedPeriod: string | null };

/**
 * Picks the single most recent eligible row's value for one channel.
 * `getValue` selects which channel (impressions vs broadImpressions) —
 * called once for strict, once for broad, over the same row list, so
 * neither channel's result can leak into or overwrite the other's.
 * Eligibility: `status === "observed"`, `periodStart !== null`, and this
 * channel's own value `!== null` — a `no_data` row is never eligible for
 * either channel. Tie-break on a shared `periodStart`: greatest
 * `fetchedAt` wins, mirroring `market/trend.ts`'s own `groupByPeriod`
 * dedup rule (a string comparison, consistent with that module's own
 * `fetchedAt` comparisons — periodStart/fetchedAt are both ISO strings,
 * so lexical order matches chronological order).
 */
function latestObserved(
	rows: MarketKeywordObservationRow[],
	getValue: (row: MarketKeywordObservationRow) => number | null,
): LatestObservedValue {
	type Eligible = { periodStart: string; value: number; fetchedAt: string };

	const eligible: Eligible[] = [];
	for (const row of rows) {
		if (row.status !== "observed" || row.periodStart === null) continue;
		const value = getValue(row);
		if (value === null) continue;
		eligible.push({ periodStart: row.periodStart, value, fetchedAt: row.fetchedAt });
	}

	if (eligible.length === 0) {
		return { latestObservedImpressions: null, latestObservedPeriod: null };
	}

	let winner = eligible[0]!;
	for (const candidate of eligible.slice(1)) {
		const isNewerPeriod = candidate.periodStart > winner.periodStart;
		const isSamePeriodButNewerFetch = candidate.periodStart === winner.periodStart && candidate.fetchedAt > winner.fetchedAt;
		if (isNewerPeriod || isSamePeriodButNewerFetch) {
			winner = candidate;
		}
	}

	return { latestObservedImpressions: winner.value, latestObservedPeriod: winner.periodStart };
}

function buildMarketDemandEvidence(rows: MarketKeywordObservationRow[]): MarketDemandEvidence {
	return {
		trend: evaluateMarketTrend(rows),
		strict: latestObserved(rows, (row) => row.impressions),
		broad: latestObserved(rows, (row) => row.broadImpressions),
	};
}

// ---------------------------------------------------------------------------
// First-party visibility / trend
// ---------------------------------------------------------------------------

function findMatchedCandidate(
	opportunityId: string,
	candidates: FirstPartyOpportunityCandidate[],
): FirstPartyOpportunityCandidate {
	// Exactly one candidate has this id by construction — matchFirstPartyQuery
	// only ever produces an "exact"/"normalized_exact" opportunityId that
	// came from one of `candidates` itself.
	return candidates.find((candidate) => candidate.id === opportunityId)!;
}

function buildCcsVisibility(
	match: FirstPartyQueryMatchEvidence,
	candidates: FirstPartyOpportunityCandidate[],
): CcsVisibilityEvidence {
	if (match.kind === "none") {
		return { status: "no_match" };
	}
	if (match.kind === "ambiguous") {
		return { status: "ambiguous_match", candidateCount: match.candidateOpportunityIds.length };
	}

	const candidate = findMatchedCandidate(match.opportunityId, candidates);

	return {
		status: "matched",
		opportunityId: candidate.id,
		matchedQuery: candidate.query,
		matchKind: match.kind,
		totalImpressions: candidate.totalImpressions,
		totalClicks: candidate.totalClicks,
		avgPosition: candidate.avgPosition,
		googleImpressions: candidate.googleImpressions,
		bingImpressions: candidate.bingImpressions,
		opportunityScore: candidate.opportunityScore,
	};
}

function buildCcsTrend(
	match: FirstPartyQueryMatchEvidence,
	candidates: FirstPartyOpportunityCandidate[],
): { ccsTrend: CcsTrendEvidence; ccsHistory: TrendResult | null } {
	if (match.kind === "none") {
		return { ccsTrend: { status: "no_match" }, ccsHistory: null };
	}
	if (match.kind === "ambiguous") {
		return {
			ccsTrend: { status: "ambiguous_match", candidateCount: match.candidateOpportunityIds.length },
			ccsHistory: null,
		};
	}

	const candidate = findMatchedCandidate(match.opportunityId, candidates);
	const trend = evaluateOpportunityTrend(candidate.scoreHistory);

	return { ccsTrend: { status: "matched", opportunityId: candidate.id, trend }, ccsHistory: trend };
}

// ---------------------------------------------------------------------------
// Classifications
// ---------------------------------------------------------------------------

/**
 * Fixed evaluation order: market_growth, market_decline, covered_market,
 * not_relevant, weak_evidence, insufficient_data — always in this order,
 * filtered to whichever apply. Non-exclusive: market_growth and
 * market_decline can both be present (e.g. strict rising, broad
 * declining) — see the module doc comment on why that's correct, not a
 * bug.
 */
function computeClassifications(input: {
	marketTrend: MarketTrendResult;
	contentCoverageLevel: ContentCoverageEvidence["level"];
	businessRelevanceLevel: BusinessRelevanceEvidence["level"];
	evidenceConfidenceLevel: EvidenceConfidenceEvidence["level"];
	marketChannelsUsable: EvidenceConfidenceEvidence["factors"]["marketChannelsUsable"];
}): MarketOpportunityClassification[] {
	const classifications: MarketOpportunityClassification[] = [];

	if (input.marketTrend.strict.direction === "rising" || input.marketTrend.broad.direction === "rising") {
		classifications.push("market_growth");
	}
	if (input.marketTrend.strict.direction === "declining" || input.marketTrend.broad.direction === "declining") {
		classifications.push("market_decline");
	}
	if (input.contentCoverageLevel === "title_match") {
		classifications.push("covered_market");
	}
	if (input.businessRelevanceLevel === "none") {
		classifications.push("not_relevant");
	}
	if (input.evidenceConfidenceLevel === "low") {
		classifications.push("weak_evidence");
	}
	if (input.marketChannelsUsable === 0) {
		classifications.push("insufficient_data");
	}

	return classifications;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Assembles one subject's full Market Opportunity Evidence. Pure and
 * deterministic: identical logical input (regardless of array ordering
 * in `marketObservations`/`firstPartyCandidates`) always produces a
 * deeply identical result, except where a reused evaluator's own
 * documented contract says otherwise (e.g. `evaluateContentCoverage`'s
 * `titleMatches`/`excerptOnlyMatches` preserve the caller's
 * `articleCandidates` order by its own existing design — this module
 * does not re-sort that output).
 */
export function evaluateMarketOpportunity(input: EvaluateMarketOpportunityInput): MarketOpportunityEvidence {
	const { subject, marketObservations, firstPartyCandidates, articleCandidates } = input;

	const marketDemand = buildMarketDemandEvidence(marketObservations);
	const firstPartyMatch = matchFirstPartyQuery(subject.keyword, firstPartyCandidates);
	const ccsVisibility = buildCcsVisibility(firstPartyMatch, firstPartyCandidates);
	const { ccsTrend, ccsHistory } = buildCcsTrend(firstPartyMatch, firstPartyCandidates);

	const businessRelevance = evaluateBusinessRelevance(subject.keyword);
	const contentCoverage = evaluateContentCoverage({
		keyword: subject.keyword,
		market: subject.market,
		articles: articleCandidates,
	});
	const evidenceConfidence = evaluateEvidenceConfidence({
		market: marketDemand.trend,
		contentMapping: contentCoverage.mapping,
		ccsHistory,
	});

	const classifications = computeClassifications({
		marketTrend: marketDemand.trend,
		contentCoverageLevel: contentCoverage.level,
		businessRelevanceLevel: businessRelevance.level,
		evidenceConfidenceLevel: evidenceConfidence.level,
		marketChannelsUsable: evidenceConfidence.factors.marketChannelsUsable,
	});

	return {
		subject,
		marketDemand,
		firstPartyMatch,
		ccsVisibility,
		ccsTrend,
		contentCoverage,
		businessRelevance,
		evidenceConfidence,
		classifications,
	};
}
