import type {
	MarketOpportunityEvidence,
	RecommendationEvidence,
	RecommendationKind,
	RecommendationReason,
} from "./types";

/**
 * Phase 3C.2 — Recommendation Engine.
 *
 * Converts one subject's already-assembled `MarketOpportunityEvidence`
 * into a small, deterministic, explainable next-step recommendation.
 * This module never adds a new evidence source and never re-derives a
 * threshold owned elsewhere (market direction, evidence confidence,
 * content-coverage level, first-party matching) — it only reads the
 * real, already-computed fields on `MarketOpportunityEvidence` and
 * applies a fixed decision tree. No numeric score exists anywhere here.
 *
 * -- Purity ---------------------------------------------------------
 * No Supabase, no network read, no wall-clock read, no randomness, no
 * LLM call, no mutation of `evidence`. `evaluateRecommendation` is a
 * plain, total, synchronous function: the same `MarketOpportunityEvidence`
 * value always produces a deeply identical `RecommendationEvidence`, and
 * the returned `evidence` field is the exact input object, by reference
 * — never cloned, never partially duplicated. This is why every import
 * above is `import type` only: this module has no runtime dependency on
 * anything outside its own logic.
 *
 * -- Core principle: strength vs. confidence, kept separate ------------
 * Evidence confidence is a SAFETY GATE on how large an action this
 * module is willing to recommend, never an ingredient in deciding
 * whether an opportunity looks good. Gate 1 below enforces this
 * structurally: `create_content`/`refresh_content` are gated to
 * `evidenceConfidence.level === "high"` ONLY — a "core relevance, strong
 * market growth, no coverage, medium confidence" subject can never
 * reach `create_content`; it resolves to `research_further` instead
 * (see the worked example in the Phase 3C.2 architecture report).
 *
 * -- Gate order (fixed, never reordered per-call) -----------------------
 *   Gate 0 — businessRelevance.level === "none" is an absolute,
 *            unconditional override to `no_action`, checked before
 *            anything else is even read.
 *   Gate 1/3 (ambiguity) — checked next, before the create_content/
 *            refresh_content shapes are even evaluated, so ambiguity can
 *            never be "raced" by a stronger-looking evidence shape. Both
 *            `contentCoverage.mapping === "ambiguous"` and
 *            `firstPartyMatch.kind === "ambiguous"` are checked here.
 *            They must never allow `create_content`/`refresh_content`
 *            and must never be silently converted into `no_action` — at
 *            confidence "medium"/"high" they resolve to
 *            `research_further`; at confidence "low" (where
 *            `research_further` is not a reachable kind — see Gate 1
 *            below) they resolve to `monitor`, never `no_action`,
 *            because an ambiguous-but-present record is a concrete fact,
 *            not an absence of one.
 *   Gate 1 (confidence ceiling) — LOW confidence permits only
 *            `monitor`/`no_action`; MEDIUM permits only
 *            `research_further`/`monitor`/`no_action`; HIGH permits all
 *            five. Enforced inline within each branch below.
 *   Gate 2 (evidence rules) — the exact `create_content`/`refresh_content`
 *            shape checks and the residual decision tree, both below.
 *
 * -- Why ambiguity is checked structurally, not just "when it matters" --
 * In practice, real `evaluateEvidenceConfidence` output makes
 * "confidence high" and "mapping/first-party ambiguous" mutually
 * exclusive (the HIGH gate requires `contentMappingAmbiguous === false`
 * and `ccsFirstPartyHistory.present === true`, and an ambiguous
 * first-party match always produces `ccsHistory === null`). This module
 * does not rely on that coupling holding — it re-checks both ambiguity
 * fields directly and independently of confidence, so it stays correct
 * even if a caller hands it a hand-built or future-evolved evidence
 * object where the two are no longer correlated.
 *
 * -- monitor vs. no_action: absence of evidence is never evidence -------
 * `monitor` means "we do not yet have enough evidence to decide";
 * `no_action` means "the available evidence supports deliberately doing
 * nothing" — these are not two shades of the same uncertainty, and
 * absence of evidence must never itself become evidence for `no_action`.
 * At LOW confidence, this module distinguishes a subject with
 * `classifications` including `"insufficient_data"` (neither market
 * channel usable at all — a pure ABSENCE, forcing `monitor` on its own,
 * no additional fact required) or at least one concrete POSITIVE fact
 * (market growth, a partial mention, or a matched first-party record),
 * either of which resolves to `monitor` — from a subject with literally
 * nothing to point to and nothing missing either (no coverage, no
 * matched first-party record, no market growth, and market data that IS
 * usable but simply shows nothing happening), which is the genuine
 * `no_action` case. A pure, corroborated market decline with nothing
 * else present is likewise treated as a clear (not uncertain) negative
 * conclusion, not a "positive fact" — see the residual tree below.
 */

/** Fixed declared order for BOTH `supportingReasons` and
 * `blockingReasons` — a single shared order table, never object/Set/Map
 * iteration order. `canonicalize()` below filters this list down to
 * whichever reasons are actually present, which is also how
 * deduplication happens (a reason pushed twice collapses to one). */
const REASON_ORDER: RecommendationReason[] = [
	"business_none",
	"business_core",
	"business_adjacent",
	"market_growth",
	"market_decline",
	"market_signal_unclear",
	"content_missing",
	"content_partial_mention",
	"content_covered_unambiguous",
	"content_mapping_ambiguous",
	"existing_content_declining",
	"first_party_ambiguous_match",
	"first_party_no_match",
	"confidence_medium",
	"confidence_low",
];

function canonicalize(reasons: RecommendationReason[]): RecommendationReason[] {
	const present = new Set(reasons);
	return REASON_ORDER.filter((reason) => present.has(reason));
}

function finalize(
	recommendation: RecommendationKind,
	confidence: MarketOpportunityEvidence["evidenceConfidence"]["level"],
	supportingReasons: RecommendationReason[],
	blockingReasons: RecommendationReason[],
	evidence: MarketOpportunityEvidence,
): RecommendationEvidence {
	return {
		recommendation,
		confidence,
		supportingReasons: canonicalize(supportingReasons),
		blockingReasons: canonicalize(blockingReasons),
		evidence,
	};
}

/**
 * Evaluate one subject's recommendation from its already-assembled
 * evidence. Pure and total — see the module doc comment above for the
 * exact gate order this function implements.
 */
export function evaluateRecommendation(evidence: MarketOpportunityEvidence): RecommendationEvidence {
	const relevance = evidence.businessRelevance.level;
	const confidence = evidence.evidenceConfidence.level;
	const coverage = evidence.contentCoverage;
	const marketGrowth = evidence.classifications.includes("market_growth");
	const marketDecline = evidence.classifications.includes("market_decline");
	const mappingAmbiguous = coverage.mapping === "ambiguous";
	const firstPartyAmbiguous = evidence.firstPartyMatch.kind === "ambiguous";
	const relevanceReason: RecommendationReason = relevance === "core" ? "business_core" : "business_adjacent";

	// ---- Gate 0 -----------------------------------------------------
	if (relevance === "none") {
		return finalize("no_action", confidence, ["business_none"], [], evidence);
	}

	// ---- Gate 1/3: ambiguity, checked before any strong-action shape --
	// Deliberately evaluated before create_content/refresh_content below
	// so ambiguity can never be outrun by an otherwise-qualifying shape —
	// see the module doc comment.
	if (mappingAmbiguous || firstPartyAmbiguous) {
		const supporting: RecommendationReason[] = [relevanceReason];
		const blocking: RecommendationReason[] = [];
		if (mappingAmbiguous) blocking.push("content_mapping_ambiguous");
		if (firstPartyAmbiguous) blocking.push("first_party_ambiguous_match");

		if (confidence === "low") {
			// Gate 1: research_further is not reachable at low confidence.
			// An ambiguous-but-present record is a concrete fact, not an
			// absence of one — monitor, never no_action.
			blocking.push("confidence_low");
			return finalize("monitor", confidence, supporting, blocking, evidence);
		}

		if (confidence === "medium") blocking.push("confidence_medium");
		return finalize("research_further", confidence, supporting, blocking, evidence);
	}

	// From this point on, neither contentCoverage.mapping nor
	// firstPartyMatch.kind is "ambiguous".

	// ---- create_content shape (relevance/coverage/market only; the
	// confidence gate is applied explicitly below, not folded into this
	// predicate, so the "otherwise would have qualified" fact is still
	// available for research_further/monitor's supporting reasons). ----
	const createShape =
		relevance === "core" && (coverage.level === "none" || coverage.level === "mention") && marketGrowth && !marketDecline;

	if (createShape) {
		const supporting: RecommendationReason[] = [
			"business_core",
			"market_growth",
			coverage.level === "mention" ? "content_partial_mention" : "content_missing",
		];

		if (confidence === "high") {
			return finalize("create_content", confidence, supporting, [], evidence);
		}
		if (confidence === "medium") {
			// Gate 1: create_content is not reachable below high confidence.
			return finalize("research_further", confidence, supporting, ["confidence_medium"], evidence);
		}
		// confidence === "low": research_further is not reachable either;
		// market_growth is a concrete positive fact -> monitor.
		return finalize("monitor", confidence, supporting, ["confidence_low"], evidence);
	}

	// ---- refresh_content shape ----------------------------------------
	const refreshShape =
		relevance === "core" &&
		coverage.level === "title_match" &&
		coverage.mapping === "unambiguous" &&
		evidence.ccsVisibility.status === "matched" &&
		evidence.ccsTrend.status === "matched" &&
		evidence.ccsTrend.trend.direction === "declining";

	if (refreshShape) {
		const supporting: RecommendationReason[] = ["business_core", "existing_content_declining"];

		if (confidence === "low") {
			// Gate 1: research_further is not reachable at low confidence;
			// a matched, declining record is a concrete positive fact.
			return finalize("monitor", confidence, supporting, ["confidence_low"], evidence);
		}
		if (marketDecline) {
			// A declining market alongside declining first-party
			// performance could be demand loss rather than a ranking
			// problem — never silently assumed either way.
			return finalize("research_further", confidence, supporting, ["market_decline"], evidence);
		}
		if (confidence === "medium") {
			// Gate 1: refresh_content is not reachable below high confidence.
			return finalize("research_further", confidence, supporting, ["confidence_medium"], evidence);
		}
		return finalize("refresh_content", confidence, supporting, [], evidence);
	}

	// ---- Residual tree: neither shape matched. No ambiguity remains,
	// relevance is "core" or "adjacent". ---------------------------------
	const supporting: RecommendationReason[] = [relevanceReason];
	const blocking: RecommendationReason[] = [];
	let kind: RecommendationKind;

	if (coverage.level === "title_match") {
		// Dedicated, unambiguous coverage exists (mapping is guaranteed
		// "unambiguous" here — ambiguous mapping was already handled
		// above). refreshShape's own conditions did not all hold, so
		// either there is no first-party record to corroborate it, or
		// there is one but it is not declining, or (for "core" relevance
		// specifically) the market itself is declining, which refreshShape
		// already returns from above and never reaches here.
		supporting.push("content_covered_unambiguous");

		if (evidence.ccsVisibility.status === "matched" && evidence.ccsTrend.status === "matched") {
			const direction = evidence.ccsTrend.trend.direction;
			if (direction === "declining") {
				// Only reachable here for relevance === "adjacent" — a
				// "core" subject with matched, declining first-party trend
				// and unambiguous title_match coverage would already have
				// satisfied refreshShape above. refresh_content is never
				// reachable for adjacent relevance (Phase 3C.2 decision 2);
				// research_further is its ceiling.
				supporting.push("existing_content_declining");
				kind = "research_further";
			} else if (direction === "insufficient_data") {
				// A first-party record exists but there is not yet enough
				// history to say anything about its direction — missing
				// history, not a conflict requiring interpretation.
				kind = "monitor";
			} else {
				// rising / stable / volatile: the existing dedicated
				// content is healthy enough that no action is needed, but
				// only when confidence is high enough to trust that read.
				// Dedicated coverage is itself a concrete fact, so this
				// never falls back to no_action at lower confidence.
				kind = confidence === "high" ? "no_action" : "monitor";
			}
		} else {
			// No first-party visibility/trend record at all
			// (ccsVisibility.status === "no_match" — never interpreted as
			// zero visibility, just as "nothing tracked yet"). Dedicated
			// text coverage exists with no performance signal to
			// corroborate it — worth revisiting, not yet actionable, and
			// never no_action (coverage existing is itself a concrete
			// fact).
			kind = "monitor";
		}

		if (kind === "research_further" && confidence === "low") {
			// Gate 1: research_further is not reachable at low confidence.
			kind = "monitor";
			blocking.push("confidence_low");
		}
	} else {
		// coverage.level is "none" or "mention" (mention is explicitly
		// NOT dedicated coverage — Phase 3C.2 decision 3 — so it is
		// grouped with "none" here; content_partial_mention is emitted
		// purely for explainability and never changes `kind`).
		supporting.push(coverage.level === "mention" ? "content_partial_mention" : "content_missing");

		const marketState: "growth" | "decline" | "conflict" | "stable" =
			marketGrowth && !marketDecline
				? "growth"
				: marketDecline && !marketGrowth
					? "decline"
					: marketGrowth && marketDecline
						? "conflict"
						: "stable";

		if (confidence === "low") {
			// Gate 1: research_further is not reachable at low confidence.
			//
			// monitor means "we do not yet have enough evidence to
			// decide"; no_action means "the available evidence supports
			// deliberately doing nothing" — absence of evidence must never
			// itself become evidence for no_action. classifications
			// includes "insufficient_data" whenever neither market channel
			// is usable at all (marketChannelsUsable === 0, which is also
			// the one thing that unconditionally forces confidence "low"
			// here) — that is a pure absence, not a negative finding, so it
			// forces monitor on its own, with no additional positive fact
			// required. A concrete POSITIVE fact (market growth, a partial
			// mention, or a matched first-party record even outside
			// dedicated coverage) also warrants monitor. Only when neither
			// insufficient_data nor any positive fact applies — genuinely
			// nothing present and nothing missing either — is there truly
			// nothing to point to, which is the deliberate no_action case.
			const insufficientData = evidence.classifications.includes("insufficient_data");
			const hasConcretePositiveFact =
				marketGrowth || coverage.level === "mention" || evidence.ccsVisibility.status === "matched";
			blocking.push("confidence_low");
			kind = insufficientData || hasConcretePositiveFact ? "monitor" : "no_action";
		} else if (relevance === "adjacent" && marketState === "growth") {
			// createShape already excludes this combination for "core"
			// relevance. adjacent relevance can never reach create_content
			// regardless of market strength (Phase 3C.2 decision 2) — its
			// ceiling here is research_further.
			supporting.push("market_growth");
			kind = "research_further";
		} else if (marketState === "decline") {
			// A declining market with nothing existing to protect is a
			// deliberate no_action, not a way to hide uncertainty — the
			// market signal itself is clear, just clearly negative.
			blocking.push("market_decline");
			kind = "no_action";
		} else if (marketState === "conflict") {
			// Strict/broad market directions disagree outright (both
			// market_growth and market_decline classifications present) —
			// genuinely conflicting evidence requiring human judgement.
			blocking.push("market_signal_unclear");
			kind = "research_further";
		} else {
			// "stable": neither market_growth nor market_decline applies —
			// a corroborated, non-ambiguous market with no actionable
			// growth signal yet. Locked as monitor, never research_further
			// (Phase 3C.2 decision 4): there is nothing ambiguous or
			// conflicting here to hand to a human, only an absence of
			// signal to keep watching.
			kind = "monitor";
		}
	}

	return finalize(kind, confidence, supporting, blocking, evidence);
}
