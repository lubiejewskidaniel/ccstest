import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: () => mockCreateSupabaseServerClient(),
}));

const { detectCannibalisation } = await import("../cannibalisation");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fakeSupabase(metricsRows: any[], articleRows: any[]) {
	const articleQueryLocales: string[] = [];
	const from = vi.fn((table: string) => {
		if (table === "search_performance_metrics") {
			const neq = vi.fn(async () => ({ data: metricsRows }));
			const gte = vi.fn(() => ({ neq }));
			const select = vi.fn(() => ({ gte }));
			return { select };
		}
		if (table === "insights_articles") {
			// Filters for real, so tests can tell an over-fetch from a
			// correctly-scoped one.
			const select = vi.fn(() => ({
				eq: vi.fn((_col: string, locale: string) => ({
					in: vi.fn(async (_col2: string, slugs: string[]) => {
						articleQueryLocales.push(locale);
						return { data: articleRows.filter((a) => a.locale === locale && slugs.includes(a.slug)) };
					}),
				})),
			}));
			return { select };
		}
		throw new Error(`unexpected table "${table}"`);
	});
	return { from, articleQueryLocales };
}

function metricRow(overrides: Record<string, unknown> = {}) {
	return { query: "edge caching", page_url: "https://ccs.example/insights/edge-caching", impressions: 100, clicks: 10, avg_position: 8, ...overrides };
}

beforeEach(() => {
	mockCreateSupabaseServerClient.mockReset();
});

describe("detectCannibalisation", () => {
	it("still flags genuine cannibalisation between two unrelated articles", async () => {
		const supabase = fakeSupabase(
			[metricRow({ page_url: "https://ccs.example/insights/edge-caching" }), metricRow({ page_url: "https://ccs.example/insights/cdn-basics" })],
			[
				{ id: "article-a", locale: "en", slug: "edge-caching", translation_of: null },
				{ id: "article-b", locale: "en", slug: "cdn-basics", translation_of: null },
			],
		);
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const rows = await detectCannibalisation();

		expect(rows).toHaveLength(1);
		expect(rows[0]?.pages).toHaveLength(2);
	});

	it("looks up article identity with one bounded, locale-scoped query per locale present -- not once per query/page", async () => {
		const supabase = fakeSupabase(
			[
				metricRow({ query: "edge caching", page_url: "https://ccs.example/insights/edge-caching" }),
				metricRow({ query: "cdn", page_url: "https://ccs.example/insights/edge-caching" }),
				metricRow({ query: "cdn", page_url: "https://ccs.example/insights/cdn-basics" }),
				metricRow({ query: "buforowanie", page_url: "https://ccs.example/pl/wiedza/buforowanie-brzegowe" }),
			],
			[
				{ id: "article-a", locale: "en", slug: "edge-caching", translation_of: null },
				{ id: "article-b", locale: "en", slug: "cdn-basics", translation_of: null },
				{ id: "article-a-pl", locale: "pl", slug: "buforowanie-brzegowe", translation_of: "article-a" },
			],
		);
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		await detectCannibalisation();

		// Three distinct queries, two locales -- exactly one lookup per
		// locale, never one per query or one per page.
		expect(supabase.articleQueryLocales.sort()).toEqual(["en", "pl"]);
	});

	it("does not report an EN/PL translation pair as cannibalisation", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(
			fakeSupabase(
				[
					metricRow({ page_url: "https://ccs.example/insights/edge-caching" }),
					metricRow({ page_url: "https://ccs.example/pl/wiedza/buforowanie-brzegowe" }),
				],
				[
					{ id: "article-a", locale: "en", slug: "edge-caching", translation_of: null },
					{ id: "article-a-pl", locale: "pl", slug: "buforowanie-brzegowe", translation_of: "article-a" },
				],
			),
		);

		const rows = await detectCannibalisation();

		expect(rows).toHaveLength(0);
	});

	it("reversing which side holds translation_of does not bypass the exclusion", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(
			fakeSupabase(
				[
					metricRow({ page_url: "https://ccs.example/insights/edge-caching" }),
					metricRow({ page_url: "https://ccs.example/pl/wiedza/buforowanie-brzegowe" }),
				],
				[
					// translation_of now points the other way round.
					{ id: "article-a", locale: "en", slug: "edge-caching", translation_of: "article-a-pl" },
					{ id: "article-a-pl", locale: "pl", slug: "buforowanie-brzegowe", translation_of: null },
				],
			),
		);

		const rows = await detectCannibalisation();

		expect(rows).toHaveLength(0);
	});

	it("still flags a translation pair against a genuinely unrelated third article", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(
			fakeSupabase(
				[
					metricRow({ page_url: "https://ccs.example/insights/edge-caching" }),
					metricRow({ page_url: "https://ccs.example/pl/wiedza/buforowanie-brzegowe" }),
					metricRow({ page_url: "https://ccs.example/insights/cdn-basics" }),
				],
				[
					{ id: "article-a", locale: "en", slug: "edge-caching", translation_of: null },
					{ id: "article-a-pl", locale: "pl", slug: "buforowanie-brzegowe", translation_of: "article-a" },
					{ id: "article-b", locale: "en", slug: "cdn-basics", translation_of: null },
				],
			),
		);

		const rows = await detectCannibalisation();

		expect(rows).toHaveLength(1);
		expect(rows[0]?.pages).toHaveLength(3); // all three pages still shown -- nothing hidden
	});

	it("unrelated EN/PL articles (no translation relationship) are still reported, preserving existing locale behaviour", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(
			fakeSupabase(
				[
					metricRow({ page_url: "https://ccs.example/insights/edge-caching" }),
					metricRow({ page_url: "https://ccs.example/pl/wiedza/inny-artykul" }),
				],
				[
					{ id: "article-a", locale: "en", slug: "edge-caching", translation_of: null },
					{ id: "article-c", locale: "pl", slug: "inny-artykul", translation_of: null },
				],
			),
		);

		const rows = await detectCannibalisation();

		expect(rows).toHaveLength(1);
		expect(rows[0]?.pages.map((p) => p.locale).sort()).toEqual(["en", "pl"]);
	});

	it("a missing/null translation relationship never accidentally suppresses a candidate", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(
			fakeSupabase(
				[
					metricRow({ page_url: "https://ccs.example/insights/edge-caching" }),
					metricRow({ page_url: "https://ccs.example/insights/cdn-basics" }),
				],
				[
					{ id: "article-a", locale: "en", slug: "edge-caching", translation_of: null },
					{ id: "article-b", locale: "en", slug: "cdn-basics", translation_of: null },
				],
			),
		);

		const rows = await detectCannibalisation();

		expect(rows).toHaveLength(1);
	});

	it("a page with no matching insights_articles row is never merged with anything (fails open, not closed)", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(
			fakeSupabase(
				[
					metricRow({ page_url: "https://ccs.example/insights/edge-caching" }),
					metricRow({ page_url: "https://ccs.example/insights/deleted-article" }),
				],
				[{ id: "article-a", locale: "en", slug: "edge-caching", translation_of: null }],
			),
		);

		const rows = await detectCannibalisation();

		expect(rows).toHaveLength(1);
	});

	it("only one article for a query is never cannibalisation", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(
			fakeSupabase(
				[metricRow({ page_url: "https://ccs.example/insights/edge-caching" })],
				[{ id: "article-a", locale: "en", slug: "edge-caching", translation_of: null }],
			),
		);

		const rows = await detectCannibalisation();

		expect(rows).toHaveLength(0);
	});
});
