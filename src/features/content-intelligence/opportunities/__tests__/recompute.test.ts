import { describe, it, expect, vi, beforeEach } from "vitest";
import { scoreOpportunity } from "../score";

/**
 * Mocks the three Supabase-facing/DB-adjacent seams `recompute.ts`
 * actually calls (`@/lib/supabase/adminAuth`, `@/lib/supabase/server`,
 * `../learning/calibration`) — same pattern as
 * `src/features/insights/cms/__tests__/service.indexnow.test.ts`'s
 * `fakeSupabase()`. `scoreOpportunity` itself is imported for real
 * (never mocked) so these tests exercise the actual, unmodified scoring
 * formula and prove recompute.ts's integration with it — and with the
 * calibration multiplier — still works after the aggregation rewrite.
 *
 * The `mock`-prefix on every vi.mock-closed-over variable is required —
 * Vitest hoists `vi.mock` factories above imports and only allows a
 * factory to reference an outer variable whose name starts with "mock".
 */

const mockGetAdminSession = vi.fn();
vi.mock("@/lib/supabase/adminAuth", () => ({
	getAdminSession: () => mockGetAdminSession(),
}));

const mockCreateSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: () => mockCreateSupabaseServerClient(),
}));

const mockGetLatestCalibrationMultiplier = vi.fn();
vi.mock("../../learning/calibration", () => ({
	getLatestCalibrationMultiplier: () => mockGetLatestCalibrationMultiplier(),
}));

const { recomputeOpportunities } = await import("../recompute");

const EDITOR_SESSION = { userId: "u1", email: "editor@example.com", roles: ["editor"], isAdmin: false, isEditor: true };

type MetricFixture = {
	query: string;
	locale: string | null;
	source: "google" | "bing";
	impressions: number;
	clicks: number;
	avg_position: number | null;
};

type ExistingOpportunityFixture = {
	id: string;
	query: string;
	opportunity_score: number;
	total_impressions: number;
	total_clicks: number;
	avg_position: number | null;
	google_impressions: number;
	google_clicks: number;
	bing_impressions: number;
	bing_clicks: number;
};

/** A thenable query-builder stub: every chain method (`select`/`eq`/
 * `in`) returns the same object, and `await`-ing it resolves via
 * `resolve()` — a minimal stand-in for supabase-js's own
 * PostgrestFilterBuilder (which is itself thenable), enough for
 * `recompute.ts`'s actual call shapes and nothing more. */
function chainable(resolve: () => { data: unknown; error: { message: string } | null }) {
	const builder: Record<string, unknown> = {};
	builder.select = vi.fn(() => builder);
	builder.eq = vi.fn(() => builder);
	builder.in = vi.fn(() => builder);
	builder.then = (onFulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown) =>
		Promise.resolve(resolve()).then(onFulfilled);
	return builder;
}

function fakeSupabase(opts: {
	metrics: MetricFixture[];
	articles?: { id: string; title: string; excerpt: string }[];
	existingOpportunities?: ExistingOpportunityFixture[];
	upsertError?: { message: string } | null;
	historyInsertError?: { message: string } | null;
}) {
	const existing = opts.existingOpportunities ?? [];
	const upsertCalls: Record<string, unknown>[][] = [];
	const historyInsertCalls: Record<string, unknown>[][] = [];

	function contentOpportunitiesTable() {
		const readBuilder = chainable(() => ({ data: existing, error: null }));

		return {
			...readBuilder,
			upsert: vi.fn((rows: Record<string, unknown>[]) => {
				upsertCalls.push(rows);
				return {
					select: vi.fn(() => ({
						then: (onFulfilled: (value: { data: unknown; error: unknown }) => unknown) => {
							if (opts.upsertError) return Promise.resolve({ data: null, error: opts.upsertError }).then(onFulfilled);
							const result = rows.map((row, i) => {
								const match = existing.find((e) => e.query === row.query);
								return { id: match?.id ?? `new-${i}`, ...row };
							});
							return Promise.resolve({ data: result, error: null }).then(onFulfilled);
						},
					})),
				};
			}),
		};
	}

	const from = vi.fn((table: string) => {
		if (table === "search_performance_metrics") return chainable(() => ({ data: opts.metrics, error: null }));
		if (table === "insights_articles") return chainable(() => ({ data: opts.articles ?? [], error: null }));
		if (table === "content_opportunities") return contentOpportunitiesTable();
		if (table === "opportunity_score_history") {
			return {
				insert: vi.fn((rows: Record<string, unknown>[]) => {
					historyInsertCalls.push(rows);
					return Promise.resolve({ data: null, error: opts.historyInsertError ?? null });
				}),
			};
		}
		throw new Error(`fakeSupabase: unexpected table "${table}"`);
	});

	return { from, upsertCalls, historyInsertCalls };
}

beforeEach(() => {
	mockGetAdminSession.mockReset().mockResolvedValue(EDITOR_SESSION);
	mockCreateSupabaseServerClient.mockReset();
	mockGetLatestCalibrationMultiplier.mockReset().mockResolvedValue(1);
});

function metric(overrides: Partial<MetricFixture>): MetricFixture {
	return { query: "react hooks", locale: null, source: "google", impressions: 100, clicks: 5, avg_position: 8, ...overrides };
}

describe("recomputeOpportunities — auth", () => {
	it("never touches Supabase for a non-editor session", async () => {
		mockGetAdminSession.mockResolvedValue(null);
		const result = await recomputeOpportunities();
		expect(result).toEqual({ ok: false, kind: "auth", message: expect.any(String) });
		expect(mockCreateSupabaseServerClient).not.toHaveBeenCalled();
	});
});

describe("recomputeOpportunities — source attribution", () => {
	it("attributes a Google-only query entirely to google_*, leaving bing_* at zero", async () => {
		const fake = fakeSupabase({ metrics: [metric({ source: "google", impressions: 100, clicks: 5 })] });
		mockCreateSupabaseServerClient.mockResolvedValue(fake);

		const result = await recomputeOpportunities();

		expect(result.ok).toBe(true);
		const row = fake.upsertCalls[0]![0]!;
		expect(row.google_impressions).toBe(100);
		expect(row.google_clicks).toBe(5);
		expect(row.bing_impressions).toBe(0);
		expect(row.bing_clicks).toBe(0);
		expect(row.total_impressions).toBe(100);
		expect(row.total_clicks).toBe(5);
	});

	it("attributes a Bing-only query entirely to bing_*, leaving google_* at zero", async () => {
		const fake = fakeSupabase({ metrics: [metric({ source: "bing", impressions: 40, clicks: 2, avg_position: 15 })] });
		mockCreateSupabaseServerClient.mockResolvedValue(fake);

		const result = await recomputeOpportunities();

		expect(result.ok).toBe(true);
		const row = fake.upsertCalls[0]![0]!;
		expect(row.bing_impressions).toBe(40);
		expect(row.bing_clicks).toBe(2);
		expect(row.google_impressions).toBe(0);
		expect(row.google_clicks).toBe(0);
		expect(row.total_impressions).toBe(40);
		expect(row.total_clicks).toBe(2);
	});

	it("keeps Google and Bing contributions separate for the same query, while summing totals", async () => {
		const fake = fakeSupabase({
			metrics: [
				metric({ source: "google", impressions: 100, clicks: 5, avg_position: 8 }),
				metric({ source: "bing", impressions: 20, clicks: 1, avg_position: 12 }),
			],
		});
		mockCreateSupabaseServerClient.mockResolvedValue(fake);

		const result = await recomputeOpportunities();

		expect(result.ok).toBe(true);
		expect(fake.upsertCalls[0]).toHaveLength(1); // one merged opportunity, not two
		const row = fake.upsertCalls[0]![0]!;
		expect(row.google_impressions).toBe(100);
		expect(row.google_clicks).toBe(5);
		expect(row.bing_impressions).toBe(20);
		expect(row.bing_clicks).toBe(1);
		expect(row.total_impressions).toBe(120);
		expect(row.total_clicks).toBe(6);
	});

	it("sums source attribution across multiple rows from the same source (e.g. several days)", async () => {
		const fake = fakeSupabase({
			metrics: [
				metric({ source: "google", impressions: 60, clicks: 3, avg_position: 10 }),
				metric({ source: "google", impressions: 40, clicks: 2, avg_position: 14 }),
				metric({ source: "bing", impressions: 10, clicks: 0, avg_position: 30 }),
			],
		});
		mockCreateSupabaseServerClient.mockResolvedValue(fake);

		await recomputeOpportunities();

		const row = fake.upsertCalls[0]![0]!;
		expect(row.google_impressions).toBe(100);
		expect(row.google_clicks).toBe(5);
		expect(row.bing_impressions).toBe(10);
		expect(row.bing_clicks).toBe(0);
		expect(row.total_impressions).toBe(110);
		expect(row.total_clicks).toBe(5);
	});
});

describe("recomputeOpportunities — locale grouping and resolution", () => {
	it("merges the same query appearing under two conflicting non-null locales into ONE opportunity, resolved to null", async () => {
		const fake = fakeSupabase({
			metrics: [
				metric({ query: "seo", locale: "en", source: "google", impressions: 50, clicks: 2 }),
				metric({ query: "seo", locale: "pl", source: "google", impressions: 30, clicks: 1 }),
			],
		});
		mockCreateSupabaseServerClient.mockResolvedValue(fake);

		await recomputeOpportunities();

		expect(fake.upsertCalls[0]).toHaveLength(1); // query-only grouping: still one row
		const row = fake.upsertCalls[0]![0]!;
		expect(row.locale).toBeNull(); // conflicting locales -> null, not an arbitrary pick
		expect(row.total_impressions).toBe(80);
	});

	it("resolves to the single agreed locale when every contributing row shares it", async () => {
		const fake = fakeSupabase({
			metrics: [
				metric({ query: "react hooks", locale: "en", source: "google", impressions: 50, clicks: 2 }),
				metric({ query: "react hooks", locale: "en", source: "bing", impressions: 10, clicks: 0 }),
			],
		});
		mockCreateSupabaseServerClient.mockResolvedValue(fake);

		await recomputeOpportunities();

		const row = fake.upsertCalls[0]![0]!;
		expect(row.locale).toBe("en");
	});

	it("resolves to null when no contributing row has a locale (today's universal case)", async () => {
		const fake = fakeSupabase({ metrics: [metric({ locale: null })] });
		mockCreateSupabaseServerClient.mockResolvedValue(fake);

		await recomputeOpportunities();

		expect(fake.upsertCalls[0]![0]!.locale).toBeNull();
	});
});

describe("recomputeOpportunities — impression-weighted average position", () => {
	it("weights avg_position by impressions instead of averaging already-averaged values flatly", async () => {
		const fake = fakeSupabase({
			metrics: [
				metric({ impressions: 1000, avg_position: 5, clicks: 50 }),
				metric({ impressions: 10, avg_position: 90, clicks: 0 }),
			],
		});
		mockCreateSupabaseServerClient.mockResolvedValue(fake);

		await recomputeOpportunities();

		const row = fake.upsertCalls[0]![0]!;
		const expectedWeighted = (5 * 1000 + 90 * 10) / (1000 + 10); // ≈ 5.84
		expect(row.avg_position as number).toBeCloseTo(expectedWeighted, 2);
		expect(row.avg_position as number).not.toBeCloseTo(47.5, 0); // the old, wrong flat mean
	});

	it("excludes rows with a null avg_position from both the weighted sum and the weight", async () => {
		const fake = fakeSupabase({
			metrics: [
				metric({ impressions: 100, avg_position: 10 }),
				metric({ impressions: 500, avg_position: null, clicks: 0 }),
			],
		});
		mockCreateSupabaseServerClient.mockResolvedValue(fake);

		await recomputeOpportunities();

		expect(fake.upsertCalls[0]![0]!.avg_position).toBe(10);
	});
});

describe("recomputeOpportunities — score and calibration integration (unchanged)", () => {
	it("still applies the calibration multiplier to the unmodified scoreOpportunity() output", async () => {
		mockGetLatestCalibrationMultiplier.mockResolvedValue(2.5);
		const fake = fakeSupabase({ metrics: [metric({ impressions: 200, clicks: 8, avg_position: 12 })] });
		mockCreateSupabaseServerClient.mockResolvedValue(fake);

		await recomputeOpportunities();

		const expectedBase = scoreOpportunity({ totalImpressions: 200, totalClicks: 8, avgPosition: 12 });
		const expectedScore = Math.round(expectedBase * 2.5 * 100) / 100;
		expect(fake.upsertCalls[0]![0]!.opportunity_score).toBe(expectedScore);
	});
});

describe("recomputeOpportunities — history snapshots", () => {
	it("writes a history row for a brand-new opportunity", async () => {
		const fake = fakeSupabase({ metrics: [metric({})], existingOpportunities: [] });
		mockCreateSupabaseServerClient.mockResolvedValue(fake);

		const result = await recomputeOpportunities();

		expect(result).toMatchObject({ ok: true, historyWarning: null });
		expect(fake.historyInsertCalls).toHaveLength(1);
		expect(fake.historyInsertCalls[0]).toHaveLength(1);
		expect(fake.historyInsertCalls[0]![0]!.opportunity_id).toBe("new-0");
	});

	it("does NOT write a duplicate history row when a recompute changes nothing", async () => {
		const fake = fakeSupabase({
			metrics: [metric({ impressions: 100, clicks: 5, avg_position: 8 })],
			existingOpportunities: [
				{
					id: "opp-1",
					query: "react hooks",
					opportunity_score: scoreOpportunity({ totalImpressions: 100, totalClicks: 5, avgPosition: 8 }),
					total_impressions: 100,
					total_clicks: 5,
					avg_position: 8,
					google_impressions: 100,
					google_clicks: 5,
					bing_impressions: 0,
					bing_clicks: 0,
				},
			],
		});
		mockCreateSupabaseServerClient.mockResolvedValue(fake);

		const result = await recomputeOpportunities();

		expect(result.ok).toBe(true);
		expect(fake.upsertCalls).toHaveLength(1); // the current-state upsert still always runs
		expect(fake.historyInsertCalls).toHaveLength(0); // but no redundant snapshot
	});

	it("writes a new history row when the underlying metrics genuinely changed since the last snapshot", async () => {
		const fake = fakeSupabase({
			metrics: [metric({ impressions: 500, clicks: 40, avg_position: 6 })], // more traffic now
			existingOpportunities: [
				{
					id: "opp-1",
					query: "react hooks",
					opportunity_score: scoreOpportunity({ totalImpressions: 100, totalClicks: 5, avgPosition: 8 }),
					total_impressions: 100,
					total_clicks: 5,
					avg_position: 8,
					google_impressions: 100,
					google_clicks: 5,
					bing_impressions: 0,
					bing_clicks: 0,
				},
			],
		});
		mockCreateSupabaseServerClient.mockResolvedValue(fake);

		const result = await recomputeOpportunities();

		expect(result.ok).toBe(true);
		expect(fake.historyInsertCalls).toHaveLength(1);
		expect(fake.historyInsertCalls[0]![0]!.opportunity_id).toBe("opp-1");
		expect(fake.historyInsertCalls[0]![0]!.total_impressions).toBe(500);
	});
});

describe("recomputeOpportunities — failure semantics", () => {
	it("fails the whole recompute (and never attempts a history insert) when the opportunity upsert itself fails", async () => {
		const fake = fakeSupabase({ metrics: [metric({})], upsertError: { message: "db exploded" } });
		mockCreateSupabaseServerClient.mockResolvedValue(fake);

		const result = await recomputeOpportunities();

		expect(result).toEqual({ ok: false, kind: "persistence", message: "db exploded" });
		expect(fake.historyInsertCalls).toHaveLength(0);
	});

	it("reports success with a non-null, descriptive historyWarning when the upsert succeeds but the history insert fails", async () => {
		const fake = fakeSupabase({
			metrics: [metric({})],
			existingOpportunities: [],
			historyInsertError: { message: "history table unreachable" },
		});
		mockCreateSupabaseServerClient.mockResolvedValue(fake);

		const result = await recomputeOpportunities();

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.opportunitiesUpdated).toBe(1);
			expect(result.historyWarning).toContain("history table unreachable");
		}
	});
});
