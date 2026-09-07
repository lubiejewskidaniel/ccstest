/**
 * Phase 3C.1A — Business taxonomy & business relevance foundation.
 *
 * Deliberately minimal: this file contains ONLY the types the
 * business-taxonomy/business-relevance slice of Phase 3C.1 actually
 * needs right now. Later increments (content coverage, evidence
 * confidence, market demand, CCS visibility, the top-level
 * MarketOpportunityEvidence and its classifications) each get their own
 * types added when THAT increment is implemented — nothing is
 * pre-declared here. See the Phase 3C.1 architecture report and its
 * specification-correction follow-up for the full future shape; this
 * file is not a preview of those later types.
 *
 * No dependency on market/types.ts or opportunities/ on purpose:
 * business relevance describes whether a topic relates to CCS's
 * business at all, independent of which market (Bing keyword,
 * country/language) it came from — see businessRelevance.ts's own doc
 * comment on why MarketCode never enters this module.
 */

/** The six existing CCS capability keys from ServicesPage.tsx, reused
 * verbatim rather than inventing a parallel taxonomy. ServicesPage.tsx
 * itself is not imported here — it is UI/presentation code with no
 * exported constant for these keys — so this union is the deliberate
 * single source of truth for the key spelling from here on. */
export type BusinessTaxonomyPillarKey =
	| "software-development"
	| "product-development"
	| "technology-consulting"
	| "web-digital"
	| "growth-marketing"
	| "mentoring";

/**
 * One capability pillar's matchable vocabulary.
 *
 * `terms` are phrases that literally name something CCS sells —
 * matching one of these is what produces `businessRelevance.level ===
 * "core"`. `adjacentTerms` are related-but-less-specific phrases —
 * matching one of these (with no `terms` match) produces `"adjacent"`.
 * This two-tier split is the entire mechanism behind the three-level
 * BusinessRelevanceLevel below — a fourth, in-between level was
 * considered and rejected in the specification-correction report
 * because it would need a third term tier with no independent evidence
 * to justify where its threshold sits.
 */
export type BusinessTaxonomyPillar = {
	key: BusinessTaxonomyPillarKey;
	/** Short human-readable description of what this pillar covers —
	 * documentation only, never read by the matcher. */
	purpose: string;
	terms: { en: string[]; pl: string[] };
	adjacentTerms: { en: string[]; pl: string[] };
};

/**
 * "none" | "adjacent" | "core" — exactly three levels, not four. See
 * BusinessTaxonomyPillar's doc comment for why a fourth was rejected.
 */
export type BusinessRelevanceLevel = "none" | "adjacent" | "core";

/** Which of a pillar's two term lists produced a given match. */
export type BusinessRelevanceTermTier = "term" | "adjacentTerm";

/** Which of a term's two language lists produced a given match.
 * Independent of any market/locale — see businessRelevance.ts. */
export type BusinessRelevanceLanguage = "en" | "pl";

/** One matched taxonomy entry, kept as its own record (never collapsed
 * into just a level) so a caller can explain *why* a keyword was
 * classified the way it was. */
export type BusinessRelevanceMatch = {
	pillarKey: BusinessTaxonomyPillarKey;
	/** The taxonomy entry's own text, verbatim as declared in
	 * businessTaxonomy.ts — not the normalized/tokenized form. */
	matchedTerm: string;
	matchedTermTier: BusinessRelevanceTermTier;
	matchedLanguage: BusinessRelevanceLanguage;
};

/**
 * Full result for one keyword. `matches` is never truncated to "the
 * best one" — when both a `term` and an `adjacentTerm` match (in the
 * same or different pillars), `level` is still "core" (a `term` match
 * always wins — see businessRelevance.ts), but every match, at every
 * tier, stays in `matches` for explainability. Ordering is deterministic
 * — see evaluateBusinessRelevance's own doc comment for the exact rule.
 */
export type BusinessRelevanceEvidence = {
	level: BusinessRelevanceLevel;
	matches: BusinessRelevanceMatch[];
};

// ============================================================
// Phase 3C.1B — Content Coverage
// ============================================================
//
// Added here because these four types are the approved cross-cutting
// evidence contract for content coverage (mirrors how Phase 3C.1A's
// BusinessRelevance* types live here). The article-candidate input
// shape and the evaluator's parameter object are NOT added here — they
// are implementation-scoped to contentCoverage.ts itself, not a shared
// evidence contract, so they stay local to that module.

/**
 * "none" | "mention" | "title_match" — never a numeric score. See
 * contentCoverage.ts's own doc comment for the exact deterministic
 * rule that produces each level.
 */
export type ContentCoverageLevel = "none" | "mention" | "title_match";

/**
 * How confidently a single article can be pointed to as "the" coverage
 * for a keyword — a SEPARATE concern from coverage strength (`level`).
 * `null` only when `level === "none"` (there is nothing to be
 * ambiguous about). See contentCoverage.ts for the exact rule.
 */
export type ContentMappingConfidence = "unambiguous" | "ambiguous" | null;

/** One published article that matched, kept minimal — just enough to
 * identify and link to it. */
export type ContentCoverageMatch = {
	articleId: string;
	locale: "en" | "pl";
	slug: string;
};

export type ContentCoverageEvidence = {
	level: ContentCoverageLevel;
	mapping: ContentMappingConfidence;
	/** Every eligible published article whose TITLE contains the full
	 * normalized keyword phrase. */
	titleMatches: ContentCoverageMatch[];
	/** Every eligible published article whose EXCERPT (but not title)
	 * contains the full normalized keyword phrase — never contains an
	 * article that is also in `titleMatches` (see contentCoverage.ts). */
	excerptOnlyMatches: ContentCoverageMatch[];
};

// ============================================================
// Phase 3C.1C — Evidence Confidence
// ============================================================
//
// Confidence answers ONE question: how complete/corroborated is the
// evidence CCS has currently assembled about a market keyword — never
// how strong, valuable, or business-relevant that keyword is. It is
// deliberately blind to BusinessRelevanceEvidence (not part of
// evaluateEvidenceConfidence's input type at all) and to
// ContentCoverageEvidence.level (only ContentMappingConfidence, a
// narrower concern about *which* article maps to a keyword, is
// consulted — see evidenceConfidence.ts). A high-confidence weak
// opportunity and a low-confidence promising one are both valid,
// simultaneous outcomes; this type must never be blended with
// opportunity strength or a future marketOpportunityScore.
//
// This is the only section of this file with a cross-module import
// (`TrendHistoryDepth` from `opportunities/trend.ts`) — deliberately
// reused verbatim rather than relabeled, so confidence never drifts
// from that module's own tiers. The business-relevance and
// content-coverage sections above remain fully independent of
// market/opportunities, exactly as their own doc comments state.

import type { TrendHistoryDepth, TrendResult } from "../opportunities/trend";

/**
 * Pairwise relationship between the strict and broad market-demand
 * channels' directions (`market/trend.ts`'s `MarketTrendResult.strict`/
 * `.broad`). Only meaningful when both channels are usable — see
 * evidenceConfidence.ts's own doc comment for the exact usability rule
 * and the exact agree/mixed/conflict boundary. `"unknown"` when fewer
 * than two channels are usable — never silently treated as agreement.
 */
export type MarketDirectionAgreement = "agree" | "mixed" | "conflict" | "unknown";

/**
 * "low" | "medium" | "high" — a qualitative completeness/corroboration
 * label, never a percentage or weighted score. See
 * evaluateEvidenceConfidence's own doc comment for the exact
 * deterministic gates that produce each level.
 */
export type EvidenceConfidenceLevel = "low" | "medium" | "high";

/**
 * The raw, already-evaluated facts a confidence result was computed
 * from — kept alongside `level`/`limitingReasons` so a caller can see
 * exactly which underlying condition produced the classification,
 * without re-running evaluateEvidenceConfidence's own logic.
 */
export type EvidenceConfidenceFactors = {
	marketChannelsUsable: 0 | 1 | 2;
	marketAgreement: MarketDirectionAgreement;
	latestMarketFetchStatus: "observed" | "no_data" | "none";
	recentMarketNoDataCount: number;
	contentMappingAmbiguous: boolean;
	/**
	 * Mirrors `opportunities/trend.ts`'s own `TrendResult.historyDepth`
	 * verbatim when present — never relabeled or re-thresholded.
	 * `present: false` means no first-party opportunity/query exists yet
	 * for this keyword at all. That absence is a NEUTRAL fact about the
	 * keyword (not negative evidence) but it still means the overall
	 * evidence set is missing a corroborating channel, which is why it
	 * caps confidence at "medium" rather than allowing "high" — see
	 * evidenceConfidence.ts for the full reasoning.
	 */
	ccsFirstPartyHistory:
		| { present: false }
		| { present: true; historyDepth: TrendHistoryDepth };
};

/**
 * Small, finite, deterministic reason codes explaining which factors
 * limited a confidence result — always emitted in this declared order
 * (never object/iteration order), and always a plain list of every
 * ACTIVE limitation, not only the one that determined the final
 * `level` (a "low" result may still carry other, merely-informational
 * reasons alongside the one that actually forced "low").
 * `first_party_history_missing` and `first_party_history_thin` are
 * mutually exclusive by construction — they read opposite arms of
 * `ccsFirstPartyHistory`'s discriminated union — and are never emitted
 * together.
 */
export type EvidenceConfidenceLimitingReason =
	| "market_evidence_unusable"
	| "latest_market_fetch_unavailable"
	| "market_single_channel"
	| "market_signals_conflict"
	| "market_signals_mixed"
	| "recent_market_fetch_instability"
	| "content_mapping_ambiguous"
	| "first_party_history_missing"
	| "first_party_history_thin";

export type EvidenceConfidenceEvidence = {
	level: EvidenceConfidenceLevel;
	factors: EvidenceConfidenceFactors;
	limitingReasons: EvidenceConfidenceLimitingReason[];
};

// ============================================================
// Phase 3C.1D — Market Opportunity Assembly & Evidence Classification
// ============================================================
//
// Assembles market-demand, first-party visibility/trend, business
// relevance, content coverage, and evidence confidence into one
// explainable MarketOpportunityEvidence object for a single (keyword,
// provider, market) subject. This layer MAY carry descriptive evidence
// CLASSIFICATIONS (see MarketOpportunityClassification below) but must
// never carry action recommendations ("write this", "publish that") —
// those belong to a future Recommendation Engine, out of scope here.
// See marketOpportunity.ts for the exact assembly algorithm (query
// matching, per-channel latest-observation selection, classification
// rules) — this file only declares the shapes.

import type { MarketCode, MarketIntelligenceProviderId } from "../market/types";
import type { MarketTrendResult } from "../market/trend";

/**
 * The unit of analysis: one keyword, tracked via one provider, in one
 * explicit market. `market` is never inferred from `keyword` text, and
 * gb/en-GB is never merged with pl/pl-PL — see MarketCode.
 */
export type MarketOpportunitySubject = {
	/** Raw, as stored in market_keywords.keyword — never normalized or
	 * reinterpreted at this layer. */
	keyword: string;
	provider: MarketIntelligenceProviderId;
	market: MarketCode;
};

export type MarketDemandEvidence = {
	/** Reused verbatim from evaluateMarketTrend() — never re-evaluated or
	 * re-thresholded here. Scoped to the subject's provider (see
	 * MarketOpportunitySubject.provider); this type does not repeat that
	 * field itself, to avoid a second source of truth for provider
	 * identity. */
	trend: MarketTrendResult;
	/**
	 * This provider's own exact-match impression metric for the most
	 * recently OBSERVED period — NOT a universal "search volume" figure,
	 * and NOT necessarily from the same underlying row as `broad` (see
	 * marketOpportunity.ts's independent per-channel selection). `null`/
	 * `null` when no eligible observed row exists.
	 */
	strict: { latestObservedImpressions: number | null; latestObservedPeriod: string | null };
	/**
	 * This provider's own broad-match impression metric (Bing-specific
	 * today — see BingObservationDetails in market/types.ts), selected
	 * entirely independently of `strict`.
	 */
	broad: { latestObservedImpressions: number | null; latestObservedPeriod: string | null };
};

/**
 * How a market keyword was matched against CCS's own tracked
 * content_opportunities queries.
 *   - "exact": raw string equality. Can never be ambiguous by
 *     construction — content_opportunities.query carries a database
 *     UNIQUE constraint.
 *   - "normalized_exact": not raw-equal, but normalize() (reused from
 *     businessRelevance.ts, never reimplemented) produces the same
 *     string for exactly one candidate.
 *   - "ambiguous": two or more distinct candidate queries normalize to
 *     the same keyword — no candidate is chosen.
 *   - "none": no candidate matches at either tier. No phrase
 *     containment is attempted — see marketOpportunity.ts for why.
 */
export type QueryMatchKind = "exact" | "normalized_exact" | "ambiguous" | "none";

export type FirstPartyQueryMatchEvidence =
	| { kind: "none" }
	| { kind: "exact" | "normalized_exact"; opportunityId: string; matchedQuery: string }
	| {
			kind: "ambiguous";
			/** Deduplicated by id, then sorted lexically
			 * (`a < b ? -1 : a > b ? 1 : 0`) — never caller input order.
			 * See marketOpportunity.ts. */
			candidateOpportunityIds: string[];
	  };

/**
 * CCS's own first-party search-performance visibility for the matched
 * query, or an explicit representation of "there is nothing to read yet"
 * — `"no_match"` is NOT the same state as "matched with zero values",
 * and `"ambiguous_match"` never blends or guesses between candidates.
 */
export type CcsVisibilityEvidence =
	| { status: "no_match" }
	| { status: "ambiguous_match"; candidateCount: number }
	| {
			status: "matched";
			opportunityId: string;
			matchedQuery: string;
			matchKind: "exact" | "normalized_exact";
			/** Read verbatim from the matched content_opportunities row —
			 * never recomputed; scoreOpportunity() is never called here. */
			totalImpressions: number;
			totalClicks: number;
			avgPosition: number | null;
			googleImpressions: number;
			bingImpressions: number;
			opportunityScore: number;
	  };

/**
 * CCS's own first-party trend for the matched query. `trend` is a
 * `TrendResult` reused verbatim from evaluateOpportunityTrend() — never
 * redeclared or recomputed. `"ambiguous_match"` deliberately does not
 * select or aggregate a candidate's history — see marketOpportunity.ts.
 */
export type CcsTrendEvidence =
	| { status: "no_match" }
	| { status: "ambiguous_match"; candidateCount: number }
	| { status: "matched"; opportunityId: string; trend: TrendResult };

/**
 * Small, deterministic, non-exclusive descriptive labels — evidence
 * classifications, never action recommendations. See
 * marketOpportunity.ts for the exact per-classification rule and the
 * fixed evaluation order. `market_growth`/`market_decline` may both be
 * present at once (e.g. strict rising, broad declining) — classifying
 * what was observed is a different question from evaluating how much to
 * trust it (that's evidenceConfidence's job, kept fully separate).
 */
export type MarketOpportunityClassification =
	| "market_growth"
	| "market_decline"
	| "covered_market"
	| "not_relevant"
	| "weak_evidence"
	| "insufficient_data";

export type MarketOpportunityEvidence = {
	subject: MarketOpportunitySubject;
	marketDemand: MarketDemandEvidence;
	firstPartyMatch: FirstPartyQueryMatchEvidence;
	ccsVisibility: CcsVisibilityEvidence;
	ccsTrend: CcsTrendEvidence;
	/** Reused verbatim from evaluateContentCoverage(). */
	contentCoverage: ContentCoverageEvidence;
	/** Reused verbatim from evaluateBusinessRelevance(). */
	businessRelevance: BusinessRelevanceEvidence;
	/** Reused verbatim from evaluateEvidenceConfidence(). */
	evidenceConfidence: EvidenceConfidenceEvidence;
	/** Always in the fixed declared order (market_growth, market_decline,
	 * covered_market, not_relevant, weak_evidence, insufficient_data),
	 * filtered to whichever apply — never object/iteration order. */
	classifications: MarketOpportunityClassification[];
};
