import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildRecommendationHandoff, buildRecommendationKeyPoints } from "../recommendationHandoff";
import { evaluateRecommendation } from "../recommendation";
import { RECOMMENDATION_REASON_LABEL } from "../marketOpportunityPresentation";
import type {
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
	RecommendationEvidence,
	RecommendationKind,
} from "../types";
import type { MarketMetricTrendEvidence, MarketTrendResult } from "../../market/trend";
import type { MetricTrendEvidence, TrendResult } from "../../opportunities/trend";

// ------------------------------------------------------------------
// Fixture builders (self-contained; mirrors recommendation.test.ts's
// fixtures but kept independent per this repo's convention of each test
// file owning its own fixtures).
// ------------------------------------------------------------------

function subjectFor(country: "gb" | "pl"): MarketOpportunitySubject {
	return {
		keyword: "code review automation",
		provider: "bing",
		market: country === "gb" ? { country: "gb", language: "en-GB" } : { country: "pl", language: "pl-PL" },
	};
}

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

function trendResult(direction: TrendResult["direction"]): TrendResult {
	const metric: MetricTrendEvidence = { direction, current: 50, baseline: 45, absoluteDelta: 5, relativeDelta: 0.11 };
	return {
		isNew: false,
		direction,
		historyDepth: "established",
		snapshotsUsed: 5,
		insufficientDataReason: null,
		latestComputedAt: "2026-02-20T00:00:00.000Z",
		baselineWindow: { snapshotCount: 5, earliestComputedAt: "2026-01-01T00:00:00.000Z", latestComputedAt: "2026-02-13T00:00:00.000Z" },
		metrics: { opportunityScore: metric, impressions: metric, clicks: metric, ctr: metric, avgPosition: metric },
	};
}

function firstPartyMatched(direction: TrendResult["direction"], opportunityId = "opp-1"): FirstPartyFixture {
	return {
		firstPartyMatch: { kind: "exact", opportunityId, matchedQuery: "code review automation" },
		ccsVisibility: {
			status: "matched",
			opportunityId,
			matchedQuery: "code review automation",
			matchKind: "exact",
			totalImpressions: 1000,
			totalClicks: 40,
			avgPosition: 8.2,
			googleImpressions: 700,
			bingImpressions: 300,
			opportunityScore: 55,
		},
		ccsTrend: { status: "matched", opportunityId, trend: trendResult(direction) },
	};
}

const ARTICLE: ContentCoverageMatch = { articleId: "article-1", locale: "en", slug: "code-review-automation" };
const ARTICLE_2: ContentCoverageMatch = { articleId: "article-2", locale: "en", slug: "code-review-automation-2" };

function coverageNone(): ContentCoverageEvidence {
	return { level: "none", mapping: null, titleMatches: [], excerptOnlyMatches: [] };
}
function coverageTitleMatch(titleMatches: ContentCoverageMatch[]): ContentCoverageEvidence {
	return {
		level: "title_match",
		mapping: titleMatches.length === 1 ? "unambiguous" : "ambiguous",
		titleMatches,
		excerptOnlyMatches: [],
	};
}

function confidenceEvidence(level: EvidenceConfidenceLevel): MarketOpportunityEvidence["evidenceConfidence"] {
	return {
		level,
		factors: {
			marketChannelsUsable: 2,
			marketAgreement: "agree",
			latestMarketFetchStatus: "observed",
			recentMarketNoDataCount: 0,
			contentMappingAmbiguous: false,
			ccsFirstPartyHistory: { present: true, historyDepth: "established" },
		},
		limitingReasons: [],
	};
}

function makeEvidence(params: {
	country?: "gb" | "pl";
	coverage: ContentCoverageEvidence;
	firstParty: FirstPartyFixture;
	confidence: EvidenceConfidenceLevel;
	growth?: boolean;
	decline?: boolean;
}): MarketOpportunityEvidence {
	const classifications: MarketOpportunityClassification[] = [];
	if (params.growth) classifications.push("market_growth");
	if (params.decline) classifications.push("market_decline");
	return {
		subject: subjectFor(params.country ?? "gb"),
		marketDemand: marketDemand(params.growth ? "rising" : params.decline ? "declining" : "stable"),
		firstPartyMatch: params.firstParty.firstPartyMatch,
		ccsVisibility: params.firstParty.ccsVisibility,
		ccsTrend: params.firstParty.ccsTrend,
		contentCoverage: params.coverage,
		businessRelevance: { level: "core", matches: [] },
		evidenceConfidence: confidenceEvidence(params.confidence),
		classifications,
	};
}

function recommendationFor(kind: RecommendationKind, evidence: MarketOpportunityEvidence): RecommendationEvidence {
	return { recommendation: kind, confidence: evidence.evidenceConfidence.level, supportingReasons: ["business_core"], blockingReasons: [], evidence };
}

// ------------------------------------------------------------------
// create_content handoff
// ------------------------------------------------------------------

describe("buildRecommendationHandoff — create_content", () => {
	it("navigates to /admin/insights/briefs/new with topic, locale, and no categoryId", () => {
		const evidence = makeEvidence({ country: "gb", coverage: coverageNone(), firstParty: firstPartyNone(), confidence: "high", growth: true });
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).toBe("create_content");

		const handoff = buildRecommendationHandoff(result);
		expect(handoff).not.toBeNull();
		expect(handoff!.label).toBe("Review content brief");

		const url = new URL(handoff!.href, "https://example.test");
		expect(url.pathname).toBe("/admin/insights/briefs/new");
		expect(url.searchParams.get("topic")).toBe("code review automation");
		expect(url.searchParams.get("locale")).toBe("en");
		expect(url.searchParams.has("categoryId")).toBe(false);
	});

	it("GB market maps to locale=en", () => {
		const evidence = makeEvidence({ country: "gb", coverage: coverageNone(), firstParty: firstPartyNone(), confidence: "high", growth: true });
		const handoff = buildRecommendationHandoff(evaluateRecommendation(evidence))!;
		expect(new URL(handoff.href, "https://example.test").searchParams.get("locale")).toBe("en");
	});

	it("PL market maps to locale=pl", () => {
		const evidence = makeEvidence({ country: "pl", coverage: coverageNone(), firstParty: firstPartyNone(), confidence: "high", growth: true });
		const handoff = buildRecommendationHandoff(evaluateRecommendation(evidence))!;
		expect(new URL(handoff.href, "https://example.test").searchParams.get("locale")).toBe("pl");
	});

	it("includes opportunityId only when ccsVisibility is a real matched record", () => {
		const matched = makeEvidence({ coverage: coverageNone(), firstParty: firstPartyMatched("stable", "opp-42"), confidence: "high", growth: true });
		// Force a create_content-shaped evidence directly (firstPartyMatched
		// alone wouldn't produce create_content via the real evaluator
		// since it also implies ccsVisibility/ccsTrend are matched, which is
		// fine here -- create_content's gates don't require them absent).
		const handoffMatched = buildRecommendationHandoff(evaluateRecommendation(matched));
		expect(handoffMatched).not.toBeNull();
		expect(new URL(handoffMatched!.href, "https://example.test").searchParams.get("opportunityId")).toBe("opp-42");

		const unmatched = makeEvidence({ coverage: coverageNone(), firstParty: firstPartyNone(), confidence: "high", growth: true });
		const handoffUnmatched = buildRecommendationHandoff(evaluateRecommendation(unmatched));
		expect(handoffUnmatched).not.toBeNull();
		expect(new URL(handoffUnmatched!.href, "https://example.test").searchParams.has("opportunityId")).toBe(false);
	});

	it("never includes categoryId under any circumstance", () => {
		const fixtures = [
			makeEvidence({ coverage: coverageNone(), firstParty: firstPartyNone(), confidence: "high", growth: true }),
			makeEvidence({ coverage: coverageNone(), firstParty: firstPartyMatched("stable"), confidence: "high", growth: true }),
		];
		for (const evidence of fixtures) {
			const handoff = buildRecommendationHandoff(evaluateRecommendation(evidence));
			expect(handoff).not.toBeNull();
			expect(handoff!.href).not.toContain("categoryId");
		}
	});

	it("deterministic: the same evidence always builds the same handoff href and label", () => {
		const evidence = makeEvidence({ coverage: coverageNone(), firstParty: firstPartyNone(), confidence: "high", growth: true });
		const result = evaluateRecommendation(evidence);
		const first = buildRecommendationHandoff(result);
		const second = buildRecommendationHandoff(result);
		expect(second).toEqual(first);
	});
});

// ------------------------------------------------------------------
// keyPoints
// ------------------------------------------------------------------

describe("buildRecommendationKeyPoints", () => {
	it("never serialises MarketOpportunityEvidence into the text", () => {
		const evidence = makeEvidence({ coverage: coverageNone(), firstParty: firstPartyNone(), confidence: "high", growth: true });
		const result = evaluateRecommendation(evidence);
		const keyPoints = buildRecommendationKeyPoints(result);
		expect(keyPoints).not.toContain("{");
		expect(keyPoints).not.toContain("subject");
		expect(keyPoints).not.toContain("marketDemand");
	});

	it("contains keyword, market, and confidence", () => {
		const evidence = makeEvidence({ coverage: coverageNone(), firstParty: firstPartyNone(), confidence: "high", growth: true });
		const keyPoints = buildRecommendationKeyPoints(evaluateRecommendation(evidence));
		expect(keyPoints).toContain("code review automation");
		expect(keyPoints).toContain("GB");
		expect(keyPoints).toContain("High");
	});

	it("contains the recommendation's supporting reasons", () => {
		const evidence = makeEvidence({ coverage: coverageNone(), firstParty: firstPartyNone(), confidence: "high", growth: true });
		const result = evaluateRecommendation(evidence);
		const keyPoints = buildRecommendationKeyPoints(result);
		expect(result.supportingReasons.length).toBeGreaterThan(0);
		expect(keyPoints).toContain("Why:");
		for (const reason of result.supportingReasons) {
			expect(keyPoints).toContain(RECOMMENDATION_REASON_LABEL[reason]);
		}
	});

	it("is deterministic across repeated calls", () => {
		const evidence = makeEvidence({ coverage: coverageNone(), firstParty: firstPartyNone(), confidence: "high", growth: true });
		const result = evaluateRecommendation(evidence);
		expect(buildRecommendationKeyPoints(result)).toBe(buildRecommendationKeyPoints(result));
	});

	it("the create_content handoff URL's keyPoints param matches buildRecommendationKeyPoints exactly", () => {
		const evidence = makeEvidence({ coverage: coverageNone(), firstParty: firstPartyNone(), confidence: "high", growth: true });
		const result = evaluateRecommendation(evidence);
		const handoff = buildRecommendationHandoff(result)!;
		const url = new URL(handoff.href, "https://example.test");
		expect(url.searchParams.get("keyPoints")).toBe(buildRecommendationKeyPoints(result));
	});
});

// ------------------------------------------------------------------
// refresh_content handoff
// ------------------------------------------------------------------

describe("buildRecommendationHandoff — refresh_content", () => {
	it("links to the uniquely matched article's edit route", () => {
		const evidence = makeEvidence({
			coverage: coverageTitleMatch([ARTICLE]),
			firstParty: firstPartyMatched("declining"),
			confidence: "high",
		});
		const result = evaluateRecommendation(evidence);
		expect(result.recommendation).toBe("refresh_content");

		const handoff = buildRecommendationHandoff(result);
		expect(handoff).not.toBeNull();
		expect(handoff!.label).toBe("Review refresh evidence");
		expect(handoff!.href).toBe(`/admin/insights/${ARTICLE.articleId}/edit`);
	});

	it("performs no mutation of the underlying evidence", () => {
		const evidence = makeEvidence({
			coverage: coverageTitleMatch([ARTICLE]),
			firstParty: firstPartyMatched("declining"),
			confidence: "high",
		});
		const result = evaluateRecommendation(evidence);
		const before = JSON.stringify(evidence);
		buildRecommendationHandoff(result);
		expect(JSON.stringify(evidence)).toBe(before);
	});

	it("fails closed (null) when titleMatches is not exactly one entry, even for a hand-built refresh_content result", () => {
		const evidenceZero = makeEvidence({ coverage: coverageNone(), firstParty: firstPartyMatched("declining"), confidence: "high" });
		expect(buildRecommendationHandoff(recommendationFor("refresh_content", evidenceZero))).toBeNull();

		const evidenceTwo = makeEvidence({
			coverage: coverageTitleMatch([ARTICLE, ARTICLE_2]),
			firstParty: firstPartyMatched("declining"),
			confidence: "high",
		});
		expect(buildRecommendationHandoff(recommendationFor("refresh_content", evidenceTwo))).toBeNull();
	});
});

// ------------------------------------------------------------------
// informational-only kinds never produce an action
// ------------------------------------------------------------------

describe("buildRecommendationHandoff — informational-only kinds", () => {
	it("research_further never produces a handoff", () => {
		const evidence = makeEvidence({ coverage: coverageNone(), firstParty: firstPartyNone(), confidence: "medium", growth: true });
		expect(buildRecommendationHandoff(recommendationFor("research_further", evidence))).toBeNull();
	});

	it("monitor never produces a handoff", () => {
		const evidence = makeEvidence({ coverage: coverageNone(), firstParty: firstPartyNone(), confidence: "high" });
		expect(buildRecommendationHandoff(recommendationFor("monitor", evidence))).toBeNull();
	});

	it("no_action never produces a handoff", () => {
		const evidence = makeEvidence({ coverage: coverageNone(), firstParty: firstPartyNone(), confidence: "low" });
		expect(buildRecommendationHandoff(recommendationFor("no_action", evidence))).toBeNull();
	});

	it("an unrecognised recommendation kind never produces a handoff (fails closed)", () => {
		const evidence = makeEvidence({ coverage: coverageNone(), firstParty: firstPartyNone(), confidence: "high", growth: true });
		const bogus = { ...recommendationFor("create_content", evidence), recommendation: "publish_now" } as unknown as RecommendationEvidence;
		expect(buildRecommendationHandoff(bogus)).toBeNull();
	});
});

// ------------------------------------------------------------------
// Source-inspection: no automatic execution, no Supabase, no scheduler
// ------------------------------------------------------------------

describe("recommendationHandoff.ts source has no automatic execution, I/O, or scheduling", () => {
	const SOURCE_PATH = resolve(process.cwd(), "src/features/content-intelligence/market-opportunity/recommendationHandoff.ts");
	const rawSource = readFileSync(SOURCE_PATH, "utf8");
	const code = rawSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
	const importLines = rawSource.split("\n").filter((line) => line.trimStart().startsWith("import"));

	it("never imports a brief/generation/promotion Server Action or service function", () => {
		const suspicious = importLines.some(
			(line) =>
				line.includes("createBriefAction") ||
				line.includes("createBrief") ||
				line.includes("runGeneration") ||
				line.includes("promoteToArticles") ||
				line.includes("@/lib/actions/"),
		);
		expect(suspicious).toBe(false);
	});

	it("never references Supabase, a service-role/privileged client, fetch, or await (no I/O)", () => {
		expect(/supabase/i.test(code)).toBe(false);
		expect(/createSupabasePrivilegedClient/.test(code)).toBe(false);
		expect(/\bfetch\s*\(/.test(code)).toBe(false);
		expect(/\bawait\b/.test(code)).toBe(false);
		expect(/\basync\b/.test(code)).toBe(false);
	});

	it("never references a scheduler, cron, or queue", () => {
		expect(/scheduler|cron|queue/i.test(code)).toBe(false);
	});

	it("never references image generation", () => {
		expect(/image.?gen|generateImage|AnthropicProvider/i.test(code)).toBe(false);
	});

	it("never references wall-clock time or randomness", () => {
		expect(/Date\s*\.\s*now\s*\(/.test(code)).toBe(false);
		expect(/Math\s*\.\s*random\s*\(/.test(code)).toBe(false);
	});
});
