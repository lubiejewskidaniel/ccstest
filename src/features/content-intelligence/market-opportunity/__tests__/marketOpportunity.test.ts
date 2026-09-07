import { describe, it, expect } from "vitest";
import { evaluateMarketOpportunity } from "../marketOpportunity";
import type { EvaluateMarketOpportunityInput, FirstPartyOpportunityCandidate } from "../marketOpportunity";
import type { MarketOpportunitySubject } from "../types";
import type { MarketKeywordObservationRow } from "../../market/queries";
import { evaluateMarketTrend } from "../../market/trend";
import { evaluateOpportunityTrend } from "../../opportunities/trend";
import type { TrendSnapshot } from "../../opportunities/trend";
import { evaluateBusinessRelevance } from "../businessRelevance";
import { evaluateContentCoverage } from "../contentCoverage";
import type { ArticleCandidateForCoverage } from "../contentCoverage";
import { evaluateEvidenceConfidence } from "../evidenceConfidence";
import type { MarketCode } from "../../market/types";

// ------------------------------------------------------------------
// Test helpers
// ------------------------------------------------------------------

const GB: MarketCode = { country: "gb", language: "en-GB" };
const PL: MarketCode = { country: "pl", language: "pl-PL" };

function subject(overrides: Partial<MarketOpportunitySubject> = {}): MarketOpportunitySubject {
	return { keyword: "seo agency", provider: "bing", market: GB, ...overrides };
}

function row(overrides: Partial<MarketKeywordObservationRow> = {}): MarketKeywordObservationRow {
	return {
		status: "observed",
		periodStart: "2026-01-05",
		impressions: 100,
		broadImpressions: null,
		fetchedAt: "2026-01-05T00:00:00.000Z",
		...overrides,
	};
}

function addDaysIso(base: string, days: number): string {
	const d = new Date(`${base}T00:00:00.000Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

/** 8 weekly rows (established history for both trend.ts windows) with a
 * constant strict value (stable) and a constant broad value (stable) —
 * a safe, materially-flat baseline fixture other fixtures override. */
function stableRows(): MarketKeywordObservationRow[] {
	return Array.from({ length: 8 }, (_, i) => {
		const periodStart = addDaysIso("2026-01-05", i * 7);
		return row({ periodStart, impressions: 100, broadImpressions: 100, fetchedAt: `${periodStart}T00:00:00.000Z` });
	});
}

/** 8 weekly rows for one channel: prior 4 periods at `priorValue`, recent
 * 4 periods at `recentValue` — material change drives rising/declining. */
function trendingChannelRows(
	channel: "impressions" | "broadImpressions",
	priorValue: number,
	recentValue: number,
): MarketKeywordObservationRow[] {
	return Array.from({ length: 8 }, (_, i) => {
		const periodStart = addDaysIso("2026-01-05", i * 7);
		const value = i < 4 ? priorValue : recentValue;
		return row({
			periodStart,
			impressions: channel === "impressions" ? value : 100,
			broadImpressions: channel === "broadImpressions" ? value : 100,
			fetchedAt: `${periodStart}T00:00:00.000Z`,
		});
	});
}

function opportunityCandidate(overrides: Partial<FirstPartyOpportunityCandidate> = {}): FirstPartyOpportunityCandidate {
	return {
		id: "opp-1",
		query: "seo agency",
		totalImpressions: 500,
		totalClicks: 20,
		avgPosition: 8.5,
		googleImpressions: 300,
		bingImpressions: 200,
		opportunityScore: 42,
		scoreHistory: [],
		...overrides,
	};
}

function snapshot(overrides: Partial<TrendSnapshot> = {}): TrendSnapshot {
	return {
		opportunityScore: 40,
		totalImpressions: 400,
		totalClicks: 15,
		avgPosition: 9,
		computedAt: "2026-05-01T00:00:00.000Z",
		...overrides,
	};
}

let nextArticleId = 1;
function article(overrides: Partial<ArticleCandidateForCoverage> = {}): ArticleCandidateForCoverage {
	const id = `article-${nextArticleId++}`;
	return {
		id,
		locale: "en",
		slug: `slug-${id}`,
		title: "Untitled",
		excerpt: "No excerpt.",
		status: "published",
		...overrides,
	};
}

function input(overrides: Partial<EvaluateMarketOpportunityInput> = {}): EvaluateMarketOpportunityInput {
	return {
		subject: subject(),
		marketObservations: [],
		firstPartyCandidates: [],
		articleCandidates: [],
		...overrides,
	};
}

// ------------------------------------------------------------------
// QUERY MATCHING (1-9)
// ------------------------------------------------------------------

describe("evaluateMarketOpportunity — query matching", () => {
	it("1. raw exact match -> kind exact", () => {
		const result = evaluateMarketOpportunity(
			input({
				subject: subject({ keyword: "seo agency" }),
				firstPartyCandidates: [opportunityCandidate({ id: "opp-1", query: "seo agency" })],
			}),
		);
		expect(result.firstPartyMatch).toEqual({ kind: "exact", opportunityId: "opp-1", matchedQuery: "seo agency" });
	});

	it("2. normalized exact match from case difference", () => {
		const result = evaluateMarketOpportunity(
			input({
				subject: subject({ keyword: "SEO Agency" }),
				firstPartyCandidates: [opportunityCandidate({ id: "opp-1", query: "seo agency" })],
			}),
		);
		expect(result.firstPartyMatch).toEqual({ kind: "normalized_exact", opportunityId: "opp-1", matchedQuery: "seo agency" });
	});

	it("3. normalized exact from whitespace/punctuation normalization", () => {
		const result = evaluateMarketOpportunity(
			input({
				subject: subject({ keyword: "seo-agency, london" }),
				firstPartyCandidates: [opportunityCandidate({ id: "opp-1", query: "seo agency london" })],
			}),
		);
		expect(result.firstPartyMatch).toEqual({
			kind: "normalized_exact",
			opportunityId: "opp-1",
			matchedQuery: "seo agency london",
		});
	});

	it("4. no match -> kind none", () => {
		const result = evaluateMarketOpportunity(
			input({
				subject: subject({ keyword: "completely unrelated phrase" }),
				firstPartyCandidates: [opportunityCandidate({ id: "opp-1", query: "seo agency" })],
			}),
		);
		expect(result.firstPartyMatch).toEqual({ kind: "none" });
	});

	it("5. multiple normalized matches -> ambiguous", () => {
		const result = evaluateMarketOpportunity(
			input({
				subject: subject({ keyword: "Seo Agency" }),
				firstPartyCandidates: [
					opportunityCandidate({ id: "opp-2", query: "SEO Agency" }),
					opportunityCandidate({ id: "opp-1", query: "seo  agency" }),
				],
			}),
		);
		expect(result.firstPartyMatch.kind).toBe("ambiguous");
	});

	it("6. ambiguous candidate IDs sorted lexically regardless of match order", () => {
		const result = evaluateMarketOpportunity(
			input({
				subject: subject({ keyword: "Seo Agency" }),
				firstPartyCandidates: [
					opportunityCandidate({ id: "opp-2", query: "SEO Agency" }),
					opportunityCandidate({ id: "opp-1", query: "seo  agency" }),
				],
			}),
		);
		expect(result.firstPartyMatch).toEqual({ kind: "ambiguous", candidateOpportunityIds: ["opp-1", "opp-2"] });
	});

	it("7. caller duplicate candidate ID does not duplicate the ambiguous ID", () => {
		const result = evaluateMarketOpportunity(
			input({
				subject: subject({ keyword: "seo agency" }),
				firstPartyCandidates: [
					opportunityCandidate({ id: "opp-1", query: "SEO AGENCY" }),
					opportunityCandidate({ id: "opp-1", query: "Seo Agency" }),
					opportunityCandidate({ id: "opp-2", query: "seo  agency" }),
				],
			}),
		);
		expect(result.firstPartyMatch).toEqual({ kind: "ambiguous", candidateOpportunityIds: ["opp-1", "opp-2"] });
	});

	it("8. reordering firstPartyCandidates gives a deeply identical firstPartyMatch", () => {
		const a = opportunityCandidate({ id: "opp-2", query: "SEO Agency" });
		const b = opportunityCandidate({ id: "opp-1", query: "seo  agency" });
		const first = evaluateMarketOpportunity(
			input({ subject: subject({ keyword: "Seo Agency" }), firstPartyCandidates: [a, b] }),
		);
		const second = evaluateMarketOpportunity(
			input({ subject: subject({ keyword: "Seo Agency" }), firstPartyCandidates: [b, a] }),
		);
		expect(first.firstPartyMatch).toEqual(second.firstPartyMatch);
	});

	it("9. no phrase containment: a shorter keyword inside a longer candidate query does not match", () => {
		const result = evaluateMarketOpportunity(
			input({
				subject: subject({ keyword: "seo" }),
				firstPartyCandidates: [opportunityCandidate({ id: "opp-1", query: "seo agency london" })],
			}),
		);
		expect(result.firstPartyMatch).toEqual({ kind: "none" });
	});
});

// ------------------------------------------------------------------
// LATEST MARKET DATA (10-18)
// ------------------------------------------------------------------

describe("evaluateMarketOpportunity — latest raw market evidence", () => {
	it("10. strict latest chosen by periodStart, not fetchedAt", () => {
		const rows: MarketKeywordObservationRow[] = [
			row({ periodStart: "2026-01-01", impressions: 999, fetchedAt: "2026-06-01T00:00:00.000Z" }),
			row({ periodStart: "2026-02-01", impressions: 50, fetchedAt: "2026-02-01T00:00:00.000Z" }),
		];
		const result = evaluateMarketOpportunity(input({ marketObservations: rows }));
		expect(result.marketDemand.strict).toEqual({ latestObservedImpressions: 50, latestObservedPeriod: "2026-02-01" });
	});

	it("11. broad latest chosen independently by periodStart", () => {
		const rows: MarketKeywordObservationRow[] = [
			row({ periodStart: "2026-01-01", impressions: 5, broadImpressions: 999, fetchedAt: "2026-06-01T00:00:00.000Z" }),
			row({ periodStart: "2026-02-01", impressions: 5, broadImpressions: 50, fetchedAt: "2026-02-01T00:00:00.000Z" }),
		];
		const result = evaluateMarketOpportunity(input({ marketObservations: rows }));
		expect(result.marketDemand.broad).toEqual({ latestObservedImpressions: 50, latestObservedPeriod: "2026-02-01" });
	});

	it("12. strict and broad can have different latest periods (worked example)", () => {
		const rows: MarketKeywordObservationRow[] = [
			row({ periodStart: "2026-09-05", impressions: 15, broadImpressions: null, fetchedAt: "2026-09-05T00:00:00.000Z" }),
			row({ periodStart: "2026-08-29", impressions: 7, broadImpressions: 38, fetchedAt: "2026-08-29T00:00:00.000Z" }),
		];
		const result = evaluateMarketOpportunity(input({ marketObservations: rows }));
		expect(result.marketDemand.strict).toEqual({ latestObservedImpressions: 15, latestObservedPeriod: "2026-09-05" });
		expect(result.marketDemand.broad).toEqual({ latestObservedImpressions: 38, latestObservedPeriod: "2026-08-29" });
	});

	it("13. a later strict-only row does not erase an older valid broad latest value", () => {
		const rows: MarketKeywordObservationRow[] = [
			row({ periodStart: "2026-08-29", impressions: 7, broadImpressions: 38, fetchedAt: "2026-08-29T00:00:00.000Z" }),
			row({ periodStart: "2026-09-05", impressions: 15, broadImpressions: null, fetchedAt: "2026-09-05T00:00:00.000Z" }),
		];
		const result = evaluateMarketOpportunity(input({ marketObservations: rows }));
		expect(result.marketDemand.broad.latestObservedImpressions).toBe(38);
		expect(result.marketDemand.broad.latestObservedPeriod).toBe("2026-08-29");
	});

	it("14 & 15. duplicate periodStart resolved by fetchedAt, independently per channel", () => {
		const P = "2026-03-30";
		const rows: MarketKeywordObservationRow[] = [
			row({ periodStart: P, impressions: 5, broadImpressions: 50, fetchedAt: "2026-04-01T08:00:00.000Z" }),
			row({ periodStart: P, impressions: 1, broadImpressions: 90, fetchedAt: "2026-04-01T09:00:00.000Z" }),
			row({ periodStart: P, impressions: 999, broadImpressions: null, fetchedAt: "2026-04-01T10:00:00.000Z" }),
		];
		const result = evaluateMarketOpportunity(input({ marketObservations: rows }));
		// Strict: all three rows are strict-eligible -> greatest fetchedAt (10:00) wins -> 999.
		expect(result.marketDemand.strict).toEqual({ latestObservedImpressions: 999, latestObservedPeriod: P });
		// Broad: only the first two rows are broad-eligible (third has broadImpressions null)
		// -> greatest fetchedAt among those two (09:00) wins -> 90. A different winning row
		// than strict, proving independent resolution.
		expect(result.marketDemand.broad).toEqual({ latestObservedImpressions: 90, latestObservedPeriod: P });
	});

	it("16. a no_data row is ignored for both channels", () => {
		const rows: MarketKeywordObservationRow[] = [
			row({ periodStart: "2026-02-01", impressions: 50, broadImpressions: 60, fetchedAt: "2026-02-01T00:00:00.000Z" }),
			{ status: "no_data", periodStart: null, impressions: null, broadImpressions: null, fetchedAt: "2026-03-01T00:00:00.000Z" },
		];
		const result = evaluateMarketOpportunity(input({ marketObservations: rows }));
		expect(result.marketDemand.strict).toEqual({ latestObservedImpressions: 50, latestObservedPeriod: "2026-02-01" });
		expect(result.marketDemand.broad).toEqual({ latestObservedImpressions: 60, latestObservedPeriod: "2026-02-01" });
	});

	it("17. no strict-eligible row -> null/null", () => {
		const rows: MarketKeywordObservationRow[] = [
			{ status: "no_data", periodStart: null, impressions: null, broadImpressions: null, fetchedAt: "2026-03-01T00:00:00.000Z" },
		];
		const result = evaluateMarketOpportunity(input({ marketObservations: rows }));
		expect(result.marketDemand.strict).toEqual({ latestObservedImpressions: null, latestObservedPeriod: null });
	});

	it("18. no broad-eligible row -> null/null", () => {
		const rows: MarketKeywordObservationRow[] = [
			row({ periodStart: "2026-02-01", impressions: 10, broadImpressions: null, fetchedAt: "2026-02-01T00:00:00.000Z" }),
			row({ periodStart: "2026-02-08", impressions: 20, broadImpressions: null, fetchedAt: "2026-02-08T00:00:00.000Z" }),
		];
		const result = evaluateMarketOpportunity(input({ marketObservations: rows }));
		expect(result.marketDemand.strict).toEqual({ latestObservedImpressions: 20, latestObservedPeriod: "2026-02-08" });
		expect(result.marketDemand.broad).toEqual({ latestObservedImpressions: null, latestObservedPeriod: null });
	});
});

// ------------------------------------------------------------------
// VISIBILITY / FIRST-PARTY TREND (19-27)
// ------------------------------------------------------------------

describe("evaluateMarketOpportunity — visibility and first-party trend", () => {
	it("19. no match -> visibility no_match + trend no_match", () => {
		const result = evaluateMarketOpportunity(input({ firstPartyCandidates: [] }));
		expect(result.ccsVisibility).toEqual({ status: "no_match" });
		expect(result.ccsTrend).toEqual({ status: "no_match" });
	});

	it("20. ambiguous -> both visibility and trend ambiguous_match with the same candidateCount", () => {
		const result = evaluateMarketOpportunity(
			input({
				subject: subject({ keyword: "Seo Agency" }),
				firstPartyCandidates: [
					opportunityCandidate({ id: "opp-2", query: "SEO Agency" }),
					opportunityCandidate({ id: "opp-1", query: "seo  agency" }),
				],
			}),
		);
		expect(result.ccsVisibility).toEqual({ status: "ambiguous_match", candidateCount: 2 });
		expect(result.ccsTrend).toEqual({ status: "ambiguous_match", candidateCount: 2 });
	});

	it("21. ambiguous does not select or blend one candidate's history", () => {
		const result = evaluateMarketOpportunity(
			input({
				subject: subject({ keyword: "Seo Agency" }),
				firstPartyCandidates: [
					opportunityCandidate({ id: "opp-2", query: "SEO Agency", scoreHistory: [snapshot()] }),
					opportunityCandidate({ id: "opp-1", query: "seo  agency", scoreHistory: [snapshot({ opportunityScore: 90 })] }),
				],
			}),
		);
		expect(result.ccsTrend).not.toHaveProperty("trend");
		expect(result.evidenceConfidence.factors.ccsFirstPartyHistory).toEqual({ present: false });
	});

	it("22. unique match exposes the candidate's stored values unchanged", () => {
		const candidate = opportunityCandidate({
			id: "opp-1",
			query: "seo agency",
			totalImpressions: 777,
			totalClicks: 33,
			avgPosition: 6.25,
			googleImpressions: 500,
			bingImpressions: 277,
			opportunityScore: 61.5,
		});
		const result = evaluateMarketOpportunity(input({ firstPartyCandidates: [candidate] }));
		expect(result.ccsVisibility).toEqual({
			status: "matched",
			opportunityId: "opp-1",
			matchedQuery: "seo agency",
			matchKind: "exact",
			totalImpressions: 777,
			totalClicks: 33,
			avgPosition: 6.25,
			googleImpressions: 500,
			bingImpressions: 277,
			opportunityScore: 61.5,
		});
	});

	it("23. exact match preserves matchKind exact", () => {
		const result = evaluateMarketOpportunity(
			input({ firstPartyCandidates: [opportunityCandidate({ id: "opp-1", query: "seo agency" })] }),
		);
		expect(result.ccsVisibility.status).toBe("matched");
		expect((result.ccsVisibility as { matchKind: string }).matchKind).toBe("exact");
	});

	it("24. normalized exact match preserves matchKind normalized_exact", () => {
		const result = evaluateMarketOpportunity(
			input({
				subject: subject({ keyword: "SEO Agency" }),
				firstPartyCandidates: [opportunityCandidate({ id: "opp-1", query: "seo agency" })],
			}),
		);
		expect(result.ccsVisibility.status).toBe("matched");
		expect((result.ccsVisibility as { matchKind: string }).matchKind).toBe("normalized_exact");
	});

	it("25. unique match evaluates the opportunity's trend via evaluateOpportunityTrend", () => {
		const scoreHistory = [snapshot({ computedAt: "2026-04-01T00:00:00.000Z" }), snapshot({ computedAt: "2026-05-01T00:00:00.000Z", opportunityScore: 55 })];
		const candidate = opportunityCandidate({ id: "opp-1", query: "seo agency", scoreHistory });
		const result = evaluateMarketOpportunity(input({ firstPartyCandidates: [candidate] }));
		expect(result.ccsTrend).toEqual({ status: "matched", opportunityId: "opp-1", trend: evaluateOpportunityTrend(scoreHistory) });
	});

	it("26. no match passes null history to evidence confidence", () => {
		const result = evaluateMarketOpportunity(input({ firstPartyCandidates: [] }));
		expect(result.evidenceConfidence.factors.ccsFirstPartyHistory).toEqual({ present: false });
	});

	it("27. ambiguous match passes null history to evidence confidence", () => {
		const result = evaluateMarketOpportunity(
			input({
				subject: subject({ keyword: "Seo Agency" }),
				firstPartyCandidates: [
					opportunityCandidate({ id: "opp-2", query: "SEO Agency" }),
					opportunityCandidate({ id: "opp-1", query: "seo  agency" }),
				],
			}),
		);
		expect(result.evidenceConfidence.factors.ccsFirstPartyHistory).toEqual({ present: false });
	});
});

// ------------------------------------------------------------------
// ASSEMBLED COMPONENTS (28-31)
// ------------------------------------------------------------------

describe("evaluateMarketOpportunity — reused evaluators propagate unchanged", () => {
	it("28. business relevance output propagated unchanged", () => {
		const result = evaluateMarketOpportunity(input({ subject: subject({ keyword: "software development" }) }));
		expect(result.businessRelevance).toEqual(evaluateBusinessRelevance("software development"));
	});

	it("29. content coverage output propagated unchanged", () => {
		const a = article({ locale: "en", title: "SEO Agency Guide" });
		const result = evaluateMarketOpportunity(
			input({ subject: subject({ keyword: "seo agency" }), articleCandidates: [a] }),
		);
		expect(result.contentCoverage).toEqual(evaluateContentCoverage({ keyword: "seo agency", market: GB, articles: [a] }));
	});

	it("30. evidence confidence output propagated unchanged", () => {
		const rows = stableRows();
		const result = evaluateMarketOpportunity(input({ marketObservations: rows }));
		const expectedTrend = evaluateMarketTrend(rows);
		expect(result.evidenceConfidence).toEqual(
			evaluateEvidenceConfidence({ market: expectedTrend, contentMapping: null, ccsHistory: null }),
		);
	});

	it("31. market trend propagated unchanged", () => {
		const rows = stableRows();
		const result = evaluateMarketOpportunity(input({ marketObservations: rows }));
		expect(result.marketDemand.trend).toEqual(evaluateMarketTrend(rows));
	});
});

// ------------------------------------------------------------------
// CLASSIFICATIONS (32-42)
// ------------------------------------------------------------------

describe("evaluateMarketOpportunity — classifications", () => {
	it("32. rising strict -> market_growth", () => {
		const rows = trendingChannelRows("impressions", 100, 140);
		const result = evaluateMarketOpportunity(input({ marketObservations: rows }));
		expect(result.classifications).toContain("market_growth");
	});

	it("33. rising broad -> market_growth", () => {
		const rows = trendingChannelRows("broadImpressions", 50, 80);
		const result = evaluateMarketOpportunity(input({ marketObservations: rows }));
		expect(result.classifications).toContain("market_growth");
	});

	it("34. declining strict -> market_decline (and not market_growth)", () => {
		const rows = trendingChannelRows("impressions", 140, 70);
		const result = evaluateMarketOpportunity(input({ marketObservations: rows }));
		expect(result.classifications).toContain("market_decline");
		expect(result.classifications).not.toContain("market_growth");
	});

	it("35. rising strict + declining broad -> both simultaneously", () => {
		const rows: MarketKeywordObservationRow[] = Array.from({ length: 8 }, (_, i) => {
			const periodStart = addDaysIso("2026-01-05", i * 7);
			return row({
				periodStart,
				impressions: i < 4 ? 100 : 140, // rising
				broadImpressions: i < 4 ? 140 : 70, // declining
				fetchedAt: `${periodStart}T00:00:00.000Z`,
			});
		});
		const result = evaluateMarketOpportunity(input({ marketObservations: rows }));
		expect(result.classifications).toContain("market_growth");
		expect(result.classifications).toContain("market_decline");
	});

	it("36. coverage title_match -> covered_market", () => {
		const a = article({ locale: "en", title: "The Complete SEO Agency Guide" });
		const result = evaluateMarketOpportunity(
			input({ subject: subject({ keyword: "seo agency" }), articleCandidates: [a] }),
		);
		expect(result.contentCoverage.level).toBe("title_match");
		expect(result.classifications).toContain("covered_market");
	});

	it("37. coverage mention does not -> covered_market", () => {
		const a = article({ locale: "en", title: "Untitled", excerpt: "We are a seo agency serving many clients." });
		const result = evaluateMarketOpportunity(
			input({ subject: subject({ keyword: "seo agency" }), articleCandidates: [a] }),
		);
		expect(result.contentCoverage.level).toBe("mention");
		expect(result.classifications).not.toContain("covered_market");
	});

	it("38. relevance none -> not_relevant", () => {
		const result = evaluateMarketOpportunity(input({ subject: subject({ keyword: "banana bread recipe" }) }));
		expect(result.businessRelevance.level).toBe("none");
		expect(result.classifications).toContain("not_relevant");
	});

	it("39. confidence low (fetch unavailable, both channels usable) -> weak_evidence without insufficient_data", () => {
		const observedRows = stableRows();
		const noDataRow: MarketKeywordObservationRow = {
			status: "no_data",
			periodStart: null,
			impressions: null,
			broadImpressions: null,
			fetchedAt: "2026-03-10T00:00:00.000Z", // latest fetch attempt overall
		};
		const result = evaluateMarketOpportunity(input({ marketObservations: [...observedRows, noDataRow] }));
		expect(result.evidenceConfidence.level).toBe("low");
		expect(result.evidenceConfidence.factors.marketChannelsUsable).toBe(2);
		expect(result.classifications).toContain("weak_evidence");
		expect(result.classifications).not.toContain("insufficient_data");
	});

	it("40. zero usable market channels -> insufficient_data", () => {
		const result = evaluateMarketOpportunity(input({ marketObservations: [] }));
		expect(result.evidenceConfidence.factors.marketChannelsUsable).toBe(0);
		expect(result.classifications).toContain("insufficient_data");
	});

	it("41. one usable market channel -> no insufficient_data", () => {
		const rows = trendingChannelRows("impressions", 100, 140); // broadImpressions constant 100 => insufficient_data unless
		// broad also has enough established, flat history; to keep broad
		// genuinely unusable, null it out entirely here.
		const strictOnlyRows = rows.map((r) => ({ ...r, broadImpressions: null }));
		const result = evaluateMarketOpportunity(input({ marketObservations: strictOnlyRows }));
		expect(result.evidenceConfidence.factors.marketChannelsUsable).toBe(1);
		expect(result.classifications).not.toContain("insufficient_data");
	});

	it("42. classification ordering is fixed and deterministic", () => {
		const result = evaluateMarketOpportunity(
			input({
				subject: subject({ keyword: "banana bread recipe" }),
				marketObservations: [],
				articleCandidates: [],
			}),
		);
		expect(result.classifications).toEqual(["not_relevant", "weak_evidence", "insufficient_data"]);
	});
});

// ------------------------------------------------------------------
// DETERMINISM (43-46)
// ------------------------------------------------------------------

describe("evaluateMarketOpportunity — determinism", () => {
	it("43. identical input -> deeply identical result", () => {
		const theInput = input({
			subject: subject({ keyword: "seo agency" }),
			marketObservations: stableRows(),
			firstPartyCandidates: [opportunityCandidate({ id: "opp-1", query: "seo agency" })],
			articleCandidates: [article({ title: "SEO Agency Guide" })],
		});
		const a = evaluateMarketOpportunity(theInput);
		const b = evaluateMarketOpportunity({ ...theInput });
		expect(a).toEqual(b);
	});

	it("44. firstPartyCandidates reordering does not change the assembled result", () => {
		const c1 = opportunityCandidate({ id: "opp-1", query: "unrelated query one" });
		const c2 = opportunityCandidate({ id: "opp-2", query: "seo agency" });
		const first = evaluateMarketOpportunity(input({ firstPartyCandidates: [c1, c2] }));
		const second = evaluateMarketOpportunity(input({ firstPartyCandidates: [c2, c1] }));
		expect(first).toEqual(second);
	});

	it("45. marketObservations input order does not affect latest observation selection", () => {
		const rows = stableRows();
		const shuffled = [...rows].reverse();
		const a = evaluateMarketOpportunity(input({ marketObservations: rows }));
		const b = evaluateMarketOpportunity(input({ marketObservations: shuffled }));
		expect(a.marketDemand).toEqual(b.marketDemand);
	});

	it("46. article input order only affects contentCoverage's own existing match-array ordering, not re-sorted here", () => {
		const a1 = article({ locale: "en", title: "SEO Agency First" });
		const a2 = article({ locale: "en", title: "SEO Agency Second" });
		const forward = evaluateMarketOpportunity(
			input({ subject: subject({ keyword: "seo agency" }), articleCandidates: [a1, a2] }),
		);
		const reversed = evaluateMarketOpportunity(
			input({ subject: subject({ keyword: "seo agency" }), articleCandidates: [a2, a1] }),
		);
		expect(forward.contentCoverage).toEqual(
			evaluateContentCoverage({ keyword: "seo agency", market: GB, articles: [a1, a2] }),
		);
		expect(reversed.contentCoverage).toEqual(
			evaluateContentCoverage({ keyword: "seo agency", market: GB, articles: [a2, a1] }),
		);
	});
});

// ------------------------------------------------------------------
// PROVIDER / MARKET (47-49)
// ------------------------------------------------------------------

describe("evaluateMarketOpportunity — provider and market provenance", () => {
	it("47. subject.provider preserved verbatim", () => {
		const result = evaluateMarketOpportunity(input({ subject: subject({ provider: "bing" }) }));
		expect(result.subject.provider).toBe("bing");
	});

	it("48. subject.market preserved verbatim", () => {
		const result = evaluateMarketOpportunity(input({ subject: subject({ market: PL }) }));
		expect(result.subject.market).toEqual(PL);
	});

	it("49. GB and PL markets remain distinct", () => {
		const gbResult = evaluateMarketOpportunity(input({ subject: subject({ market: GB }) }));
		const plResult = evaluateMarketOpportunity(input({ subject: subject({ market: PL }) }));
		expect(gbResult.subject.market).toEqual(GB);
		expect(plResult.subject.market).toEqual(PL);
		expect(gbResult.subject.market).not.toEqual(plResult.subject.market);
	});
});
