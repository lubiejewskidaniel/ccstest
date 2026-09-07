import { describe, it, expect } from "vitest";
import { evaluateEvidenceConfidence } from "../evidenceConfidence";
import type { ContentMappingConfidence, EvidenceConfidenceFactors } from "../types";
import type { MarketMetricTrendEvidence, MarketTrendDirection, MarketTrendResult } from "../../market/trend";
import type { TrendResult } from "../../opportunities/trend";

// ------------------------------------------------------------------
// Test helpers
// ------------------------------------------------------------------

function marketMetric(
	direction: MarketTrendDirection,
	overrides: Partial<MarketMetricTrendEvidence> = {},
): MarketMetricTrendEvidence {
	const isInsufficient = direction === "insufficient_data";
	return {
		direction,
		historyDepth: isInsufficient ? "limited" : "established",
		periodsUsed: isInsufficient ? 5 : 8,
		firstPeriod: "2026-01-05",
		latestPeriod: "2026-06-22",
		recentMean: isInsufficient ? null : 120,
		priorMean: isInsufficient ? null : 90,
		relativeChange: isInsufficient ? null : 0.33,
		cadenceTrusted: true,
		observedGapCount: 0,
		duplicatePeriodCount: 0,
		...overrides,
	};
}

function marketResult(overrides: Partial<MarketTrendResult> = {}): MarketTrendResult {
	return {
		latestFetchStatus: "observed",
		recentNoDataCount: 0,
		strict: marketMetric("rising"),
		broad: marketMetric("rising"),
		...overrides,
	};
}

function trendResult(overrides: Partial<TrendResult> = {}): TrendResult {
	return {
		isNew: false,
		direction: "rising",
		historyDepth: "established",
		snapshotsUsed: 5,
		insufficientDataReason: null,
		latestComputedAt: "2026-06-22T00:00:00.000Z",
		baselineWindow: {
			snapshotCount: 4,
			earliestComputedAt: "2026-01-05T00:00:00.000Z",
			latestComputedAt: "2026-05-25T00:00:00.000Z",
		},
		metrics: {
			opportunityScore: { direction: "rising", current: 80, baseline: 60, absoluteDelta: 20, relativeDelta: 0.33 },
			impressions: { direction: "rising", current: 1000, baseline: 800, absoluteDelta: 200, relativeDelta: 0.25 },
			clicks: { direction: "rising", current: 100, baseline: 80, absoluteDelta: 20, relativeDelta: 0.25 },
			ctr: { direction: "stable", current: 0.1, baseline: 0.1, absoluteDelta: 0, relativeDelta: 0 },
			avgPosition: { direction: "stable", current: 5, baseline: 5, absoluteDelta: 0, relativeDelta: 0 },
		},
		...overrides,
	};
}

const PERFECT_MARKET: MarketTrendResult = marketResult();
const UNAMBIGUOUS: ContentMappingConfidence = "unambiguous";
const ESTABLISHED_HISTORY: TrendResult = trendResult({ historyDepth: "established" });

// ------------------------------------------------------------------
// 1-4. LOW / HIGH baseline gates
// ------------------------------------------------------------------

describe("evaluateEvidenceConfidence — LOW gate", () => {
	it("both market channels unusable -> low", () => {
		const result = evaluateEvidenceConfidence({
			market: marketResult({ strict: marketMetric("insufficient_data"), broad: marketMetric("insufficient_data") }),
			contentMapping: UNAMBIGUOUS,
			ccsHistory: ESTABLISHED_HISTORY,
		});
		expect(result.level).toBe("low");
		expect(result.factors.marketChannelsUsable).toBe(0);
		expect(result.limitingReasons).toEqual(["market_evidence_unusable"]);
	});

	it("latest fetch status no_data -> low", () => {
		const result = evaluateEvidenceConfidence({
			market: marketResult({ latestFetchStatus: "no_data" }),
			contentMapping: UNAMBIGUOUS,
			ccsHistory: ESTABLISHED_HISTORY,
		});
		expect(result.level).toBe("low");
		expect(result.limitingReasons).toEqual(["latest_market_fetch_unavailable"]);
	});

	it("latest fetch status none -> low", () => {
		const result = evaluateEvidenceConfidence({
			market: marketResult({ latestFetchStatus: "none" }),
			contentMapping: UNAMBIGUOUS,
			ccsHistory: ESTABLISHED_HISTORY,
		});
		expect(result.level).toBe("low");
		expect(result.limitingReasons).toEqual(["latest_market_fetch_unavailable"]);
	});
});

describe("evaluateEvidenceConfidence — HIGH gate", () => {
	it("all HIGH conditions satisfied -> high with no limiting reasons", () => {
		const result = evaluateEvidenceConfidence({
			market: PERFECT_MARKET,
			contentMapping: UNAMBIGUOUS,
			ccsHistory: ESTABLISHED_HISTORY,
		});
		expect(result.level).toBe("high");
		expect(result.limitingReasons).toEqual([]);
		expect(result.factors).toEqual<EvidenceConfidenceFactors>({
			marketChannelsUsable: 2,
			marketAgreement: "agree",
			latestMarketFetchStatus: "observed",
			recentMarketNoDataCount: 0,
			contentMappingAmbiguous: false,
			ccsFirstPartyHistory: { present: true, historyDepth: "established" },
		});
	});
});

// ------------------------------------------------------------------
// 5-10 (+ symmetry). Market direction agreement
// ------------------------------------------------------------------

describe("evaluateEvidenceConfidence — market direction agreement", () => {
	it("rising/rising -> agree", () => {
		const result = evaluateEvidenceConfidence({
			market: marketResult({ strict: marketMetric("rising"), broad: marketMetric("rising") }),
			contentMapping: UNAMBIGUOUS,
			ccsHistory: ESTABLISHED_HISTORY,
		});
		expect(result.factors.marketAgreement).toBe("agree");
	});

	it("rising/declining -> conflict", () => {
		const result = evaluateEvidenceConfidence({
			market: marketResult({ strict: marketMetric("rising"), broad: marketMetric("declining") }),
			contentMapping: UNAMBIGUOUS,
			ccsHistory: ESTABLISHED_HISTORY,
		});
		expect(result.factors.marketAgreement).toBe("conflict");
	});

	it("declining/rising -> conflict (symmetric)", () => {
		const result = evaluateEvidenceConfidence({
			market: marketResult({ strict: marketMetric("declining"), broad: marketMetric("rising") }),
			contentMapping: UNAMBIGUOUS,
			ccsHistory: ESTABLISHED_HISTORY,
		});
		expect(result.factors.marketAgreement).toBe("conflict");
	});

	it("rising/stable -> mixed", () => {
		const result = evaluateEvidenceConfidence({
			market: marketResult({ strict: marketMetric("rising"), broad: marketMetric("stable") }),
			contentMapping: UNAMBIGUOUS,
			ccsHistory: ESTABLISHED_HISTORY,
		});
		expect(result.factors.marketAgreement).toBe("mixed");
	});

	it("stable/volatile -> mixed", () => {
		const result = evaluateEvidenceConfidence({
			market: marketResult({ strict: marketMetric("stable"), broad: marketMetric("volatile") }),
			contentMapping: UNAMBIGUOUS,
			ccsHistory: ESTABLISHED_HISTORY,
		});
		expect(result.factors.marketAgreement).toBe("mixed");
	});

	it("volatile/volatile -> agree (identical labels, even though unstable)", () => {
		const result = evaluateEvidenceConfidence({
			market: marketResult({ strict: marketMetric("volatile"), broad: marketMetric("volatile") }),
			contentMapping: UNAMBIGUOUS,
			ccsHistory: ESTABLISHED_HISTORY,
		});
		expect(result.factors.marketAgreement).toBe("agree");
	});

	it("strict usable + broad insufficient_data -> one usable channel, agreement unknown", () => {
		const result = evaluateEvidenceConfidence({
			market: marketResult({ strict: marketMetric("rising"), broad: marketMetric("insufficient_data") }),
			contentMapping: UNAMBIGUOUS,
			ccsHistory: ESTABLISHED_HISTORY,
		});
		expect(result.factors.marketChannelsUsable).toBe(1);
		expect(result.factors.marketAgreement).toBe("unknown");
		expect(result.limitingReasons).toContain("market_single_channel");
	});

	it("broad usable + strict insufficient_data -> one usable channel, agreement unknown", () => {
		const result = evaluateEvidenceConfidence({
			market: marketResult({ strict: marketMetric("insufficient_data"), broad: marketMetric("rising") }),
			contentMapping: UNAMBIGUOUS,
			ccsHistory: ESTABLISHED_HISTORY,
		});
		expect(result.factors.marketChannelsUsable).toBe(1);
		expect(result.factors.marketAgreement).toBe("unknown");
		expect(result.limitingReasons).toContain("market_single_channel");
	});
});

// ------------------------------------------------------------------
// 13-14. Fetch freshness
// ------------------------------------------------------------------

describe("evaluateEvidenceConfidence — fetch freshness", () => {
	it("latest observed but recentMarketNoDataCount > 0 -> medium, not low", () => {
		const result = evaluateEvidenceConfidence({
			market: marketResult({ recentNoDataCount: 2 }),
			contentMapping: UNAMBIGUOUS,
			ccsHistory: ESTABLISHED_HISTORY,
		});
		expect(result.level).toBe("medium");
		expect(result.limitingReasons).toEqual(["recent_market_fetch_instability"]);
	});

	it("recentMarketNoDataCount back to 0 with everything else satisfied -> high (automatic recovery)", () => {
		const result = evaluateEvidenceConfidence({
			market: marketResult({ recentNoDataCount: 0 }),
			contentMapping: UNAMBIGUOUS,
			ccsHistory: ESTABLISHED_HISTORY,
		});
		expect(result.level).toBe("high");
	});
});

// ------------------------------------------------------------------
// 15-17. Content mapping
// ------------------------------------------------------------------

describe("evaluateEvidenceConfidence — content mapping", () => {
	it("ambiguous mapping prevents high, produces medium", () => {
		const result = evaluateEvidenceConfidence({
			market: PERFECT_MARKET,
			contentMapping: "ambiguous",
			ccsHistory: ESTABLISHED_HISTORY,
		});
		expect(result.level).toBe("medium");
		expect(result.factors.contentMappingAmbiguous).toBe(true);
		expect(result.limitingReasons).toEqual(["content_mapping_ambiguous"]);
	});

	it("null mapping (coverage level none) is neutral -> does not prevent high", () => {
		const result = evaluateEvidenceConfidence({
			market: PERFECT_MARKET,
			contentMapping: null,
			ccsHistory: ESTABLISHED_HISTORY,
		});
		expect(result.level).toBe("high");
		expect(result.factors.contentMappingAmbiguous).toBe(false);
		expect(result.limitingReasons).not.toContain("content_mapping_ambiguous");
	});

	it("unambiguous mapping is neutral -> does not prevent high", () => {
		const result = evaluateEvidenceConfidence({
			market: PERFECT_MARKET,
			contentMapping: "unambiguous",
			ccsHistory: ESTABLISHED_HISTORY,
		});
		expect(result.level).toBe("high");
		expect(result.factors.contentMappingAmbiguous).toBe(false);
	});
});

// ------------------------------------------------------------------
// 18-24. First-party history
// ------------------------------------------------------------------

describe("evaluateEvidenceConfidence — first-party history", () => {
	it("ccsHistory null -> medium + first_party_history_missing", () => {
		const result = evaluateEvidenceConfidence({
			market: PERFECT_MARKET,
			contentMapping: UNAMBIGUOUS,
			ccsHistory: null,
		});
		expect(result.level).toBe("medium");
		expect(result.factors.ccsFirstPartyHistory).toEqual({ present: false });
		expect(result.limitingReasons).toEqual(["first_party_history_missing"]);
	});

	it("present historyDepth 'none' -> medium + first_party_history_thin", () => {
		const result = evaluateEvidenceConfidence({
			market: PERFECT_MARKET,
			contentMapping: UNAMBIGUOUS,
			ccsHistory: trendResult({ historyDepth: "none" }),
		});
		expect(result.level).toBe("medium");
		expect(result.limitingReasons).toEqual(["first_party_history_thin"]);
	});

	it("present historyDepth 'single_snapshot' -> medium + first_party_history_thin", () => {
		const result = evaluateEvidenceConfidence({
			market: PERFECT_MARKET,
			contentMapping: UNAMBIGUOUS,
			ccsHistory: trendResult({ historyDepth: "single_snapshot" }),
		});
		expect(result.level).toBe("medium");
		expect(result.limitingReasons).toEqual(["first_party_history_thin"]);
	});

	it("present historyDepth 'limited' -> medium + first_party_history_thin", () => {
		const result = evaluateEvidenceConfidence({
			market: PERFECT_MARKET,
			contentMapping: UNAMBIGUOUS,
			ccsHistory: trendResult({ historyDepth: "limited" }),
		});
		expect(result.level).toBe("medium");
		expect(result.limitingReasons).toEqual(["first_party_history_thin"]);
	});

	it("present historyDepth 'established' -> satisfies the first-party requirement for high", () => {
		const result = evaluateEvidenceConfidence({
			market: PERFECT_MARKET,
			contentMapping: UNAMBIGUOUS,
			ccsHistory: trendResult({ historyDepth: "established" }),
		});
		expect(result.level).toBe("high");
		expect(result.limitingReasons).toEqual([]);
	});

	it("missing and thin reasons never co-occur", () => {
		const missing = evaluateEvidenceConfidence({
			market: PERFECT_MARKET,
			contentMapping: UNAMBIGUOUS,
			ccsHistory: null,
		});
		expect(missing.limitingReasons).not.toContain("first_party_history_thin");

		const thin = evaluateEvidenceConfidence({
			market: PERFECT_MARKET,
			contentMapping: UNAMBIGUOUS,
			ccsHistory: trendResult({ historyDepth: "limited" }),
		});
		expect(thin.limitingReasons).not.toContain("first_party_history_missing");
	});

	it("missing first-party history alone never produces low", () => {
		const result = evaluateEvidenceConfidence({
			market: PERFECT_MARKET,
			contentMapping: UNAMBIGUOUS,
			ccsHistory: null,
		});
		expect(result.level).not.toBe("low");
		expect(result.level).toBe("medium");
	});
});

// ------------------------------------------------------------------
// 25-27. Limiting reasons — ordering, co-occurrence, determinism
// ------------------------------------------------------------------

describe("evaluateEvidenceConfidence — limiting reasons", () => {
	it("emits multiple simultaneous reasons in the exact declared order", () => {
		const result = evaluateEvidenceConfidence({
			market: marketResult({
				strict: marketMetric("rising"),
				broad: marketMetric("declining"),
				recentNoDataCount: 2,
			}),
			contentMapping: "ambiguous",
			ccsHistory: null,
		});
		expect(result.level).toBe("medium");
		expect(result.limitingReasons).toEqual([
			"market_signals_conflict",
			"recent_market_fetch_instability",
			"content_mapping_ambiguous",
			"first_party_history_missing",
		]);
	});

	it("a LOW result may still carry other informational reasons alongside the one that forced LOW", () => {
		const result = evaluateEvidenceConfidence({
			market: marketResult({ latestFetchStatus: "no_data" }),
			contentMapping: UNAMBIGUOUS,
			ccsHistory: null,
		});
		expect(result.level).toBe("low");
		expect(result.limitingReasons).toEqual(["latest_market_fetch_unavailable", "first_party_history_missing"]);
	});

	it("identical inputs return deeply identical results", () => {
		const input = {
			market: marketResult({ strict: marketMetric("rising"), broad: marketMetric("stable"), recentNoDataCount: 1 }),
			contentMapping: "ambiguous" as ContentMappingConfidence,
			ccsHistory: trendResult({ historyDepth: "limited" as const }),
		};
		const first = evaluateEvidenceConfidence(input);
		const second = evaluateEvidenceConfidence({ ...input });
		expect(first).toEqual(second);
	});
});

// ------------------------------------------------------------------
// 28-30. LOW precedence over otherwise-HIGH-qualifying factors
// ------------------------------------------------------------------

describe("evaluateEvidenceConfidence — LOW takes precedence", () => {
	it("latest no_data + otherwise perfect conditions -> low", () => {
		const result = evaluateEvidenceConfidence({
			market: marketResult({ latestFetchStatus: "no_data" }),
			contentMapping: UNAMBIGUOUS,
			ccsHistory: ESTABLISHED_HISTORY,
		});
		expect(result.level).toBe("low");
	});

	it("zero usable channels + otherwise perfect conditions -> low", () => {
		const result = evaluateEvidenceConfidence({
			market: marketResult({ strict: marketMetric("insufficient_data"), broad: marketMetric("insufficient_data") }),
			contentMapping: UNAMBIGUOUS,
			ccsHistory: ESTABLISHED_HISTORY,
		});
		expect(result.level).toBe("low");
	});
});

// ------------------------------------------------------------------
// 31-32. Non-influence — enforced structurally by the input type
// ------------------------------------------------------------------

describe("evaluateEvidenceConfidence — non-influence (compile-time)", () => {
	it("rejects business relevance at compile time — it is not part of the input type", () => {
		evaluateEvidenceConfidence({
			market: PERFECT_MARKET,
			contentMapping: UNAMBIGUOUS,
			ccsHistory: ESTABLISHED_HISTORY,
			// @ts-expect-error — businessRelevance must never be an accepted input; this is a
			// compile-time guarantee (excess-property check), not a runtime filter.
			businessRelevance: { level: "core", matches: [] },
		});
	});

	it("rejects a full ContentCoverageEvidence at compile time — only the mapping is accepted, never the level", () => {
		evaluateEvidenceConfidence({
			market: PERFECT_MARKET,
			// @ts-expect-error — the input type accepts only ContentMappingConfidence
			// ("unambiguous" | "ambiguous" | null), never the coverage evidence object or its
			// `level` field.
			contentMapping: { level: "title_match", mapping: "unambiguous", titleMatches: [], excerptOnlyMatches: [] },
			ccsHistory: ESTABLISHED_HISTORY,
		});
	});
});
