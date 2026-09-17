import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetArticlePerformance = vi.fn();
vi.mock("../../monitoring/performanceAnalysis", () => ({
	getArticlePerformance: (...args: unknown[]) => mockGetArticlePerformance(...args),
}));

const mockCreateSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: () => mockCreateSupabaseServerClient(),
}));

const { computeRefreshSignals, listRefreshCandidates, getRefreshSignalsForArticle } = await import("../staleness");

function article(overrides: Record<string, unknown> = {}) {
	return {
		articleId: "11111111-1111-4111-8111-111111111111",
		locale: "en" as const,
		slug: "edge-caching",
		title: "Edge caching",
		publishedAt: "2025-01-01T00:00:00.000Z",
		updatedAt: "2025-01-01T00:00:00.000Z",
		views: 0,
		ctaClicks: 0,
		searchImpressions: 0,
		searchClicks: 0,
		avgPosition: null,
		...overrides,
	};
}

function fakeTrendSupabase(rows: { page_url: string; metric_date: string; avg_position: number }[] = []) {
	const not = vi.fn(async () => ({ data: rows }));
	const gte = vi.fn(() => ({ not }));
	const select = vi.fn(() => ({ gte }));
	const from = vi.fn((table: string) => {
		if (table === "search_performance_metrics") return { select };
		throw new Error(`unexpected table "${table}"`);
	});
	return { from };
}

beforeEach(() => {
	mockGetArticlePerformance.mockReset();
	mockCreateSupabaseServerClient.mockReset().mockResolvedValue(fakeTrendSupabase());
});

describe("computeRefreshSignals", () => {
	const now = new Date("2026-01-01T00:00:00.000Z").getTime();

	it("flags age past the stale threshold", () => {
		const oldArticle = article({ publishedAt: "2025-01-01T00:00:00.000Z" }); // 365 days before `now`
		const { reasons, refreshScore, ageDays } = computeRefreshSignals(oldArticle, undefined, 180, now);

		expect(ageDays).toBe(365);
		expect(reasons.some((r) => r.includes("Not updated in 365 days"))).toBe(true);
		expect(refreshScore).toBeGreaterThan(0);
	});

	it("does not flag age when under the threshold", () => {
		const freshArticle = article({ publishedAt: "2025-12-01T00:00:00.000Z" }); // 31 days before `now`
		const { reasons } = computeRefreshSignals(freshArticle, undefined, 180, now);

		expect(reasons.some((r) => r.includes("Not updated"))).toBe(false);
	});

	it("flags a worsening position trend", () => {
		const { reasons } = computeRefreshSignals(article(), { recent: 15, prior: 10 }, 9999, now);

		expect(reasons.some((r) => r.includes("worsened by 5.0"))).toBe(true);
	});

	it("does not flag a stable or improving position trend", () => {
		const { reasons: stable } = computeRefreshSignals(article(), { recent: 10, prior: 10 }, 9999, now);
		const { reasons: improving } = computeRefreshSignals(article(), { recent: 8, prior: 12 }, 9999, now);

		expect(stable.some((r) => r.includes("worsened"))).toBe(false);
		expect(improving.some((r) => r.includes("worsened"))).toBe(false);
	});

	it("flags impressions with zero clicks", () => {
		const { reasons } = computeRefreshSignals(article({ searchImpressions: 500, searchClicks: 0 }), undefined, 9999, now);

		expect(reasons.some((r) => r.includes("no clicks"))).toBe(true);
	});

	it("produces no reasons for a healthy, recently-updated article", () => {
		const healthy = article({ publishedAt: "2025-12-30T00:00:00.000Z", searchImpressions: 100, searchClicks: 10 });
		const { reasons } = computeRefreshSignals(healthy, { recent: 8, prior: 8 }, 180, now);

		expect(reasons).toEqual([]);
	});
});

describe("listRefreshCandidates", () => {
	it("only returns articles with at least one reason, sorted by refreshScore", async () => {
		mockGetArticlePerformance.mockResolvedValue([
			article({ articleId: "a", publishedAt: "2020-01-01T00:00:00.000Z" }), // very stale
			article({ articleId: "b", publishedAt: new Date().toISOString() }), // fresh, no reasons
		]);

		const candidates = await listRefreshCandidates();

		expect(candidates).toHaveLength(1);
		expect(candidates[0]?.articleId).toBe("a");
	});

	it("respects the limit parameter", async () => {
		mockGetArticlePerformance.mockResolvedValue([
			article({ articleId: "a", publishedAt: "2020-01-01T00:00:00.000Z" }),
			article({ articleId: "b", publishedAt: "2020-01-01T00:00:00.000Z" }),
		]);

		const candidates = await listRefreshCandidates(1);

		expect(candidates).toHaveLength(1);
	});
});

describe("getRefreshSignalsForArticle", () => {
	it("returns signals for a matching published article", async () => {
		mockGetArticlePerformance.mockResolvedValue([article({ articleId: "target", publishedAt: "2020-01-01T00:00:00.000Z" })]);

		const result = await getRefreshSignalsForArticle("target");

		expect(result).not.toBeNull();
		expect(result?.article.articleId).toBe("target");
		expect(result?.reasons.length).toBeGreaterThan(0);
	});

	it("returns null when the article isn't in the published performance set", async () => {
		mockGetArticlePerformance.mockResolvedValue([article({ articleId: "other" })]);

		const result = await getRefreshSignalsForArticle("target");

		expect(result).toBeNull();
	});
});
