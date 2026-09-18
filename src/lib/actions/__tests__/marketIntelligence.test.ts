import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args) }));

const mockFetchMarketKeywordStats = vi.fn();
vi.mock("@/features/content-intelligence/market/fetchMarketKeywordStats", () => ({
	fetchMarketKeywordStats: (...args: unknown[]) => mockFetchMarketKeywordStats(...args),
}));

const { fetchMarketKeywordStatsAction } = await import("../marketIntelligence");

beforeEach(() => {
	mockRevalidatePath.mockReset();
	mockFetchMarketKeywordStats.mockReset().mockResolvedValue({ ok: true, observedCount: 1, noDataCount: 0 });
});

describe("fetchMarketKeywordStatsAction", () => {
	it("resolves a UK request to { country: 'gb', language: 'en-GB' }", async () => {
		await fetchMarketKeywordStatsAction("edge caching", "gb");

		expect(mockFetchMarketKeywordStats).toHaveBeenCalledWith("edge caching", { country: "gb", language: "en-GB" });
	});

	it("resolves a Poland request to { country: 'pl', language: 'pl-PL' }", async () => {
		await fetchMarketKeywordStatsAction("buforowanie", "pl");

		expect(mockFetchMarketKeywordStats).toHaveBeenCalledWith("buforowanie", { country: "pl", language: "pl-PL" });
	});

	it("trims whitespace around the keyword before calling the fetch function", async () => {
		await fetchMarketKeywordStatsAction("  edge caching  ", "gb");

		expect(mockFetchMarketKeywordStats).toHaveBeenCalledWith("edge caching", { country: "gb", language: "en-GB" });
	});

	it("rejects an empty keyword without calling the provider pipeline", async () => {
		const result = await fetchMarketKeywordStatsAction("   ", "gb");

		expect(result).toEqual({ ok: false, kind: "validation", message: "Enter a keyword." });
		expect(mockFetchMarketKeywordStats).not.toHaveBeenCalled();
		expect(mockRevalidatePath).not.toHaveBeenCalled();
	});

	it("rejects a tampered/unsupported market without calling the provider pipeline", async () => {
		const result = await fetchMarketKeywordStatsAction("edge caching", "us");

		expect(result).toEqual({ ok: false, kind: "validation", message: "Unsupported market." });
		expect(mockFetchMarketKeywordStats).not.toHaveBeenCalled();
	});

	it("never lets a client-supplied language reach the fetch function -- only country is accepted", async () => {
		// fetchMarketKeywordStatsAction's own signature has no language
		// parameter at all, so a mismatched pair can't be constructed --
		// this asserts the resolved market is always the canonical one.
		await fetchMarketKeywordStatsAction("edge caching", "pl");

		const [, market] = mockFetchMarketKeywordStats.mock.calls[0]!;
		expect(market).toEqual({ country: "pl", language: "pl-PL" });
	});

	it("revalidates the market-opportunities page on successful persistence", async () => {
		mockFetchMarketKeywordStats.mockResolvedValue({ ok: true, observedCount: 3, noDataCount: 0 });

		const result = await fetchMarketKeywordStatsAction("edge caching", "gb");

		expect(result).toEqual({ ok: true, observedCount: 3, noDataCount: 0 });
		expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/insights/market-opportunities");
	});

	it("does not revalidate and reports the real failure on a not_configured result", async () => {
		mockFetchMarketKeywordStats.mockResolvedValue({ ok: false, kind: "not_configured", message: "No market intelligence provider is configured." });

		const result = await fetchMarketKeywordStatsAction("edge caching", "gb");

		expect(result).toEqual({ ok: false, kind: "not_configured", message: "No market intelligence provider is configured." });
		expect(mockRevalidatePath).not.toHaveBeenCalled();
	});

	it("does not revalidate and never reports false success on a provider_error", async () => {
		mockFetchMarketKeywordStats.mockResolvedValue({ ok: false, kind: "provider_error", message: "bing market keyword fetch failed: 500" });

		const result = await fetchMarketKeywordStatsAction("edge caching", "gb");

		expect(result.ok).toBe(false);
		expect(mockRevalidatePath).not.toHaveBeenCalled();
	});

	it("does not revalidate and never reports false success on a storage_error", async () => {
		mockFetchMarketKeywordStats.mockResolvedValue({ ok: false, kind: "storage_error", message: "Storing market_keywords row failed: db down" });

		const result = await fetchMarketKeywordStatsAction("edge caching", "gb");

		expect(result.ok).toBe(false);
		expect(mockRevalidatePath).not.toHaveBeenCalled();
	});

	it("does not revalidate on an auth failure from the underlying function", async () => {
		mockFetchMarketKeywordStats.mockResolvedValue({ ok: false, kind: "auth", message: "You must be signed in as an editor to do this." });

		const result = await fetchMarketKeywordStatsAction("edge caching", "gb");

		expect(result.ok).toBe(false);
		expect(mockRevalidatePath).not.toHaveBeenCalled();
	});
});
