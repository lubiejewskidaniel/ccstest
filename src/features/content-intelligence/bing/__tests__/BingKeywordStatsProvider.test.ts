import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createBingKeywordStatsProvider } from "../BingKeywordStatsProvider";

/**
 * Exercises the real Bing GetKeywordStats adapter end to end against a
 * mocked global `fetch` -- the same pattern
 * `src/features/insights/cms/__tests__/service.indexnow.test.ts` uses for
 * its own outbound-fetch integration (`vi.spyOn(globalThis, "fetch")`).
 * No live Bing calls are made; the business logic under test (URL
 * construction, no_data vs. zero-impression vs. provider-failure
 * classification, strict date parsing) is never mocked away.
 */

const ORIGINAL_ENV = { ...process.env };
const UK = { country: "gb" as const, language: "en-GB" as const };
const PL = { country: "pl" as const, language: "pl-PL" as const };

beforeEach(() => {
	process.env = { ...ORIGINAL_ENV, BING_WEBMASTER_API_KEY: "test-bing-key-0123456789" };
});

afterEach(() => {
	process.env = { ...ORIGINAL_ENV };
	vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), { status });
}

describe("createBingKeywordStatsProvider — configuration", () => {
	it("is not configured when BING_WEBMASTER_API_KEY is unset", () => {
		delete process.env.BING_WEBMASTER_API_KEY;
		const provider = createBingKeywordStatsProvider();
		expect(provider.isConfigured()).toBe(false);
	});

	it("never calls fetch when not configured", async () => {
		delete process.env.BING_WEBMASTER_API_KEY;
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const provider = createBingKeywordStatsProvider();

		const result = await provider.fetchKeywordStats("web development", UK);

		expect(result).toEqual([]);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("is configured when BING_WEBMASTER_API_KEY is set", () => {
		const provider = createBingKeywordStatsProvider();
		expect(provider.isConfigured()).toBe(true);
	});
});

describe("createBingKeywordStatsProvider — successful responses", () => {
	it("maps multiple weekly rows, preserving Impressions and BroadImpressions distinctly", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			jsonResponse({
				d: [
					{ __type: "KeywordStats:#Microsoft.Bing.Webmaster.Api", Query: "web development", Impressions: 1200, BroadImpressions: 5400, Date: "/Date(1773471600000)/" },
					{ __type: "KeywordStats:#Microsoft.Bing.Webmaster.Api", Query: "web development", Impressions: 980, BroadImpressions: 4700, Date: "/Date(1774076400000)/" },
				],
			}),
		);
		const provider = createBingKeywordStatsProvider();

		const result = await provider.fetchKeywordStats("web development", UK);

		expect(result).toEqual([
			{ status: "observed", periodStart: "2026-03-14", impressions: 1200, providerDetails: { provider: "bing", broadImpressions: 5400 } },
			{ status: "observed", periodStart: "2026-03-21", impressions: 980, providerDetails: { provider: "bing", broadImpressions: 4700 } },
		]);
	});

	it("treats an explicit zero-Impressions row as a real observation, not no_data", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			jsonResponse({ d: [{ Query: "niche term", Impressions: 0, BroadImpressions: 0, Date: "/Date(1773471600000)/" }] }),
		);
		const provider = createBingKeywordStatsProvider();

		const result = await provider.fetchKeywordStats("niche term", UK);

		expect(result).toEqual([{ status: "observed", periodStart: "2026-03-14", impressions: 0, providerDetails: { provider: "bing", broadImpressions: 0 } }]);
	});

	it("sends the UK market's country/language params, apikey, keyword, and no siteUrl", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ d: [] }));
		const provider = createBingKeywordStatsProvider();

		await provider.fetchKeywordStats("SEO for small business", UK);

		const requestUrl = new URL(String(fetchSpy.mock.calls[0]?.[0]));
		expect(requestUrl.origin + requestUrl.pathname).toBe("https://ssl.bing.com/webmaster/api.svc/json/GetKeywordStats");
		expect(requestUrl.searchParams.get("apikey")).toBe("test-bing-key-0123456789");
		expect(requestUrl.searchParams.get("q")).toBe("SEO for small business");
		expect(requestUrl.searchParams.get("country")).toBe("gb");
		expect(requestUrl.searchParams.get("language")).toBe("en-GB");
		expect(requestUrl.searchParams.has("siteUrl")).toBe(false);
	});

	it("sends the Poland market's country/language params", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ d: [] }));
		const provider = createBingKeywordStatsProvider();

		await provider.fetchKeywordStats("tworzenie stron internetowych", PL);

		const requestUrl = new URL(String(fetchSpy.mock.calls[0]?.[0]));
		expect(requestUrl.searchParams.get("country")).toBe("pl");
		expect(requestUrl.searchParams.get("language")).toBe("pl-PL");
	});
});

describe("createBingKeywordStatsProvider — no_data vs. provider_error", () => {
	it("returns a single no_data observation for an empty {\"d\":[]} response", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ d: [] }));
		const provider = createBingKeywordStatsProvider();

		const result = await provider.fetchKeywordStats("Next.js SEO", UK);

		expect(result).toEqual([{ status: "no_data" }]);
	});

	it("throws (never returns no_data) on a non-2xx response", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("server error", { status: 500 }));
		const provider = createBingKeywordStatsProvider();

		await expect(provider.fetchKeywordStats("web development", UK)).rejects.toThrow(/GetKeywordStats failed \(500\)/);
	});

	it("never leaks the API key in a thrown error message", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("unauthorized", { status: 401 }));
		const provider = createBingKeywordStatsProvider();

		let thrown: unknown;
		try {
			await provider.fetchKeywordStats("web development", UK);
		} catch (err) {
			thrown = err;
		}

		expect(thrown).toBeInstanceOf(Error);
		expect((thrown as Error).message).not.toContain("test-bing-key-0123456789");
	});

	it("throws on an unparseable Date field and persists nothing partial", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			jsonResponse({
				d: [
					{ Query: "web development", Impressions: 500, BroadImpressions: 900, Date: "/Date(1773471600000)/" },
					{ Query: "web development", Impressions: 400, BroadImpressions: 700, Date: "not-a-bing-date" },
				],
			}),
		);
		const provider = createBingKeywordStatsProvider();

		await expect(provider.fetchKeywordStats("web development", UK)).rejects.toThrow(/unrecognised date format/);
	});
});
