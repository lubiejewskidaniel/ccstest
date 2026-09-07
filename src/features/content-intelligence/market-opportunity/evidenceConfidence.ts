import type { MarketTrendDirection, MarketTrendResult } from "../market/trend";
import type { TrendResult } from "../opportunities/trend";
import type {
	ContentMappingConfidence,
	EvidenceConfidenceEvidence,
	EvidenceConfidenceFactors,
	EvidenceConfidenceLevel,
	EvidenceConfidenceLimitingReason,
	MarketDirectionAgreement,
} from "./types";

/**
 * Phase 3C.1C — Evidence Confidence.
 *
 * Answers ONE question: how complete/corroborated is the evidence CCS
 * has currently assembled about a market keyword? This is deliberately
 * NOT a measure of opportunity strength, business relevance, or content
 * coverage strength — a high-confidence weak opportunity and a
 * low-confidence promising one are both valid, simultaneous outcomes.
 * See types.ts's own doc comment on EvidenceConfidenceEvidence for the
 * same principle stated at the type level.
 *
 * -- Purity ---------------------------------------------------------
 * This module never touches Supabase, never fetches anything, and never
 * will — it takes three already-evaluated public results
 * (`MarketTrendResult`, `ContentMappingConfidence`, `TrendResult | null`)
 * and returns a plain evidence object. It deliberately does NOT accept
 * business relevance, content-coverage *level*, raw impressions, raw
 * observations, `content_opportunities` rows, or article data — those
 * are either irrelevant to confidence (business relevance, coverage
 * level — see the hard exclusion below) or would require re-deriving
 * logic this module doesn't own (raw impressions/observations belong to
 * market/trend.ts). `EvaluateEvidenceConfidenceInput` below is
 * deliberately narrow: TypeScript's excess-property checking on object
 * literals means a caller cannot even accidentally pass those fields in.
 *
 * -- No re-derivation -------------------------------------------------
 * `market/trend.ts` already owns every threshold that decides whether a
 * market metric's direction can be trusted (WINDOW_SIZE, cadence,
 * duplicate periods, the low-volume floor) — a non-zero
 * `duplicatePeriodCount` or an under-filled window is already folded
 * into `direction === "insufficient_data"` by that module. This module
 * never re-checks period counts, cadence, duplicates, or volume; it only
 * ever asks `direction !== "insufficient_data"` ("is this channel
 * usable"). The same discipline applies to `opportunities/trend.ts`'s
 * `TrendHistoryDepth` — reused verbatim in `EvidenceConfidenceFactors`,
 * never relabeled or re-thresholded.
 *
 * -- Business relevance / coverage level: hard exclusion -------------
 * Neither `BusinessRelevanceEvidence` nor `ContentCoverageEvidence.level`
 * is part of this module's input type at all — not filtered out
 * internally, structurally absent. Only
 * `ContentCoverageEvidence.mapping` (passed in directly as
 * `ContentMappingConfidence`) is confidence-relevant, because ambiguity
 * about *which* article maps to a keyword is a genuine evidence-quality
 * concern, whereas coverage strength is not.
 *
 * -- Absence vs weakness ------------------------------------------------
 * A rule that runs through this module: the ABSENCE of an evidence
 * category (nothing to evaluate) is never treated as equivalent to WEAK
 * evidence within that category.
 *   - `mapping === null` (no article matched at all, i.e.
 *     `ContentCoverageEvidence.level === "none"`) is neutral, not a
 *     penalty — "no match" can be a perfectly certain result. Only
 *     `mapping === "ambiguous"` (real uncertainty about which article is
 *     "the" match) reduces confidence.
 *   - `ccsHistory === null` (no tracked opportunity/query exists yet for
 *     this keyword) is NOT negative evidence about the keyword — CCS
 *     simply hasn't engaged it yet. It still caps confidence at "medium"
 *     rather than being fully neutral the way `mapping === null` is,
 *     because it represents a real gap in what could have been
 *     assembled (first-party history could exist for any keyword this
 *     evaluator is asked about), whereas a null content mapping only
 *     ever happens when coverage genuinely doesn't exist — there was
 *     never anything to be ambiguous about.
 */

function isUsable(direction: MarketTrendDirection): boolean {
	return direction !== "insufficient_data";
}

/**
 * Pairwise agreement between two ALREADY-USABLE market directions.
 * Callers must gate on `marketChannelsUsable === 2` first — this
 * function has no "unknown" case of its own.
 *
 *   - identical labels            -> "agree" (including "volatile"
 *     paired with itself — same classification, even though "volatile"
 *     itself denotes instability).
 *   - {"rising","declining"} pair -> "conflict" (a direct, opposite-
 *     direction contradiction about which way the market is moving).
 *   - any other unequal pairing   -> "mixed" (e.g. rising vs stable,
 *     stable vs volatile) — real divergence, but not a flat
 *     contradiction, so treated as a softer signal than "conflict".
 */
function agreementBetweenUsableDirections(
	strictDirection: MarketTrendDirection,
	broadDirection: MarketTrendDirection,
): Exclude<MarketDirectionAgreement, "unknown"> {
	if (strictDirection === broadDirection) {
		return "agree";
	}

	const isOppositePair =
		(strictDirection === "rising" && broadDirection === "declining") ||
		(strictDirection === "declining" && broadDirection === "rising");

	return isOppositePair ? "conflict" : "mixed";
}

export type EvaluateEvidenceConfidenceInput = {
	market: MarketTrendResult;
	contentMapping: ContentMappingConfidence;
	ccsHistory: TrendResult | null;
};

/**
 * Evaluate how complete/corroborated the currently assembled evidence is
 * for one market keyword. Pure and deterministic — the same inputs
 * always produce a deeply identical result.
 *
 * -- Gates (no numeric scoring, no counting failed factors) -----------
 *
 * LOW if:
 *   - marketChannelsUsable === 0 (neither strict nor broad usable), OR
 *   - latestMarketFetchStatus !== "observed" ("no_data" or "none" — the
 *     freshest available read from the provider is itself an
 *     availability failure).
 *
 * HIGH only if ALL of:
 *   - marketChannelsUsable === 2
 *   - marketAgreement === "agree"
 *   - latestMarketFetchStatus === "observed"
 *   - recentMarketNoDataCount === 0
 *   - contentMappingAmbiguous === false
 *   - ccsFirstPartyHistory.present === true
 *   - ccsFirstPartyHistory.historyDepth === "established"
 *
 * MEDIUM otherwise — the "workable but not fully corroborated" bucket:
 * exactly one usable market channel, mixed/conflicting directions,
 * recent (but not latest) fetch instability, ambiguous content mapping,
 * or first-party history that is missing or not yet established. None
 * of these alone (nor in any combination short of the full HIGH gate)
 * forces LOW — only the two LOW conditions above do.
 */
export function evaluateEvidenceConfidence(input: EvaluateEvidenceConfidenceInput): EvidenceConfidenceEvidence {
	const { market, contentMapping, ccsHistory } = input;

	const strictUsable = isUsable(market.strict.direction);
	const broadUsable = isUsable(market.broad.direction);
	const marketChannelsUsable: 0 | 1 | 2 = strictUsable && broadUsable ? 2 : strictUsable || broadUsable ? 1 : 0;

	const marketAgreement: MarketDirectionAgreement =
		marketChannelsUsable === 2
			? agreementBetweenUsableDirections(market.strict.direction, market.broad.direction)
			: "unknown";

	const latestMarketFetchStatus = market.latestFetchStatus;
	const recentMarketNoDataCount = market.recentNoDataCount;
	const contentMappingAmbiguous = contentMapping === "ambiguous";

	const ccsFirstPartyHistory: EvidenceConfidenceFactors["ccsFirstPartyHistory"] =
		ccsHistory === null ? { present: false } : { present: true, historyDepth: ccsHistory.historyDepth };

	const factors: EvidenceConfidenceFactors = {
		marketChannelsUsable,
		marketAgreement,
		latestMarketFetchStatus,
		recentMarketNoDataCount,
		contentMappingAmbiguous,
		ccsFirstPartyHistory,
	};

	return {
		level: computeLevel(factors),
		factors,
		limitingReasons: computeLimitingReasons(factors),
	};
}

function computeLevel(factors: EvidenceConfidenceFactors): EvidenceConfidenceLevel {
	const isLow = factors.marketChannelsUsable === 0 || factors.latestMarketFetchStatus !== "observed";
	if (isLow) {
		return "low";
	}

	const isHigh =
		factors.marketChannelsUsable === 2 &&
		factors.marketAgreement === "agree" &&
		factors.latestMarketFetchStatus === "observed" &&
		factors.recentMarketNoDataCount === 0 &&
		factors.contentMappingAmbiguous === false &&
		factors.ccsFirstPartyHistory.present === true &&
		factors.ccsFirstPartyHistory.historyDepth === "established";

	return isHigh ? "high" : "medium";
}

/**
 * Deterministic, fixed-order reason list — always in this declared
 * order regardless of object/iteration order, and always every ACTIVE
 * limitation, not only the one that determined the final `level` (e.g.
 * a "low" result from a "no_data" fetch may still list
 * "first_party_history_missing" alongside it — both are true
 * limitations of the evidence set, even though only the fetch status
 * decided the severity).
 */
function computeLimitingReasons(factors: EvidenceConfidenceFactors): EvidenceConfidenceLimitingReason[] {
	const reasons: EvidenceConfidenceLimitingReason[] = [];

	if (factors.marketChannelsUsable === 0) {
		reasons.push("market_evidence_unusable");
	}
	if (factors.latestMarketFetchStatus !== "observed") {
		reasons.push("latest_market_fetch_unavailable");
	}
	if (factors.marketChannelsUsable === 1) {
		reasons.push("market_single_channel");
	}
	if (factors.marketAgreement === "conflict") {
		reasons.push("market_signals_conflict");
	}
	if (factors.marketAgreement === "mixed") {
		reasons.push("market_signals_mixed");
	}
	if (factors.recentMarketNoDataCount > 0) {
		reasons.push("recent_market_fetch_instability");
	}
	if (factors.contentMappingAmbiguous) {
		reasons.push("content_mapping_ambiguous");
	}
	if (factors.ccsFirstPartyHistory.present === false) {
		reasons.push("first_party_history_missing");
	} else if (factors.ccsFirstPartyHistory.historyDepth !== "established") {
		reasons.push("first_party_history_thin");
	}

	return reasons;
}
