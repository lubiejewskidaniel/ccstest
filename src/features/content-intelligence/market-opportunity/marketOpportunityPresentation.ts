import type { MarketTrendDirection } from "../market/trend";
import type { TrendDirection } from "../opportunities/trend";
import type {
	BusinessRelevanceLevel,
	ContentCoverageLevel,
	ContentMappingConfidence,
	EvidenceConfidenceLevel,
	EvidenceConfidenceLimitingReason,
	MarketOpportunityClassification,
	QueryMatchKind,
} from "./types";

/**
 * Phase 3C.1F — presentation-only mappings for the read-only admin
 * inspection UI (`MarketOpportunityInspector.tsx`). Pure: no JSX, no
 * Supabase, no I/O, no AI-generated text — every label/explanation below
 * is a short, hand-written, deterministic string. This module never
 * re-interprets evidence (no thresholds, no scoring) — it only translates
 * machine-readable states this codebase already computes into plain
 * admin-facing English (British spelling in code-facing comments/labels,
 * per house style).
 *
 * Every mapping below is a `Record<RealUnionType, ...>` keyed on the
 * actual exported union from its owning module (never a locally
 * redeclared copy of that union) — TypeScript then refuses to compile
 * this file the moment one of those real unions gains a member without a
 * matching entry here, and refuses to compile a call site that passes an
 * unrecognised string. That is the "unknown enum values are not silently
 * accepted" guarantee this module relies on instead of a runtime
 * fallback/default branch.
 *
 * `MarketTrendDirection` (market/trend.ts) and `TrendDirection`
 * (opportunities/trend.ts) are two independently declared but
 * structurally identical unions — "rising" | "declining" | "stable" |
 * "volatile" | "insufficient_data" — describing the same underlying
 * concept for two different evidence channels (external market demand
 * vs. CCS's own first-party trend). `DIRECTION_LABEL`/`DIRECTION_TONE`
 * are keyed on `MarketTrendDirection` and reused for `TrendDirection`
 * values too: TypeScript only allows that because the two unions'
 * members currently match exactly, so if either one is ever widened
 * without the other, every call site passing the new member in will fail
 * to compile — this is a real, load-bearing type check, not decoration.
 */

/** Restrained semantic tones only — never "success"/"error". Evidence is
 * described, not graded. */
export type EvidenceTone = "positive" | "neutral" | "attention" | "muted";

// ---------------------------------------------------------------------------
// Direction (shared by market demand and CCS trend — see module doc comment)
// ---------------------------------------------------------------------------

export const DIRECTION_LABEL: Record<MarketTrendDirection, string> = {
	rising: "Rising",
	declining: "Declining",
	stable: "Stable",
	volatile: "Volatile",
	insufficient_data: "Not enough history yet",
};

export const DIRECTION_EXPLANATION: Record<MarketTrendDirection, string> = {
	rising: "Trending upward over the recent window.",
	declining: "Trending downward over the recent window — evidence, not necessarily a problem.",
	stable: "Holding steady over the recent window.",
	volatile: "Fluctuating without a clear direction.",
	insufficient_data: "Not enough usable history yet to determine a trend.",
};

/** Declining is deliberately NOT "attention"-as-alarm here — see the
 * module doc comment and EvidenceBadge's own doc comment: "attention"
 * means "notice this", never "this is wrong". */
export const DIRECTION_TONE: Record<MarketTrendDirection, EvidenceTone> = {
	rising: "positive",
	declining: "attention",
	stable: "neutral",
	volatile: "attention",
	insufficient_data: "muted",
};

/** Structural-compatibility guard: fails to compile if `TrendDirection`
 * (opportunities/trend.ts) ever diverges from `MarketTrendDirection`
 * (market/trend.ts) — see module doc comment. Not called at runtime. */
function _assertTrendDirectionCompatible(direction: TrendDirection): keyof typeof DIRECTION_LABEL {
	return direction;
}
void _assertTrendDirectionCompatible;

// ---------------------------------------------------------------------------
// Evidence confidence
// ---------------------------------------------------------------------------

export const CONFIDENCE_LABEL: Record<EvidenceConfidenceLevel, string> = {
	low: "Low",
	medium: "Medium",
	high: "High",
};

export const CONFIDENCE_TONE: Record<EvidenceConfidenceLevel, EvidenceTone> = {
	low: "muted",
	medium: "attention",
	high: "positive",
};

/** Short, deterministic, hand-written explanation for every
 * `EvidenceConfidenceLimitingReason` — never the raw enum string alone. */
export const LIMITING_REASON_EXPLANATION: Record<EvidenceConfidenceLimitingReason, string> = {
	market_evidence_unusable: "No usable market-demand signal exists for this keyword yet.",
	latest_market_fetch_unavailable: "The most recent market data fetch didn't return usable results.",
	market_single_channel: "Only one market-demand signal (strict or broad) currently has usable trend evidence.",
	market_signals_conflict: "The strict and broad market-demand signals are moving in opposite directions.",
	market_signals_mixed: "The strict and broad market-demand signals don't clearly agree.",
	recent_market_fetch_instability: "Recent market data fetches have repeatedly come back empty.",
	content_mapping_ambiguous: "More than one published article could be considered the coverage for this keyword.",
	first_party_history_missing: "CCS doesn't have a tracked first-party query for this keyword yet.",
	first_party_history_thin: "CCS has a tracked first-party query, but not enough history yet to trust its trend.",
};

// ---------------------------------------------------------------------------
// Business relevance
// ---------------------------------------------------------------------------

export const RELEVANCE_LABEL: Record<BusinessRelevanceLevel, string> = {
	none: "Not relevant",
	adjacent: "Adjacent",
	core: "Core",
};

export const RELEVANCE_TONE: Record<BusinessRelevanceLevel, EvidenceTone> = {
	none: "muted",
	adjacent: "neutral",
	core: "positive",
};

// ---------------------------------------------------------------------------
// Content coverage
// ---------------------------------------------------------------------------

export const COVERAGE_LABEL: Record<ContentCoverageLevel, string> = {
	none: "No coverage",
	mention: "Mentioned",
	title_match: "Title match",
};

export const COVERAGE_TONE: Record<ContentCoverageLevel, EvidenceTone> = {
	none: "muted",
	mention: "neutral",
	title_match: "positive",
};

/**
 * `ContentMappingConfidence` includes `null` (no mapping question exists
 * when `level === "none"`), which can't be a `Record` key — a small
 * function instead. Returns explanatory text only for the one state the
 * admin UI must never hide behind a plain "matched" label
 * (`"ambiguous"`); `null` for both `"unambiguous"` and `null` itself,
 * meaning "no separate ambiguity notice is needed here".
 */
export function describeContentMappingAmbiguity(mapping: ContentMappingConfidence): string | null {
	if (mapping === "ambiguous") {
		return "Multiple articles match — coverage can't be pinned to one article.";
	}
	return null;
}

// ---------------------------------------------------------------------------
// First-party query match kind
// ---------------------------------------------------------------------------

export const MATCH_KIND_LABEL: Record<QueryMatchKind, string> = {
	none: "No match",
	exact: "Exact match",
	normalized_exact: "Matched (normalised)",
	ambiguous: "Ambiguous match",
};

// ---------------------------------------------------------------------------
// Classifications — plain descriptive labels, never a priority/tone
// ---------------------------------------------------------------------------

export const CLASSIFICATION_LABEL: Record<MarketOpportunityClassification, string> = {
	market_growth: "Market growth",
	market_decline: "Market decline",
	covered_market: "Covered market",
	not_relevant: "Not relevant",
	weak_evidence: "Weak evidence",
	insufficient_data: "Insufficient data",
};

export const CLASSIFICATION_EXPLANATION: Record<MarketOpportunityClassification, string> = {
	market_growth: "External market demand for this keyword is rising.",
	market_decline: "External market demand for this keyword is declining.",
	covered_market: "CCS already has an article whose title matches this keyword.",
	not_relevant: "This keyword doesn't match any CCS business pillar.",
	weak_evidence: "Overall evidence confidence for this keyword is low.",
	insufficient_data: "No usable market-demand channel exists for this keyword yet.",
};

// ---------------------------------------------------------------------------
// Error states (see queries.ts's GetMarketOpportunityEvidenceResult)
// ---------------------------------------------------------------------------

/** Admin-facing copy only — never the raw Supabase/Postgres message that
 * accompanies a `storage_error` result. */
export const ERROR_MESSAGE = {
	auth: "You need editor or admin access to view this.",
	not_configured: "Market intelligence data isn't available in this environment.",
	market_keyword_not_found: "This keyword isn't being tracked for the selected provider and market yet.",
	storage_error: "Something went wrong loading this evidence. Try again shortly.",
} as const;

// ---------------------------------------------------------------------------
// Small formatting helpers
// ---------------------------------------------------------------------------

/** `null`-safe display for an optional numeric/period value — used
 * throughout the inspector instead of ad hoc `?? "-"` scattered across
 * JSX. */
export function displayValue(value: string | number | boolean | null | undefined): string {
	if (value === null || value === undefined) return "—";
	if (typeof value === "boolean") return value ? "Yes" : "No";
	return String(value);
}

/** Renders a fraction (e.g. `0.3`) as a signed percentage string (e.g.
 * `"+30%"`), matching `relativeChange`/`relativeDelta`'s own documented
 * "fraction, e.g. 0.3 = +30%" contract. `null` passes through as `"—"`. */
export function displayPercent(fraction: number | null): string {
	if (fraction === null) return "—";
	const percent = Math.round(fraction * 100);
	return percent > 0 ? `+${percent}%` : `${percent}%`;
}
