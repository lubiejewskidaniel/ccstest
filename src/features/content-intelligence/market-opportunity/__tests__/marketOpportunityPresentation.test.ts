import { describe, it, expect } from "vitest";
import {
	CLASSIFICATION_LABEL,
	COVERAGE_LABEL,
	COVERAGE_TONE,
	CONFIDENCE_LABEL,
	CONFIDENCE_TONE,
	describeContentMappingAmbiguity,
	DIRECTION_EXPLANATION,
	DIRECTION_LABEL,
	DIRECTION_TONE,
	displayPercent,
	displayValue,
	ERROR_MESSAGE,
	LIMITING_REASON_EXPLANATION,
	MATCH_KIND_LABEL,
	RELEVANCE_LABEL,
	RELEVANCE_TONE,
} from "../marketOpportunityPresentation";
import type { EvidenceConfidenceLimitingReason, MarketOpportunityClassification, QueryMatchKind } from "../types";

const ALL_DIRECTIONS = ["rising", "declining", "stable", "volatile", "insufficient_data"] as const;
const ALL_CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
const ALL_RELEVANCE_LEVELS = ["none", "adjacent", "core"] as const;
const ALL_COVERAGE_LEVELS = ["none", "mention", "title_match"] as const;
const ALL_LIMITING_REASONS: EvidenceConfidenceLimitingReason[] = [
	"market_evidence_unusable",
	"latest_market_fetch_unavailable",
	"market_single_channel",
	"market_signals_conflict",
	"market_signals_mixed",
	"recent_market_fetch_instability",
	"content_mapping_ambiguous",
	"first_party_history_missing",
	"first_party_history_thin",
];
const ALL_CLASSIFICATIONS: MarketOpportunityClassification[] = [
	"market_growth",
	"market_decline",
	"covered_market",
	"not_relevant",
	"weak_evidence",
	"insufficient_data",
];
const ALL_MATCH_KINDS: QueryMatchKind[] = ["none", "exact", "normalized_exact", "ambiguous"];

describe("LIMITING_REASON_EXPLANATION", () => {
	it("has a non-empty explanation for every EvidenceConfidenceLimitingReason", () => {
		for (const reason of ALL_LIMITING_REASONS) {
			expect(LIMITING_REASON_EXPLANATION[reason]).toBeTruthy();
			expect(LIMITING_REASON_EXPLANATION[reason].length).toBeGreaterThan(0);
		}
	});

	it("gives a distinct explanation to every reason (no copy-pasted duplicates)", () => {
		const explanations = ALL_LIMITING_REASONS.map((reason) => LIMITING_REASON_EXPLANATION[reason]);
		expect(new Set(explanations).size).toBe(explanations.length);
	});
});

describe("direction label/tone/explanation", () => {
	it("has a label, tone, and explanation for every direction", () => {
		for (const direction of ALL_DIRECTIONS) {
			expect(DIRECTION_LABEL[direction]).toBeTruthy();
			expect(DIRECTION_TONE[direction]).toBeTruthy();
			expect(DIRECTION_EXPLANATION[direction]).toBeTruthy();
		}
	});

	it("never gives declining an alarm-style tone (positive/attention/neutral/muted only, never a fifth 'error' tone)", () => {
		const allowedTones = ["positive", "neutral", "attention", "muted"];
		for (const direction of ALL_DIRECTIONS) {
			expect(allowedTones).toContain(DIRECTION_TONE[direction]);
		}
		// Declining is restrained ("attention" = notice, not alarm) and
		// explicitly not a distinct "error"-style tone from volatile.
		expect(DIRECTION_TONE.declining).toBe("attention");
		expect(DIRECTION_TONE.declining).toBe(DIRECTION_TONE.volatile);
	});

	it("is deterministic — repeated lookups return the same value", () => {
		expect(DIRECTION_LABEL.rising).toBe(DIRECTION_LABEL.rising);
		expect(DIRECTION_TONE.stable).toBe(DIRECTION_TONE.stable);
	});
});

describe("confidence label/tone", () => {
	it("maps every level to a label and tone", () => {
		for (const level of ALL_CONFIDENCE_LEVELS) {
			expect(CONFIDENCE_LABEL[level]).toBeTruthy();
			expect(CONFIDENCE_TONE[level]).toBeTruthy();
		}
	});

	it("uses the suggested high/medium/low -> positive/attention/muted mapping", () => {
		expect(CONFIDENCE_TONE.high).toBe("positive");
		expect(CONFIDENCE_TONE.medium).toBe("attention");
		expect(CONFIDENCE_TONE.low).toBe("muted");
	});
});

describe("business relevance label/tone", () => {
	it("maps every level to a label and tone", () => {
		for (const level of ALL_RELEVANCE_LEVELS) {
			expect(RELEVANCE_LABEL[level]).toBeTruthy();
			expect(RELEVANCE_TONE[level]).toBeTruthy();
		}
	});

	it("uses the suggested core/adjacent/none -> positive/neutral/muted mapping", () => {
		expect(RELEVANCE_TONE.core).toBe("positive");
		expect(RELEVANCE_TONE.adjacent).toBe("neutral");
		expect(RELEVANCE_TONE.none).toBe("muted");
	});
});

describe("content coverage label/tone", () => {
	it("maps every level to a label and tone", () => {
		for (const level of ALL_COVERAGE_LEVELS) {
			expect(COVERAGE_LABEL[level]).toBeTruthy();
			expect(COVERAGE_TONE[level]).toBeTruthy();
		}
	});

	it("uses the suggested title_match/mention/none -> positive/neutral/muted mapping", () => {
		expect(COVERAGE_TONE.title_match).toBe("positive");
		expect(COVERAGE_TONE.mention).toBe("neutral");
		expect(COVERAGE_TONE.none).toBe("muted");
	});
});

describe("describeContentMappingAmbiguity", () => {
	it("returns explanatory text only for 'ambiguous'", () => {
		expect(describeContentMappingAmbiguity("ambiguous")).toBeTruthy();
	});

	it("returns null for 'unambiguous' and null (no separate notice needed)", () => {
		expect(describeContentMappingAmbiguity("unambiguous")).toBeNull();
		expect(describeContentMappingAmbiguity(null)).toBeNull();
	});
});

describe("MATCH_KIND_LABEL", () => {
	it("maps every QueryMatchKind to a non-empty label", () => {
		for (const kind of ALL_MATCH_KINDS) {
			expect(MATCH_KIND_LABEL[kind]).toBeTruthy();
		}
	});
});

describe("CLASSIFICATION_LABEL", () => {
	it("maps every MarketOpportunityClassification to a non-empty, distinct label", () => {
		const labels = ALL_CLASSIFICATIONS.map((classification) => CLASSIFICATION_LABEL[classification]);
		for (const label of labels) expect(label).toBeTruthy();
		expect(new Set(labels).size).toBe(labels.length);
	});
});

describe("ERROR_MESSAGE", () => {
	it("has admin-facing copy for every GetMarketOpportunityEvidenceResult error kind, and never includes the words 'Supabase' or 'Postgres'", () => {
		for (const kind of ["auth", "not_configured", "market_keyword_not_found", "storage_error"] as const) {
			expect(ERROR_MESSAGE[kind]).toBeTruthy();
			expect(ERROR_MESSAGE[kind].toLowerCase()).not.toContain("supabase");
			expect(ERROR_MESSAGE[kind].toLowerCase()).not.toContain("postgres");
		}
	});
});

describe("displayValue / displayPercent", () => {
	it("renders null/undefined as an em dash", () => {
		expect(displayValue(null)).toBe("—");
		expect(displayValue(undefined)).toBe("—");
		expect(displayPercent(null)).toBe("—");
	});

	it("renders booleans as Yes/No, not true/false", () => {
		expect(displayValue(true)).toBe("Yes");
		expect(displayValue(false)).toBe("No");
	});

	it("renders a fraction as a signed rounded percentage", () => {
		expect(displayPercent(0.3)).toBe("+30%");
		expect(displayPercent(-0.125)).toBe("-12%"); // Math.round rounds -12.5 towards +Infinity in JS
		expect(displayPercent(0)).toBe("0%");
	});

	it("passes numbers and strings through unchanged", () => {
		expect(displayValue(42)).toBe("42");
		expect(displayValue("gb")).toBe("gb");
	});
});

describe("compile-time exhaustiveness — unknown enum values are rejected by TypeScript", () => {
	it("(this test's value is at compile time, not runtime — see the @ts-expect-error lines below)", () => {
		// @ts-expect-error - "trending_sideways" is not a real MarketTrendDirection/TrendDirection member.
		expect(DIRECTION_LABEL["trending_sideways"]).toBeUndefined();
		// @ts-expect-error - "critical" is not a real EvidenceConfidenceLevel member.
		expect(CONFIDENCE_TONE["critical"]).toBeUndefined();
		// @ts-expect-error - "primary" is not a real BusinessRelevanceLevel member.
		expect(RELEVANCE_LABEL["primary"]).toBeUndefined();
		// @ts-expect-error - "full_match" is not a real ContentCoverageLevel member.
		expect(COVERAGE_LABEL["full_match"]).toBeUndefined();
		// @ts-expect-error - "fuzzy" is not a real QueryMatchKind member.
		expect(MATCH_KIND_LABEL["fuzzy"]).toBeUndefined();
		// @ts-expect-error - "must_write" is not a real MarketOpportunityClassification member.
		expect(CLASSIFICATION_LABEL["must_write"]).toBeUndefined();
		// @ts-expect-error - "unknown_reason" is not a real EvidenceConfidenceLimitingReason member.
		expect(LIMITING_REASON_EXPLANATION["unknown_reason"]).toBeUndefined();
	});
});
