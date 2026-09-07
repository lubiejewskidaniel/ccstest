import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateRecommendation } from "../recommendation";
import type {
	BusinessRelevanceLevel,
	CcsTrendEvidence,
	CcsVisibilityEvidence,
	ContentCoverageEvidence,
	ContentCoverageMatch,
	EvidenceConfidenceLevel,
	FirstPartyQueryMatchEvidence,
	MarketDemandEvidence,
	MarketOpportunityClassification,
	MarketOpportunityEvidence,
	MarketOpportunitySubject,
} from "../types";
import type { MarketMetricTrendEvidence, MarketTrendResult } from "../../market/trend";
import type { MetricTrendEvidence, TrendResult } from "../../opportunities/trend";

// ------------------------------------------------------------------
// Fixture builders. The evaluator only ever reads businessRelevance.level,
// contentCoverage.{level,mapping}, firstPartyMatch.kind,
// ccsVisibility.status, ccsTrend.{status, trend.direction},
// evidenceConfidence.level and classifications — marketDemand/subject
// values below are realistic-but-arbitrary and never asserted on.
// ------------------------------------------------------------------

const SUBJECT: MarketOpportunitySubject = {
	keyword: "code review automation",
	provider: "bing",
	market: { country: "gb", language: "en-GB" },
};

function metricEvidence(direction: MarketMetricTrendEvidence["direction"]): MarketMetricTrendEvidence {
	return {
		direction,
		historyDepth: "established",
		periodsUsed: 8,
		firstPeriod: "2026-01-05",
		latestPeriod: "2026-02-23",
		recentMean: 100,
		priorMean: 90,
		relativeChange: direction === "insufficient_data" ? null : 0.1,
		cadenceTrusted: true,
		observedGapCount: 0,
		duplicatePeriodCount: 0,
	};
}

function marketDemand(direction: MarketMetricTrendEvidence["direction"]): MarketDemandEvidence {
	const trend: MarketTrendResult = {
		latestFetchStatus: "observed",
		recentNoDataCount: 0,
		strict: metricEvidence(direction),
		broad: metricEvidence(direction),
	};
	return {
		trend,
		strict: { latestObservedImpressions: 500, latestObservedPeriod: "2026-02-23" },
		broad: { latestObservedImpressions: 900, latestObservedPeriod: "2026-02-23" },
	};
}

type FirstPartyFixture = {
	firstPartyMatch: FirstPartyQueryMatchEvidence;
	ccsVisibility: CcsVisibilityEvidence;
	ccsTrend: CcsTrendEvidence;
};

function firstPartyNone(): FirstPartyFixture {
	return { firstPartyMatch: { kind: "none" }, ccsVisibility: { status: "no_match" }, ccsTrend: { status: "no_match" } };
}

function firstPartyAmbiguous(candidateCount = 2): FirstPartyFixture {
	const candidateOpportunityIds = Array.from({ length: candidateCount }, (_, i) => `opp-${i}`);
	return {
		firstPartyMatch: { kind: "ambiguous", candidateOpportunityIds },
		ccsVisibility: { status: "ambiguous_match", candidateCount },
		ccsTrend: { status: "ambiguous_match", candidateCount },
	};
}

function trendResult(direction: TrendResult["direction"]): TrendResult {
	const metric: MetricTrendEvidence = {
		direction,
		current: 50,
		baseline: 45,
		absoluteDelta: 5,
		relativeDelta: direction === "insufficient_data" ? null : 0.11,
	};
	return {
		isNew: false,
		direction,
		historyDepth: direction === "insufficient_data" ? "limited" : "established",
		snapshotsUsed: direction === "insufficient_data" ? 1 : 5,
		insufficientDataReason: direction === "insufficient_data" ? "not enough snapshots yet" : null,
		latestComputedAt: "2026-02-20T00:00:00.000Z",
		baselineWindow: {
			snapshotCount: 5,
			earliestComputedAt: "2026-01-01T00:00:00.000Z",
			latestComputedAt: "2026-02-13T00:00:00.000Z",
		},
		metrics: { opportunityScore: metric, impressions: metric, clicks: metric, ctr: metric, avgPosition: metric },
	};
}

function firstPartyMatched(direction: TrendResult["direction"]): FirstPartyFixture {
	return {
		firstPartyMatch: { kind: "exact", opportunityId: "opp-1", matchedQuery: SUBJECT.keyword },
		ccsVisibility: {
			status: "matched",
			opportunityId: "opp-1",
			matchedQuery: SUBJECT.keyword,
			matchKind: "exact",
			totalImpressions: 1000,
			totalClicks: 40,
			avgPosition: 8.2,
			googleImpressions: 700,
			bingImpressions: 300,
			opportunityScore: 55,
		},
		ccsTrend: { status: "matched", opportunityId: "opp-1", trend: trendResult(direction) },
	};
}

const ARTICLE: ContentCoverageMatch = { articleId: "article-1", locale: "en", slug: "code-review-automation" };
const ARTICLE_2: ContentCoverageMatch = { articleId: "article-2", locale: "en", slug: "code-review-automation-2" };

function coverageNone(): ContentCoverageEvidence {
	return { level: "none", mapping: null, titleMatches: [], excerptOnlyMatches: [] };
}
function coverageMention(mapping: "unambiguous" | "ambiguous" = "unambiguous"): ContentCoverageEvidence {
	return {
		level: "mention",
		mapping,
		titleMatches: [],
		excerptOnlyMatches: mapping === "unambiguous" ? [ARTICLE] : [ARTICLE, ARTICLE_2],
	};
}
function coverageTitleMatch(mapping: "unambiguous" | "ambiguous" = "unambiguous"): ContentCoverageEvidence {
	return {
		level: "title_match",
		mapping,
		titleMatches: mapping === "unambiguous" ? [ARTICLE] : [ARTICLE, ARTICLE_2],
		excerptOnlyMatches: [],
	};
}

function confidenceEvidence(level: EvidenceConfidenceLevel): MarketOpportunityEvidence["evidenceConfidence"] {
	return {
		level,
		factors: {
			marketChannelsUsable: level === "low" ? 0 : 2,
			marketAgreement: level === "high" ? "agree" : level === "low" ? "unknown" : "mixed",
			latestMarketFetchStatus: level === "low" ? "no_data" : "observed",
			recentMarketNoDataCount: 0,
			contentMappingAmbiguous: false,
			ccsFirstPartyHistory: level === "high" ? { present: true, historyDepth: "established" } : { present: false },
		},
		limitingReasons: [],
	};
}

function classificationsFor(opts: { growth?: boolean; decline?: boolean; insufficientData?: boolean }): MarketOpportunityClassification[] {
	const list: MarketOpportunityClassification[] = [];
	if (opts.growth) list.push("market_growth");
	if (opts.decline) list.push("market_decline");
	if (opts.insufficientData) list.push("insufficient_data");
	return list;
}

function makeEvidence(params: {
	relevance: BusinessRelevanceLevel;
	coverage: ContentCoverageEvidence;
	firstParty: FirstPartyFixture;
	confidence: EvidenceConfidenceLevel;
	growth?: boolean;
	decline?: boolean;
	/** classifications.includes("insufficient_data") — real evidence
	 * always pairs this with confidence "low" and neither market_growth
	 * nor market_decline (marketChannelsUsable === 0 means neither
	 * channel has a usable direction at all), but this flag is passed
	 * through independently of `growth`/`decline` so a fixture can set
	 * it explicitly without relying on that real-world coupling. */
	insufficientData?: boolean;
}): MarketOpportunityEvidence {
	return {
		subject: SUBJECT,
		marketDemand: marketDemand(
			params.insufficientData ? "insufficient_data" : params.growth ? "rising" : params.decline ? "declining" : "stable",
		),
		firstPartyMatch: params.firstParty.firstPartyMatch,
		ccsVisibility: params.firstParty.ccsVisibility,
		ccsTrend: params.firstParty.ccsTrend,
		contentCoverage: params.coverage,
		businessRelevance: { level: params.relevance, matches: [] },
		evidenceConfidence: confidenceEvidence(params.confidence),
		classifications: classificationsFor({ growth: params.growth, decline: params.decline, insufficientData: params.insufficientData }),
	};
}

// ------------------------------------------------------------------
// 1. business relevance none
// ------------------------------------------------------------------

describe("Gate 0 — business relevance none", () => {
	it("1. business none -> no_action regardless of market growth", () => {
		const evidence = makeEvidence({
			relevance: "none",
			coverage: coverageNone(),
			firstParty: firstPartyNone(),
			confidence: "high",
			growth: true,
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).toBe("no_action");
		expect(result.supportingReasons).toEqual(["business_none"]);
		expect(result.blockingReasons).toEqual([]);
	});

	it("25. market growth alone cannot override business relevance", () => {
		const evidence = makeEvidence({
			relevance: "none",
			coverage: coverageNone(),
			firstParty: firstPartyMatched("rising"),
			confidence: "high",
			growth: true,
		});
		expect(evaluateRecommendation(evidence).recommendation).toBe("no_action");
	});
});

// ------------------------------------------------------------------
// create_content
// ------------------------------------------------------------------

describe("create_content", () => {
	it("2. core + missing + HIGH + growth -> create_content", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageNone(),
			firstParty: firstPartyNone(),
			confidence: "high",
			growth: true,
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).toBe("create_content");
		expect(result.supportingReasons).toEqual(["business_core", "market_growth", "content_missing"]);
		expect(result.blockingReasons).toEqual([]);
	});

	it("3. core + mention + HIGH + growth -> create_content", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageMention("unambiguous"),
			firstParty: firstPartyNone(),
			confidence: "high",
			growth: true,
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).toBe("create_content");
	});

	it("4. mention emits content_partial_mention", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageMention("unambiguous"),
			firstParty: firstPartyNone(),
			confidence: "high",
			growth: true,
		});
		const result = evaluateRecommendation(evidence);
		expect(result.supportingReasons).toContain("content_partial_mention");
		expect(result.supportingReasons).not.toContain("content_missing");
	});

	it("24. content mention is not treated as dedicated coverage (does not block create_content)", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageMention("unambiguous"),
			firstParty: firstPartyNone(),
			confidence: "high",
			growth: true,
		});
		expect(evaluateRecommendation(evidence).recommendation).toBe("create_content");
	});

	it("5. core + missing + MEDIUM + growth -> research_further (never create_content)", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageNone(),
			firstParty: firstPartyNone(),
			confidence: "medium",
			growth: true,
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).toBe("research_further");
		expect(result.blockingReasons).toEqual(["confidence_medium"]);
	});

	it("13. ambiguous content mapping prevents create_content", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageMention("ambiguous"),
			firstParty: firstPartyNone(),
			confidence: "high",
			growth: true,
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).not.toBe("create_content");
		expect(result.recommendation).toBe("research_further");
		expect(result.blockingReasons).toContain("content_mapping_ambiguous");
	});

	it("15. ambiguous first-party match prevents create_content", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageNone(),
			firstParty: firstPartyAmbiguous(),
			confidence: "high",
			growth: true,
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).not.toBe("create_content");
		expect(result.recommendation).toBe("research_further");
		expect(result.blockingReasons).toContain("first_party_ambiguous_match");
	});
});

// ------------------------------------------------------------------
// adjacent relevance ceiling
// ------------------------------------------------------------------

describe("adjacent relevance never reaches create_content or refresh_content", () => {
	it("6. adjacent + HIGH + growth never -> create_content", () => {
		const evidence = makeEvidence({
			relevance: "adjacent",
			coverage: coverageNone(),
			firstParty: firstPartyNone(),
			confidence: "high",
			growth: true,
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).not.toBe("create_content");
		expect(result.recommendation).toBe("research_further");
	});

	it("7. adjacent + HIGH + existing decline never -> refresh_content", () => {
		const evidence = makeEvidence({
			relevance: "adjacent",
			coverage: coverageTitleMatch("unambiguous"),
			firstParty: firstPartyMatched("declining"),
			confidence: "high",
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).not.toBe("refresh_content");
		expect(result.recommendation).toBe("research_further");
	});

	it("8. adjacent strongest reachable result is research_further, across several fixtures", () => {
		const fixtures: MarketOpportunityEvidence[] = [
			makeEvidence({ relevance: "adjacent", coverage: coverageNone(), firstParty: firstPartyNone(), confidence: "high", growth: true }),
			makeEvidence({ relevance: "adjacent", coverage: coverageTitleMatch(), firstParty: firstPartyMatched("declining"), confidence: "high" }),
			makeEvidence({ relevance: "adjacent", coverage: coverageMention(), firstParty: firstPartyMatched("rising"), confidence: "high", growth: true }),
		];
		for (const evidence of fixtures) {
			const result = evaluateRecommendation(evidence);
			expect(result.recommendation).not.toBe("create_content");
			expect(result.recommendation).not.toBe("refresh_content");
		}
	});
});

// ------------------------------------------------------------------
// refresh_content
// ------------------------------------------------------------------

describe("refresh_content", () => {
	it("9. title_match + unambiguous + HIGH + CCS declining + non-declining market -> refresh_content", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageTitleMatch("unambiguous"),
			firstParty: firstPartyMatched("declining"),
			confidence: "high",
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).toBe("refresh_content");
		expect(result.supportingReasons).toEqual(["business_core", "existing_content_declining"]);
		expect(result.blockingReasons).toEqual([]);
	});

	it("10. same refresh case at MEDIUM -> research_further", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageTitleMatch("unambiguous"),
			firstParty: firstPartyMatched("declining"),
			confidence: "medium",
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).toBe("research_further");
		expect(result.blockingReasons).toEqual(["confidence_medium"]);
	});

	it("11. same refresh case + market_decline -> research_further", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageTitleMatch("unambiguous"),
			firstParty: firstPartyMatched("declining"),
			confidence: "high",
			decline: true,
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).toBe("research_further");
		expect(result.blockingReasons).toEqual(["market_decline"]);
	});

	it("14. ambiguous content mapping prevents refresh_content", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageTitleMatch("ambiguous"),
			firstParty: firstPartyMatched("declining"),
			confidence: "high",
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).not.toBe("refresh_content");
		expect(result.recommendation).toBe("research_further");
		expect(result.blockingReasons).toContain("content_mapping_ambiguous");
	});

	it("16. ambiguous first-party match prevents refresh_content", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageTitleMatch("unambiguous"),
			firstParty: firstPartyAmbiguous(),
			confidence: "high",
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).not.toBe("refresh_content");
		expect(result.recommendation).toBe("research_further");
		expect(result.blockingReasons).toContain("first_party_ambiguous_match");
	});

	it("12. title_match + stable/healthy + HIGH -> no_action", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageTitleMatch("unambiguous"),
			firstParty: firstPartyMatched("stable"),
			confidence: "high",
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).toBe("no_action");
	});
});

// ------------------------------------------------------------------
// research_further / monitor / stable-market lock
// ------------------------------------------------------------------

describe("research_further vs. monitor", () => {
	it("17. core + HIGH + missing + stable market -> monitor", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageNone(),
			firstParty: firstPartyNone(),
			confidence: "high",
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).toBe("monitor");
	});

	it("18. the stable market case does NOT resolve to research_further", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageNone(),
			firstParty: firstPartyNone(),
			confidence: "high",
		});
		expect(evaluateRecommendation(evidence).recommendation).not.toBe("research_further");
	});

	it("19. market conflict (growth and decline both present) -> research_further", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageNone(),
			firstParty: firstPartyNone(),
			confidence: "medium",
			growth: true,
			decline: true,
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).toBe("research_further");
		expect(result.blockingReasons).toContain("market_signal_unclear");
	});

	it("20. insufficient first-party history (matched but insufficient_data direction) -> monitor", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageTitleMatch("unambiguous"),
			firstParty: firstPartyMatched("insufficient_data"),
			confidence: "medium",
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).toBe("monitor");
	});

	it("23. no first-party match is not interpreted as zero visibility (monitor, not no_action/refresh)", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageTitleMatch("unambiguous"),
			firstParty: firstPartyNone(),
			confidence: "high",
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).toBe("monitor");
		expect(result.recommendation).not.toBe("no_action");
		expect(result.recommendation).not.toBe("refresh_content");
	});
});

// ------------------------------------------------------------------
// low confidence
// ------------------------------------------------------------------

describe("low confidence", () => {
	it("21. LOW + concrete positive fact (market growth) -> monitor", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageNone(),
			firstParty: firstPartyNone(),
			confidence: "low",
			growth: true,
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).toBe("monitor");
		expect(result.recommendation).not.toBe("research_further");
	});

	it("22. LOW + no concrete positive fact and NOT insufficient_data -> no_action", () => {
		// Usable market data that simply shows nothing happening (stable),
		// with no coverage and no first-party match -- a genuine "the
		// evidence supports doing nothing", not an absence of evidence.
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageNone(),
			firstParty: firstPartyNone(),
			confidence: "low",
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).toBe("no_action");
	});

	// -- Regression: monitor vs. no_action must never conflate "we don't
	// know yet" with "the evidence says do nothing" -- absence of
	// evidence (classifications includes "insufficient_data") must force
	// monitor on its own, with no additional positive fact required, for
	// any relevance other than "none". See the module's own doc comment
	// ("monitor vs. no_action: absence of evidence is never evidence").

	it("core + coverage none + no first-party match + LOW + insufficient_data -> monitor (not no_action)", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageNone(),
			firstParty: firstPartyNone(),
			confidence: "low",
			insufficientData: true,
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).toBe("monitor");
		expect(result.recommendation).not.toBe("no_action");
	});

	it("adjacent + coverage none + LOW + insufficient_data -> monitor (not no_action)", () => {
		const evidence = makeEvidence({
			relevance: "adjacent",
			coverage: coverageNone(),
			firstParty: firstPartyNone(),
			confidence: "low",
			insufficientData: true,
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).toBe("monitor");
		expect(result.recommendation).not.toBe("no_action");
	});

	it("business none + insufficient_data -> no_action (Gate 0 still overrides)", () => {
		const evidence = makeEvidence({
			relevance: "none",
			coverage: coverageNone(),
			firstParty: firstPartyNone(),
			confidence: "low",
			insufficientData: true,
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).toBe("no_action");
		expect(result.supportingReasons).toEqual(["business_none"]);
	});

	it("insufficient_data alone is enough for monitor -- no additional positive fact required", () => {
		// No market growth, no coverage, no matched first-party record --
		// only insufficient_data. Must still be monitor, not no_action.
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageNone(),
			firstParty: firstPartyNone(),
			confidence: "low",
			insufficientData: true,
			growth: false,
			decline: false,
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).toBe("monitor");
	});

	it("LOW + ambiguous mapping -> monitor, never no_action or research_further", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageMention("ambiguous"),
			firstParty: firstPartyNone(),
			confidence: "low",
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).toBe("monitor");
	});

	it("LOW + matched first-party visibility (even with a stable market) -> monitor, not no_action", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageNone(),
			firstParty: firstPartyMatched("stable"),
			confidence: "low",
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).toBe("monitor");
	});

	it("LOW + pure market decline + nothing else -> no_action (a clear conclusion, not hidden uncertainty)", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageNone(),
			firstParty: firstPartyNone(),
			confidence: "low",
			decline: true,
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).toBe("no_action");
	});
});

// ------------------------------------------------------------------
// determinism, reason ordering, dedup, structural guarantees
// ------------------------------------------------------------------

describe("determinism and structural guarantees", () => {
	it("26. deterministic recommendation across repeated calls", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageNone(),
			firstParty: firstPartyNone(),
			confidence: "high",
			growth: true,
		});
		const first = evaluateRecommendation(evidence);
		const second = evaluateRecommendation(evidence);
		expect(second).toEqual(first);
	});

	it("27. deterministic supportingReasons ordering", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageNone(),
			firstParty: firstPartyNone(),
			confidence: "high",
			growth: true,
		});
		const result = evaluateRecommendation(evidence);
		expect(result.supportingReasons).toEqual(["business_core", "market_growth", "content_missing"]);
	});

	it("28. deterministic blockingReasons ordering (mapping ambiguity before confidence)", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageMention("ambiguous"),
			firstParty: firstPartyNone(),
			confidence: "medium",
		});
		const result = evaluateRecommendation(evidence);
		expect(result.blockingReasons).toEqual(["content_mapping_ambiguous", "confidence_medium"]);
	});

	it("29. reason arrays contain no duplicates, across several fixtures", () => {
		const fixtures: MarketOpportunityEvidence[] = [
			makeEvidence({ relevance: "core", coverage: coverageNone(), firstParty: firstPartyNone(), confidence: "high", growth: true }),
			makeEvidence({ relevance: "core", coverage: coverageTitleMatch(), firstParty: firstPartyMatched("declining"), confidence: "high" }),
			makeEvidence({ relevance: "adjacent", coverage: coverageMention("ambiguous"), firstParty: firstPartyNone(), confidence: "medium" }),
			makeEvidence({ relevance: "core", coverage: coverageNone(), firstParty: firstPartyNone(), confidence: "low", decline: true }),
		];
		for (const evidence of fixtures) {
			const result = evaluateRecommendation(evidence);
			expect(new Set(result.supportingReasons).size).toBe(result.supportingReasons.length);
			expect(new Set(result.blockingReasons).size).toBe(result.blockingReasons.length);
		}
	});

	it("30. result.evidence === input evidence by object identity", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageNone(),
			firstParty: firstPartyNone(),
			confidence: "high",
			growth: true,
		});
		const result = evaluateRecommendation(evidence);
		expect(result.evidence).toBe(evidence);
	});

	it("31. result.confidence === input evidence.evidenceConfidence.level, across all three levels", () => {
		for (const level of ["low", "medium", "high"] as const) {
			const evidence = makeEvidence({
				relevance: "core",
				coverage: coverageNone(),
				firstParty: firstPartyNone(),
				confidence: level,
				growth: level === "high",
			});
			expect(evaluateRecommendation(evidence).confidence).toBe(level);
		}
	});

	it("32. input evidence remains unmodified", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageTitleMatch("unambiguous"),
			firstParty: firstPartyMatched("declining"),
			confidence: "high",
		});
		const before = JSON.parse(JSON.stringify(evidence));
		evaluateRecommendation(evidence);
		expect(JSON.parse(JSON.stringify(evidence))).toEqual(before);
	});

	it("33. no numeric recommendation score exists on the result", () => {
		const evidence = makeEvidence({
			relevance: "core",
			coverage: coverageNone(),
			firstParty: firstPartyNone(),
			confidence: "high",
			growth: true,
		});
		const result = evaluateRecommendation(evidence);
		expect(Object.keys(result).sort()).toEqual(["blockingReasons", "confidence", "evidence", "recommendation", "supportingReasons"].sort());
		expect((result as Record<string, unknown>).score).toBeUndefined();
	});
});

// ------------------------------------------------------------------
// 34. source-inspection: no I/O, LLM, randomness, or time dependence.
// Reads the real, unmodified recommendation.ts source text -- resolved
// from process.cwd(), never import.meta.url (which throws "The URL must
// be of scheme file" on Windows; the same fix already applied to
// market-opportunity/__tests__/queries.test.ts in Phase 3C.1E). Comments
// are stripped first so a doc-comment mentioning these terms in prose
// (this module's own doc comment above, for one) can never produce a
// false positive -- the same bug class already hit and fixed twice
// earlier in this engagement (createSupabasePrivilegedClient in
// queries.ts's doc comment; "use client" in
// MarketOpportunityInspector.tsx's doc comment).
// ------------------------------------------------------------------

describe("recommendation.ts source has no I/O, LLM, randomness, or time dependence", () => {
	const SOURCE_PATH = resolve(process.cwd(), "src/features/content-intelligence/market-opportunity/recommendation.ts");
	const rawSource = readFileSync(SOURCE_PATH, "utf8");
	const code = rawSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

	it("has no Supabase reference", () => {
		expect(/supabase/i.test(code)).toBe(false);
	});

	it("has no fetch call", () => {
		expect(/\bfetch\s*\(/.test(code)).toBe(false);
	});

	it("has no wall-clock read (Date.now / new Date)", () => {
		expect(/Date\s*\.\s*now\s*\(/.test(code)).toBe(false);
		expect(/new\s+Date\s*\(/.test(code)).toBe(false);
	});

	it("has no randomness", () => {
		expect(/Math\s*\.\s*random\s*\(/.test(code)).toBe(false);
	});

	it("has no async/await (no I/O of any kind)", () => {
		expect(/\bawait\b/.test(code)).toBe(false);
		expect(/\basync\b/.test(code)).toBe(false);
	});

	it("has no process.env access", () => {
		expect(/process\s*\.\s*env/.test(code)).toBe(false);
	});

	it("has no LLM/AI provider reference", () => {
		expect(/anthropic|openai|llm/i.test(code)).toBe(false);
	});

	it("exports evaluateRecommendation as its only runtime export", () => {
		const exportLines = rawSource.split("\n").filter((line) => /^export\s/.test(line.trim()));
		expect(exportLines).toHaveLength(1);
		expect(exportLines[0]).toContain("evaluateRecommendation");
	});
});
