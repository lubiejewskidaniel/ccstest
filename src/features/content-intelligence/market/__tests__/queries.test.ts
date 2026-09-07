import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mocks the one seam these functions actually call
 * (`@/lib/supabase/server`) — same `vi.mock`/dynamic-import pattern as
 * `fetchMarketKeywordStats.test.ts` and `recompute.test.ts`.
 */

const mockCreateSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: () => mockCreateSupabaseServerClient(),
}));

const { findMarketKeywordId, listMarketKeywordObservationsById, listMarketKeywordObservations, listTrackedMarketKeywords } = await import("../queries");

const GB = { country: "gb" as const, language: "en-GB" as const };
const PL = { country: "pl" as const, language: "pl-PL" as const };

type Result = { data: unknown; error: { message: string } | null };

function queryResult(data: unknown, error: { message: string } | null = null) {
	const result: Result = { data, error };
	const builder: {
		select: ReturnType<typeof vi.fn>;
		eq: ReturnType<typeof vi.fn>;
		order: ReturnType<typeof vi.fn>;
		maybeSingle: ReturnType<typeof vi.fn>;
		then: (onFulfilled: (value: Result) => unknown, onRejected?: (reason: unknown) => unknown) => unknown;
	} = {
		select: vi.fn(() => builder),
		eq: vi.fn(() => builder),
		order: vi.fn(() => builder),
		maybeSingle: vi.fn(() => Promise.resolve(result)),
		then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
	};
	return builder;
}

/** `keywordResult` stands in for the `market_keywords` table for every
 * caller that hits it — `findMarketKeywordId` (a `.select("id")` +
 * `.eq(...)` + `.maybeSingle()` chain) and `listTrackedMarketKeywords`
 * (a `.select(...)` + `.order(...)` chain) alike; the fake router below
 * only distinguishes by table name, not by which columns/chain a given
 * call used, since no single test exercises both against the same
 * builder. */
function fakeSupabase(opts: { keywordResult?: ReturnType<typeof queryResult>; observationsResult?: ReturnType<typeof queryResult> }) {
	const from = vi.fn((table: string) => {
		if (table === "market_keywords") return opts.keywordResult;
		if (table === "market_keyword_observations") return opts.observationsResult;
		throw new Error(`fakeSupabase: unexpected table "${table}"`);
	});
	return { from };
}

beforeEach(() => {
	mockCreateSupabaseServerClient.mockReset();
});

describe("findMarketKeywordId", () => {
	it("returns found with the row id", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase({ keywordResult: queryResult({ id: "kw-1" }) }));
		const result = await findMarketKeywordId("bing", "seo agency", GB);
		expect(result).toEqual({ status: "found", id: "kw-1" });
	});

	it("returns not_found when no market_keywords row matches the natural key", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase({ keywordResult: queryResult(null) }));
		const result = await findMarketKeywordId("bing", "seo agency", GB);
		expect(result).toEqual({ status: "not_found" });
	});

	it("returns error (never not_found) on a genuine query failure", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(
			fakeSupabase({ keywordResult: queryResult(null, { message: "connection reset" }) }),
		);
		const result = await findMarketKeywordId("bing", "seo agency", GB);
		expect(result).toEqual({ status: "error", message: "connection reset" });
	});

	it("returns error when Supabase isn't configured", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(null);
		const result = await findMarketKeywordId("bing", "seo agency", GB);
		expect(result.status).toBe("error");
	});
});

describe("listMarketKeywordObservationsById", () => {
	it("maps rows and returns them as ok", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(
			fakeSupabase({
				observationsResult: queryResult([
					{ status: "observed", period_start: "2026-01-05", impressions: 10, broad_impressions: 20, fetched_at: "2026-01-05T00:00:00.000Z" },
				]),
			}),
		);
		const result = await listMarketKeywordObservationsById("kw-1");
		expect(result).toEqual({
			status: "ok",
			rows: [{ status: "observed", periodStart: "2026-01-05", impressions: 10, broadImpressions: 20, fetchedAt: "2026-01-05T00:00:00.000Z" }],
		});
	});

	it("returns ok with an empty array for zero observations", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase({ observationsResult: queryResult([]) }));
		const result = await listMarketKeywordObservationsById("kw-1");
		expect(result).toEqual({ status: "ok", rows: [] });
	});

	it("surfaces a genuine query error distinctly from empty results", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase({ observationsResult: queryResult(null, { message: "timeout" }) }));
		const result = await listMarketKeywordObservationsById("kw-1");
		expect(result).toEqual({ status: "error", message: "timeout" });
	});
});

describe("listMarketKeywordObservations — Phase 3B.1 backward-compatible wrapper", () => {
	it("returns mapped rows for a found keyword", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(
			fakeSupabase({
				keywordResult: queryResult({ id: "kw-1" }),
				observationsResult: queryResult([
					{ status: "observed", period_start: "2026-01-05", impressions: 10, broad_impressions: null, fetched_at: "2026-01-05T00:00:00.000Z" },
				]),
			}),
		);
		const rows = await listMarketKeywordObservations("bing", "seo agency", GB);
		expect(rows).toEqual([{ status: "observed", periodStart: "2026-01-05", impressions: 10, broadImpressions: null, fetchedAt: "2026-01-05T00:00:00.000Z" }]);
	});

	it("returns [] when the keyword is not found (unchanged Phase 3B.1 contract)", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase({ keywordResult: queryResult(null) }));
		const rows = await listMarketKeywordObservations("bing", "seo agency", GB);
		expect(rows).toEqual([]);
	});

	it("returns [] (never throws) when the lookup itself errors", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase({ keywordResult: queryResult(null, { message: "boom" }) }));
		const rows = await listMarketKeywordObservations("bing", "seo agency", GB);
		expect(rows).toEqual([]);
	});

	it("returns [] when Supabase isn't configured (unchanged Phase 3B.1 contract)", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(null);
		const rows = await listMarketKeywordObservations("bing", "seo agency", GB);
		expect(rows).toEqual([]);
	});

	it("returns [] (never throws) when the observations query errors", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(
			fakeSupabase({ keywordResult: queryResult({ id: "kw-1" }), observationsResult: queryResult(null, { message: "boom" }) }),
		);
		const rows = await listMarketKeywordObservations("bing", "seo agency", GB);
		expect(rows).toEqual([]);
	});
});

describe("listTrackedMarketKeywords", () => {
	it("returns ok with an empty array when nothing is tracked", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase({ keywordResult: queryResult([]) }));
		const result = await listTrackedMarketKeywords();
		expect(result).toEqual({ status: "ok", rows: [] });
	});

	it("maps a single row into a TrackedMarketKeyword", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(
			fakeSupabase({
				keywordResult: queryResult([{ id: "kw-1", provider: "bing", keyword: "seo agency", country: "gb", language: "en-GB" }]),
			}),
		);
		const result = await listTrackedMarketKeywords();
		expect(result).toEqual({
			status: "ok",
			rows: [{ id: "kw-1", provider: "bing", keyword: "seo agency", market: GB }],
		});
	});

	it("keeps GB and PL rows distinct — never conflated into one market", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(
			fakeSupabase({
				keywordResult: queryResult([
					{ id: "kw-1", provider: "bing", keyword: "seo agency", country: "gb", language: "en-GB" },
					{ id: "kw-2", provider: "bing", keyword: "seo agency", country: "pl", language: "pl-PL" },
				]),
			}),
		);
		const result = await listTrackedMarketKeywords();
		expect(result).toEqual({
			status: "ok",
			rows: [
				{ id: "kw-1", provider: "bing", keyword: "seo agency", market: GB },
				{ id: "kw-2", provider: "bing", keyword: "seo agency", market: PL },
			],
		});
	});

	it("preserves the row's own provider verbatim", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(
			fakeSupabase({
				keywordResult: queryResult([{ id: "kw-1", provider: "bing", keyword: "seo agency", country: "gb", language: "en-GB" }]),
			}),
		);
		const result = await listTrackedMarketKeywords();
		expect(result.status === "ok" && result.rows[0]?.provider).toBe("bing");
	});

	it("orders deterministically by keyword asc, country asc, id asc", async () => {
		const keywordBuilder = queryResult([]);
		mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase({ keywordResult: keywordBuilder }));
		await listTrackedMarketKeywords();
		expect((keywordBuilder.order as ReturnType<typeof vi.fn>).mock.calls).toEqual([
			["keyword", { ascending: true }],
			["country", { ascending: true }],
			["id", { ascending: true }],
		]);
	});

	it("returns error when Supabase isn't configured", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(null);
		const result = await listTrackedMarketKeywords();
		expect(result.status).toBe("error");
	});

	it("surfaces a genuine query error distinctly from an empty list", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase({ keywordResult: queryResult(null, { message: "connection reset" }) }));
		const result = await listTrackedMarketKeywords();
		expect(result).toEqual({ status: "error", message: "connection reset" });
	});

	it("skips a row whose country/language don't form one of MarketCode's two valid pairs, without erroring or fabricating a market", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(
			fakeSupabase({
				keywordResult: queryResult([
					{ id: "kw-1", provider: "bing", keyword: "seo agency", country: "gb", language: "en-GB" },
					// Malformed: no MarketCode member has this pair — must never be
					// fabricated into a MarketCode, and must not fail the whole list.
					{ id: "kw-2", provider: "bing", keyword: "web development", country: "us", language: "en-US" },
				]),
			}),
		);
		const result = await listTrackedMarketKeywords();
		expect(result).toEqual({
			status: "ok",
			rows: [{ id: "kw-1", provider: "bing", keyword: "seo agency", market: GB }],
		});
	});
});
