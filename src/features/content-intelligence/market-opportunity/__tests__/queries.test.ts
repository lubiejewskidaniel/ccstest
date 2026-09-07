import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { EvaluateMarketOpportunityInput } from "../marketOpportunity";
import type { MarketOpportunityEvidence } from "../types";

/**
 * Mocking boundary for this file:
 *  - `@/lib/supabase/adminAuth` and `@/lib/supabase/server` are mocked —
 *    the same pattern as `recompute.test.ts` / `market/__tests__/queries.test.ts`.
 *  - `../marketOpportunity` is given a PARTIAL mock: every export is the
 *    real, unmodified implementation (via `importOriginal`) except
 *    `evaluateMarketOpportunity`, which is wrapped in a `vi.fn` that still
 *    calls straight through to the real function. This lets tests assert
 *    "called exactly once" / "with this exact input" / "output returned
 *    unchanged" without stubbing the actual evidence algorithm — the real
 *    algorithm still runs on every call. `matchFirstPartyQuery` and every
 *    evaluator underneath (`evaluateMarketTrend`, `evaluateBusinessRelevance`,
 *    `evaluateContentCoverage`, `evaluateEvidenceConfidence`,
 *    `evaluateOpportunityTrend`) are never mocked.
 *  - `../market/queries` (`findMarketKeywordId` / `listMarketKeywordObservationsById`)
 *    is imported for real — it shares the same mocked
 *    `createSupabaseServerClient()`, so its own Phase 3B.1/3C.1E behavior is
 *    exercised here, not re-implemented.
 *
 * The vitest config for this repo sets `restoreMocks: true` (every mock is
 * restored before each test), which would also strip the `evaluateMarketOpportunity`
 * pass-through implementation installed once at module-import time inside
 * the `vi.mock` factory below. `mockRealEvaluateMarketOpportunity` captures
 * that real implementation so `beforeEach` can re-arm it every test,
 * regardless of `restoreMocks` timing.
 *
 * Only I/O boundaries are mocked; the pure evidence algorithms are not.
 */

const mockGetAdminSession = vi.fn();
vi.mock("@/lib/supabase/adminAuth", () => ({
	getAdminSession: () => mockGetAdminSession(),
}));

const mockCreateSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: () => mockCreateSupabaseServerClient(),
}));

const mockEvaluateMarketOpportunity = vi.fn();
let mockRealEvaluateMarketOpportunity: ((input: EvaluateMarketOpportunityInput) => MarketOpportunityEvidence) | undefined;
vi.mock("../marketOpportunity", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../marketOpportunity")>();
	mockRealEvaluateMarketOpportunity = actual.evaluateMarketOpportunity;
	return {
		...actual,
		evaluateMarketOpportunity: (...args: Parameters<typeof actual.evaluateMarketOpportunity>) => mockEvaluateMarketOpportunity(...args),
	};
});

const { getMarketOpportunityEvidence } = await import("../queries");

const EDITOR_SESSION = { userId: "u1", email: "editor@example.com", roles: ["editor"], isAdmin: false, isEditor: true };

const GB = { country: "gb" as const, language: "en-GB" as const };
const PL = { country: "pl" as const, language: "pl-PL" as const };

function subject(overrides: Partial<{ keyword: string; provider: "bing"; market: typeof GB | typeof PL }> = {}) {
	return { keyword: "seo agency", provider: "bing" as const, market: GB, ...overrides };
}

type Result = { data: unknown; error: { message: string } | null };

/** Minimal thenable query-builder stub: every chain method returns the
 * same object and records its own calls; `maybeSingle`/`then` both
 * resolve to the same fixed result — enough for every chain shape
 * `queries.ts` and `market/queries.ts` actually use. */
function queryResult(data: unknown, error: { message: string } | null = null) {
	const result: Result = { data, error };
	const builder: Record<string, unknown> = {};
	builder.select = vi.fn(() => builder);
	builder.eq = vi.fn(() => builder);
	builder.order = vi.fn(() => builder);
	builder.maybeSingle = vi.fn(() => Promise.resolve(result));
	builder.then = (onFulfilled: (value: Result) => unknown, onRejected?: (reason: unknown) => unknown) =>
		Promise.resolve(result).then(onFulfilled, onRejected);
	return builder;
}

type TableOpts = {
	keyword?: ReturnType<typeof queryResult>;
	observations?: ReturnType<typeof queryResult>;
	opportunities?: ReturnType<typeof queryResult>;
	history?: ReturnType<typeof queryResult>;
	articles?: ReturnType<typeof queryResult>;
};

function fakeSupabase(opts: TableOpts) {
	const from = vi.fn((table: string) => {
		if (table === "market_keywords") return opts.keyword;
		if (table === "market_keyword_observations") return opts.observations;
		if (table === "content_opportunities") return opts.opportunities;
		if (table === "opportunity_score_history") return opts.history;
		if (table === "insights_articles") return opts.articles;
		throw new Error(`fakeSupabase: unexpected table "${table}"`);
	});
	return { from };
}

/** A fully well-formed, empty-but-valid Supabase double: keyword found,
 * zero observations, zero opportunity candidates, zero history, zero
 * articles. Individual tests override just the table(s) they care about. */
function wellFormed(overrides: TableOpts = {}) {
	return fakeSupabase({
		keyword: queryResult({ id: "kw-1" }),
		observations: queryResult([]),
		opportunities: queryResult([]),
		history: queryResult([]),
		articles: queryResult([]),
		...overrides,
	});
}

function tablesQueried(supa: ReturnType<typeof fakeSupabase>): string[] {
	return supa.from.mock.calls.map((call) => call[0] as string);
}

beforeEach(() => {
	mockGetAdminSession.mockReset().mockResolvedValue(EDITOR_SESSION);
	mockCreateSupabaseServerClient.mockReset();
	mockEvaluateMarketOpportunity.mockReset();
	if (mockRealEvaluateMarketOpportunity) {
		mockEvaluateMarketOpportunity.mockImplementation(mockRealEvaluateMarketOpportunity);
	}
});

describe("getMarketOpportunityEvidence — auth and configuration", () => {
	it("returns not_configured, and never calls getAdminSession, when Supabase isn't configured", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(null);

		const result = await getMarketOpportunityEvidence(subject());

		expect(result).toEqual({ ok: false, kind: "not_configured", message: expect.any(String) });
		expect(mockGetAdminSession).not.toHaveBeenCalled();
		expect(mockEvaluateMarketOpportunity).not.toHaveBeenCalled();
	});

	it("returns auth, and performs no DB work, for a non-editor (null) session", async () => {
		const supa = wellFormed();
		mockCreateSupabaseServerClient.mockResolvedValue(supa);
		mockGetAdminSession.mockResolvedValue(null);

		const result = await getMarketOpportunityEvidence(subject());

		expect(result).toEqual({ ok: false, kind: "auth", message: expect.any(String) });
		expect(supa.from).not.toHaveBeenCalled();
		expect(mockEvaluateMarketOpportunity).not.toHaveBeenCalled();
	});

	it("returns auth for a session that exists but has isEditor: false", async () => {
		const supa = wellFormed();
		mockCreateSupabaseServerClient.mockResolvedValue(supa);
		mockGetAdminSession.mockResolvedValue({ userId: "u2", email: null, roles: [], isAdmin: false, isEditor: false });

		const result = await getMarketOpportunityEvidence(subject());

		expect(result).toEqual({ ok: false, kind: "auth", message: expect.any(String) });
		expect(supa.from).not.toHaveBeenCalled();
	});
});

describe("getMarketOpportunityEvidence — market keyword lookup", () => {
	it("returns market_keyword_not_found, and never queries opportunities/articles, when the keyword has never been tracked", async () => {
		const supa = wellFormed({ keyword: queryResult(null) });
		mockCreateSupabaseServerClient.mockResolvedValue(supa);

		const result = await getMarketOpportunityEvidence(subject());

		expect(result).toEqual({ ok: false, kind: "market_keyword_not_found", message: expect.any(String) });
		expect(tablesQueried(supa)).toEqual(["market_keywords"]);
		expect(mockEvaluateMarketOpportunity).not.toHaveBeenCalled();
	});

	it("returns storage_error (never not_found) when the keyword lookup itself fails", async () => {
		const supa = wellFormed({ keyword: queryResult(null, { message: "connection reset" }) });
		mockCreateSupabaseServerClient.mockResolvedValue(supa);

		const result = await getMarketOpportunityEvidence(subject());

		expect(result).toEqual({ ok: false, kind: "storage_error", message: "connection reset" });
		expect(tablesQueried(supa)).toEqual(["market_keywords"]);
	});
});

describe("getMarketOpportunityEvidence — market observations", () => {
	it("succeeds with an empty observations array when the keyword is tracked but has zero observations", async () => {
		const supa = wellFormed();
		mockCreateSupabaseServerClient.mockResolvedValue(supa);

		const result = await getMarketOpportunityEvidence(subject());

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.evidence.marketDemand.trend.strict.direction).toBe("insufficient_data");
		}
		expect(mockEvaluateMarketOpportunity).toHaveBeenCalledTimes(1);
		expect(mockEvaluateMarketOpportunity.mock.calls[0]![0].marketObservations).toEqual([]);
	});

	it("maps observation rows and passes them through to the evaluator unchanged", async () => {
		const rawObservation = { status: "observed", period_start: "2026-01-05", impressions: 500, broad_impressions: 900, fetched_at: "2026-01-05T00:00:00.000Z" };
		const supa = wellFormed({ observations: queryResult([rawObservation]) });
		mockCreateSupabaseServerClient.mockResolvedValue(supa);

		await getMarketOpportunityEvidence(subject());

		expect(mockEvaluateMarketOpportunity.mock.calls[0]![0].marketObservations).toEqual([
			{ status: "observed", periodStart: "2026-01-05", impressions: 500, broadImpressions: 900, fetchedAt: "2026-01-05T00:00:00.000Z" },
		]);
	});

	it("returns storage_error, distinct from empty results, when the observations query fails", async () => {
		const supa = wellFormed({ observations: queryResult(null, { message: "timeout" }) });
		mockCreateSupabaseServerClient.mockResolvedValue(supa);

		const result = await getMarketOpportunityEvidence(subject());

		expect(result).toEqual({ ok: false, kind: "storage_error", message: "timeout" });
		expect(tablesQueried(supa)).toEqual(["market_keywords", "market_keyword_observations"]);
		expect(mockEvaluateMarketOpportunity).not.toHaveBeenCalled();
	});
});

describe("getMarketOpportunityEvidence — first-party candidates and matching", () => {
	it("succeeds with a 'none' match and zero history queries for zero opportunity candidates", async () => {
		const supa = wellFormed();
		mockCreateSupabaseServerClient.mockResolvedValue(supa);

		const result = await getMarketOpportunityEvidence(subject());

		expect(result.ok).toBe(true);
		if (result.ok) expect(result.evidence.firstPartyMatch).toEqual({ kind: "none" });
		expect(tablesQueried(supa)).not.toContain("opportunity_score_history");
	});

	it("returns storage_error when the opportunity candidates query fails", async () => {
		const supa = wellFormed({ opportunities: queryResult(null, { message: "boom" }) });
		mockCreateSupabaseServerClient.mockResolvedValue(supa);

		const result = await getMarketOpportunityEvidence(subject());

		expect(result).toEqual({ ok: false, kind: "storage_error", message: "boom" });
		expect(mockEvaluateMarketOpportunity).not.toHaveBeenCalled();
	});

	function candidateRow(overrides: Partial<{ id: string; query: string }> = {}) {
		return {
			id: "opp-1",
			query: "seo agency",
			total_impressions: 100,
			total_clicks: 5,
			avg_position: 8,
			google_impressions: 60,
			bing_impressions: 40,
			opportunity_score: 42,
			...overrides,
		};
	}

	it("matches exact (raw equality) and fetches history exactly once for that one candidate", async () => {
		const supa = wellFormed({
			opportunities: queryResult([candidateRow({ id: "opp-1", query: "seo agency" })]),
			history: queryResult([]),
		});
		mockCreateSupabaseServerClient.mockResolvedValue(supa);

		const result = await getMarketOpportunityEvidence(subject({ keyword: "seo agency" }));

		expect(result.ok).toBe(true);
		if (result.ok) expect(result.evidence.firstPartyMatch).toEqual({ kind: "exact", opportunityId: "opp-1", matchedQuery: "seo agency" });
		expect(tablesQueried(supa).filter((t) => t === "opportunity_score_history")).toHaveLength(1);
	});

	it("matches normalized_exact (case/punctuation differ) and fetches history for that candidate", async () => {
		const supa = wellFormed({
			opportunities: queryResult([candidateRow({ id: "opp-2", query: "SEO Agency!" })]),
			history: queryResult([]),
		});
		mockCreateSupabaseServerClient.mockResolvedValue(supa);

		const result = await getMarketOpportunityEvidence(subject({ keyword: "seo agency" }));

		expect(result.ok).toBe(true);
		if (result.ok) expect(result.evidence.firstPartyMatch).toEqual({ kind: "normalized_exact", opportunityId: "opp-2", matchedQuery: "SEO Agency!" });
		expect(tablesQueried(supa).filter((t) => t === "opportunity_score_history")).toHaveLength(1);
	});

	it("matches ambiguous for two distinct candidates normalizing to the same keyword, and fetches zero history", async () => {
		const supa = wellFormed({
			opportunities: queryResult([
				candidateRow({ id: "opp-b", query: "SEO Agency" }),
				candidateRow({ id: "opp-a", query: "seo, agency" }),
			]),
		});
		mockCreateSupabaseServerClient.mockResolvedValue(supa);

		const result = await getMarketOpportunityEvidence(subject({ keyword: "seo agency" }));

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.evidence.firstPartyMatch).toEqual({ kind: "ambiguous", candidateOpportunityIds: ["opp-a", "opp-b"] });
		}
		expect(tablesQueried(supa)).not.toContain("opportunity_score_history");
	});

	it("maps opportunity_score_history rows into TrendSnapshot and attaches them only to the matched candidate", async () => {
		const rawHistory = { opportunity_score: 55, total_impressions: 200, total_clicks: 10, avg_position: 6.5, computed_at: "2026-02-01T00:00:00.000Z" };
		const supa = wellFormed({
			opportunities: queryResult([candidateRow({ id: "opp-1", query: "seo agency" })]),
			history: queryResult([rawHistory]),
		});
		mockCreateSupabaseServerClient.mockResolvedValue(supa);

		await getMarketOpportunityEvidence(subject({ keyword: "seo agency" }));

		const passedCandidates = mockEvaluateMarketOpportunity.mock.calls[0]![0].firstPartyCandidates;
		expect(passedCandidates).toHaveLength(1);
		expect(passedCandidates[0].scoreHistory).toEqual([
			{ opportunityScore: 55, totalImpressions: 200, totalClicks: 10, avgPosition: 6.5, computedAt: "2026-02-01T00:00:00.000Z" },
		]);
	});

	it("returns storage_error when the history query fails for a unique match", async () => {
		const supa = wellFormed({
			opportunities: queryResult([candidateRow({ id: "opp-1", query: "seo agency" })]),
			history: queryResult(null, { message: "history unavailable" }),
		});
		mockCreateSupabaseServerClient.mockResolvedValue(supa);

		const result = await getMarketOpportunityEvidence(subject({ keyword: "seo agency" }));

		expect(result).toEqual({ ok: false, kind: "storage_error", message: "history unavailable" });
		expect(mockEvaluateMarketOpportunity).not.toHaveBeenCalled();
	});
});

describe("getMarketOpportunityEvidence — article candidates", () => {
	it("maps article rows into ArticleCandidateForCoverage and passes them through unchanged", async () => {
		const rawArticle = { id: "art-1", locale: "en", slug: "seo-agency-guide", title: "SEO Agency Guide", excerpt: "...", status: "published" };
		const supa = wellFormed({ articles: queryResult([rawArticle]) });
		mockCreateSupabaseServerClient.mockResolvedValue(supa);

		await getMarketOpportunityEvidence(subject());

		expect(mockEvaluateMarketOpportunity.mock.calls[0]![0].articleCandidates).toEqual([
			{ id: "art-1", locale: "en", slug: "seo-agency-guide", title: "SEO Agency Guide", excerpt: "...", status: "published" },
		]);
	});

	it("orders articles deterministically by published_at desc, then id asc", async () => {
		const articlesBuilder = queryResult([]);
		const supa = wellFormed({ articles: articlesBuilder });
		mockCreateSupabaseServerClient.mockResolvedValue(supa);

		await getMarketOpportunityEvidence(subject());

		const orderCalls = (articlesBuilder.order as ReturnType<typeof vi.fn>).mock.calls;
		expect(orderCalls).toEqual([
			["published_at", { ascending: false }],
			["id", { ascending: true }],
		]);
		expect((articlesBuilder.eq as ReturnType<typeof vi.fn>).mock.calls).toEqual([["status", "published"]]);
	});

	it("returns storage_error when the article query fails", async () => {
		const supa = wellFormed({ articles: queryResult(null, { message: "articles unavailable" }) });
		mockCreateSupabaseServerClient.mockResolvedValue(supa);

		const result = await getMarketOpportunityEvidence(subject());

		expect(result).toEqual({ ok: false, kind: "storage_error", message: "articles unavailable" });
		expect(mockEvaluateMarketOpportunity).not.toHaveBeenCalled();
	});
});

describe("getMarketOpportunityEvidence — market/provider identity", () => {
	it("looks up the keyword using the subject's own market (GB) unchanged", async () => {
		const keywordBuilder = queryResult({ id: "kw-1" });
		const supa = wellFormed({ keyword: keywordBuilder });
		mockCreateSupabaseServerClient.mockResolvedValue(supa);

		await getMarketOpportunityEvidence(subject({ market: GB }));

		expect((keywordBuilder.eq as ReturnType<typeof vi.fn>).mock.calls).toEqual([
			["provider", "bing"],
			["keyword", "seo agency"],
			["country", "gb"],
			["language", "en-GB"],
		]);
	});

	it("looks up the keyword using the subject's own market (PL) unchanged — PL and GB never conflated", async () => {
		const keywordBuilder = queryResult({ id: "kw-2" });
		const supa = wellFormed({ keyword: keywordBuilder });
		mockCreateSupabaseServerClient.mockResolvedValue(supa);

		await getMarketOpportunityEvidence(subject({ market: PL }));

		expect((keywordBuilder.eq as ReturnType<typeof vi.fn>).mock.calls).toEqual([
			["provider", "bing"],
			["keyword", "seo agency"],
			["country", "pl"],
			["language", "pl-PL"],
		]);
	});
});

describe("getMarketOpportunityEvidence — evaluator call graph", () => {
	it("calls evaluateMarketOpportunity exactly once with the exact assembled input, and returns its output unchanged", async () => {
		const supa = wellFormed();
		mockCreateSupabaseServerClient.mockResolvedValue(supa);
		const testSubject = subject();

		const result = await getMarketOpportunityEvidence(testSubject);

		expect(mockEvaluateMarketOpportunity).toHaveBeenCalledTimes(1);
		expect(mockEvaluateMarketOpportunity.mock.calls[0]![0]).toEqual({
			subject: testSubject,
			marketObservations: [],
			firstPartyCandidates: [],
			articleCandidates: [],
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			// Same object reference the (real, unmodified) evaluator produced —
			// not a re-derived or partially-rebuilt copy.
			expect(result.evidence).toBe(mockEvaluateMarketOpportunity.mock.results[0]!.value);
		}
	});
});

describe("getMarketOpportunityEvidence — no service-role bypass", () => {
	it("never imports the privileged/service-role Supabase client (only the module doc comment may name it, as a warning)", () => {
		// Resolved from process.cwd() (the repo root Vitest is invoked from),
		// not import.meta.url — a file:// URL built from import.meta.url is
		// not guaranteed to satisfy Node's `readFileSync` on every platform
		// (observed to throw "The URL must be of scheme file" on Windows),
		// so this stays a plain, cross-platform path instead.
		const sourcePath = resolve(process.cwd(), "src/features/content-intelligence/market-opportunity/queries.ts");
		const source = readFileSync(sourcePath, "utf8");
		const importLines = source.split("\n").filter((line) => line.trimStart().startsWith("import"));

		expect(importLines.some((line) => line.includes("createSupabasePrivilegedClient"))).toBe(false);
		expect(importLines.some((line) => line.includes("createSupabaseServerClient"))).toBe(true);
	});
});
