import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mocks the three seams `fetchMarketKeywordStats.ts` actually calls
 * (`@/lib/supabase/adminAuth`, `@/lib/supabase/server`, and the Bing
 * provider factory) -- same pattern as
 * `opportunities/__tests__/recompute.test.ts`'s `fakeSupabase()` and
 * `vi.mock` usage. The provider's own HTTP/date-parsing logic is tested
 * separately in `bing/__tests__/BingKeywordStatsProvider.test.ts`; this
 * file is about the orchestration/persistence logic only -- auth
 * gating, not-configured branching, no_data vs. observed vs.
 * provider_error vs. storage_error classification, and the exact rows
 * written to each table.
 *
 * The `mock`-prefix on every vi.mock-closed-over variable is required --
 * Vitest hoists `vi.mock` factories above imports and only allows a
 * factory to reference an outer variable whose name starts with "mock".
 * `vi.mock`'s path is resolved relative to THIS file, not to
 * `fetchMarketKeywordStats.ts` -- hence `../../bing/...` here versus
 * `../bing/...` in the real module.
 */

const mockGetAdminSession = vi.fn();
vi.mock("@/lib/supabase/adminAuth", () => ({
	getAdminSession: () => mockGetAdminSession(),
}));

const mockCreateSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: () => mockCreateSupabaseServerClient(),
}));

const mockIsConfigured = vi.fn();
const mockFetchKeywordStats = vi.fn();
vi.mock("../../bing/BingKeywordStatsProvider", () => ({
	createBingKeywordStatsProvider: () => ({
		id: "bing",
		isConfigured: mockIsConfigured,
		fetchKeywordStats: mockFetchKeywordStats,
	}),
}));

const { fetchMarketKeywordStats } = await import("../fetchMarketKeywordStats");

const EDITOR_SESSION = { userId: "u1", email: "editor@example.com", roles: ["editor"], isAdmin: false, isEditor: true };
const UK = { country: "gb" as const, language: "en-GB" as const };

function fakeSupabase(opts: {
	keywordId?: string;
	keywordUpsertError?: { message: string } | null;
	observedUpsertError?: { message: string } | null;
	noDataInsertError?: { message: string } | null;
}) {
	const keywordId = opts.keywordId ?? "kw-1";
	const keywordUpsertCalls: [Record<string, unknown>, Record<string, unknown>][] = [];
	const observedUpsertCalls: [Record<string, unknown>[], Record<string, unknown>][] = [];
	const noDataInsertCalls: Record<string, unknown>[][] = [];

	function marketKeywordsTable() {
		return {
			upsert: vi.fn((row: Record<string, unknown>, options: Record<string, unknown>) => {
				keywordUpsertCalls.push([row, options]);
				return {
					select: vi.fn(() => ({
						single: vi.fn(() =>
							opts.keywordUpsertError
								? Promise.resolve({ data: null, error: opts.keywordUpsertError })
								: Promise.resolve({ data: { id: keywordId }, error: null }),
						),
					})),
				};
			}),
		};
	}

	function marketKeywordObservationsTable() {
		return {
			upsert: vi.fn((rows: Record<string, unknown>[], options: Record<string, unknown>) => {
				observedUpsertCalls.push([rows, options]);
				return Promise.resolve({ data: null, error: opts.observedUpsertError ?? null });
			}),
			insert: vi.fn((rows: Record<string, unknown>[]) => {
				noDataInsertCalls.push(rows);
				return Promise.resolve({ data: null, error: opts.noDataInsertError ?? null });
			}),
		};
	}

	const from = vi.fn((table: string) => {
		if (table === "market_keywords") return marketKeywordsTable();
		if (table === "market_keyword_observations") return marketKeywordObservationsTable();
		throw new Error(`fakeSupabase: unexpected table "${table}"`);
	});

	return { from, keywordUpsertCalls, observedUpsertCalls, noDataInsertCalls };
}

beforeEach(() => {
	mockGetAdminSession.mockReset().mockResolvedValue(EDITOR_SESSION);
	mockCreateSupabaseServerClient.mockReset();
	mockIsConfigured.mockReset().mockReturnValue(true);
	mockFetchKeywordStats.mockReset();
});

describe("fetchMarketKeywordStats — auth and configuration", () => {
	it("never touches the provider or Supabase for a non-editor session", async () => {
		mockGetAdminSession.mockResolvedValue(null);

		const result = await fetchMarketKeywordStats("web development", UK);

		expect(result).toEqual({ ok: false, kind: "auth", message: expect.any(String) });
		expect(mockIsConfigured).not.toHaveBeenCalled();
		expect(mockFetchKeywordStats).not.toHaveBeenCalled();
	});

	it("returns not_configured when no provider is configured, without calling Supabase", async () => {
		mockIsConfigured.mockReturnValue(false);

		const result = await fetchMarketKeywordStats("web development", UK);

		expect(result).toEqual({ ok: false, kind: "not_configured", message: expect.any(String) });
		expect(mockCreateSupabaseServerClient).not.toHaveBeenCalled();
		expect(mockFetchKeywordStats).not.toHaveBeenCalled();
	});

	it("returns not_configured when Supabase itself isn't configured", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(null);

		const result = await fetchMarketKeywordStats("web development", UK);

		expect(result).toEqual({ ok: false, kind: "not_configured", message: expect.any(String) });
		expect(mockFetchKeywordStats).not.toHaveBeenCalled();
	});
});

describe("fetchMarketKeywordStats — provider_error is never persisted", () => {
	it("returns provider_error and never calls Supabase when the provider throws", async () => {
		mockFetchKeywordStats.mockRejectedValue(new Error("Bing GetKeywordStats failed (500): boom"));
		const supabase = fakeSupabase({});
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await fetchMarketKeywordStats("web development", UK);

		expect(result).toEqual({ ok: false, kind: "provider_error", message: expect.stringContaining("boom") });
		expect(supabase.from).not.toHaveBeenCalled();
	});
});

describe("fetchMarketKeywordStats — persistence", () => {
	it("upserts the market_keywords row and observed rows for a successful multi-week response", async () => {
		mockFetchKeywordStats.mockResolvedValue([
			{ status: "observed", periodStart: "2026-03-15", impressions: 1200, providerDetails: { provider: "bing", broadImpressions: 5400 } },
			{ status: "observed", periodStart: "2026-03-22", impressions: 980, providerDetails: { provider: "bing", broadImpressions: 4700 } },
		]);
		const supabase = fakeSupabase({ keywordId: "kw-42" });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await fetchMarketKeywordStats("web development", UK);

		expect(result).toEqual({ ok: true, observedCount: 2, noDataCount: 0 });
		expect(supabase.keywordUpsertCalls[0]?.[0]).toEqual({ provider: "bing", keyword: "web development", country: "gb", language: "en-GB" });
		expect(supabase.keywordUpsertCalls[0]?.[1]).toEqual({ onConflict: "provider,keyword,country,language" });
		expect(supabase.observedUpsertCalls[0]?.[0]).toEqual([
			{ market_keyword_id: "kw-42", status: "observed", period_start: "2026-03-15", impressions: 1200, broad_impressions: 5400 },
			{ market_keyword_id: "kw-42", status: "observed", period_start: "2026-03-22", impressions: 980, broad_impressions: 4700 },
		]);
		expect(supabase.observedUpsertCalls[0]?.[1]).toEqual({ onConflict: "market_keyword_id,period_start" });
		expect(supabase.noDataInsertCalls).toHaveLength(0);
	});

	it("stores a real zero-impression observation distinctly, not as no_data", async () => {
		mockFetchKeywordStats.mockResolvedValue([{ status: "observed", periodStart: "2026-03-15", impressions: 0, providerDetails: { provider: "bing", broadImpressions: 0 } }]);
		const supabase = fakeSupabase({ keywordId: "kw-1" });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await fetchMarketKeywordStats("niche term", UK);

		expect(result).toEqual({ ok: true, observedCount: 1, noDataCount: 0 });
		expect(supabase.observedUpsertCalls[0]?.[0]).toEqual([
			{ market_keyword_id: "kw-1", status: "observed", period_start: "2026-03-15", impressions: 0, broad_impressions: 0 },
		]);
		expect(supabase.noDataInsertCalls).toHaveLength(0);
	});

	it("appends a no_data row (via insert, not upsert) when the provider reports no data", async () => {
		mockFetchKeywordStats.mockResolvedValue([{ status: "no_data" }]);
		const supabase = fakeSupabase({ keywordId: "kw-1" });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await fetchMarketKeywordStats("Next.js SEO", UK);

		expect(result).toEqual({ ok: true, observedCount: 0, noDataCount: 1 });
		expect(supabase.noDataInsertCalls[0]).toEqual([
			{ market_keyword_id: "kw-1", status: "no_data", period_start: null, impressions: null, broad_impressions: null },
		]);
	});

	it("stores broad_impressions as null when the provider omits providerDetails", async () => {
		mockFetchKeywordStats.mockResolvedValue([{ status: "observed", periodStart: "2026-03-15", impressions: 300 }]);
		const supabase = fakeSupabase({ keywordId: "kw-1" });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		await fetchMarketKeywordStats("some term", UK);

		expect(supabase.observedUpsertCalls[0]?.[0]?.[0]).toMatchObject({ broad_impressions: null });
	});

	it("passes the keyword and market through to the provider unchanged", async () => {
		mockFetchKeywordStats.mockResolvedValue([{ status: "no_data" }]);
		mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase({}));

		await fetchMarketKeywordStats("pozycjonowanie stron", { country: "pl", language: "pl-PL" });

		expect(mockFetchKeywordStats).toHaveBeenCalledWith("pozycjonowanie stron", { country: "pl", language: "pl-PL" });
	});
});

describe("fetchMarketKeywordStats — storage_error is distinct from provider_error", () => {
	it("returns storage_error when the market_keywords upsert fails", async () => {
		mockFetchKeywordStats.mockResolvedValue([{ status: "no_data" }]);
		mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase({ keywordUpsertError: { message: "db down" } }));

		const result = await fetchMarketKeywordStats("web development", UK);

		expect(result).toEqual({ ok: false, kind: "storage_error", message: expect.stringContaining("db down") });
	});

	it("returns storage_error when the observed-row upsert fails", async () => {
		mockFetchKeywordStats.mockResolvedValue([{ status: "observed", periodStart: "2026-03-15", impressions: 100 }]);
		mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase({ observedUpsertError: { message: "constraint violation" } }));

		const result = await fetchMarketKeywordStats("web development", UK);

		expect(result).toEqual({ ok: false, kind: "storage_error", message: expect.stringContaining("constraint violation") });
	});

	it("returns storage_error when the no_data insert fails", async () => {
		mockFetchKeywordStats.mockResolvedValue([{ status: "no_data" }]);
		mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase({ noDataInsertError: { message: "insert rejected" } }));

		const result = await fetchMarketKeywordStats("web development", UK);

		expect(result).toEqual({ ok: false, kind: "storage_error", message: expect.stringContaining("insert rejected") });
	});
});
