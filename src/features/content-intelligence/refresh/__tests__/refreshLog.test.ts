import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAdminSession = vi.fn();
vi.mock("@/lib/supabase/adminAuth", () => ({
	getAdminSession: () => mockGetAdminSession(),
}));

const mockCreateSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: () => mockCreateSupabaseServerClient(),
}));

const mockGetArticlePerformance = vi.fn();
vi.mock("../../monitoring/performanceAnalysis", () => ({
	getArticlePerformance: (...args: unknown[]) => mockGetArticlePerformance(...args),
}));

const mockGetRefreshSignalsForArticle = vi.fn();
vi.mock("../staleness", () => ({
	getRefreshSignalsForArticle: (id: string) => mockGetRefreshSignalsForArticle(id),
}));

const { recordRefreshIfEligible, evaluateRefresh, classifyRefreshOutcome, listRefreshHistory } = await import("../refreshLog");

const EDITOR_SESSION = { userId: "editor-1", email: "editor@example.com", roles: ["editor"], isAdmin: false, isEditor: true };
const ARTICLE_ID = "11111111-1111-4111-8111-111111111111";

function fakeChain(result: unknown) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const chain: any = {};
	for (const method of ["select", "eq", "limit", "order", "update"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.insert = vi.fn(() => chain);
	chain.maybeSingle = vi.fn(async () => result);
	chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => Promise.resolve(result).then(resolve, reject);
	return chain;
}

function articleSignals(overrides: Record<string, unknown> = {}) {
	return {
		article: {
			articleId: ARTICLE_ID,
			locale: "en" as const,
			slug: "edge-caching",
			title: "Edge caching",
			publishedAt: "2025-01-01T00:00:00.000Z",
			updatedAt: "2025-06-01T00:00:00.000Z",
			views: 0,
			ctaClicks: 0,
			searchImpressions: 0,
			searchClicks: 0,
			avgPosition: null,
			...overrides,
		},
		reasons: ["Not updated in 365 days (threshold: 180)."],
		refreshScore: 20,
	};
}

function refreshContext(overrides: Partial<{ triggeredAt: Date; articleUpdatedAtBefore: string }> = {}) {
	return { triggeredAt: new Date("2026-01-01T00:00:00.000Z"), articleUpdatedAtBefore: "2025-05-01T00:00:00.000Z", ...overrides };
}

beforeEach(() => {
	mockGetAdminSession.mockReset().mockResolvedValue(EDITOR_SESSION);
	mockCreateSupabaseServerClient.mockReset();
	mockGetArticlePerformance.mockReset().mockResolvedValue([]);
	mockGetRefreshSignalsForArticle.mockReset();
});

describe("recordRefreshIfEligible", () => {
	it("rejects a non-editor session", async () => {
		mockGetAdminSession.mockResolvedValue({ ...EDITOR_SESSION, isEditor: false });

		const result = await recordRefreshIfEligible(ARTICLE_ID, refreshContext());

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.kind).toBe("auth");
	});

	it("creates exactly one row with server-derived reasons, never any client-supplied text", async () => {
		const from = vi.fn();
		from.mockReturnValueOnce(fakeChain({ data: null })); // pending check -- none exists
		from.mockReturnValueOnce(fakeChain({ error: null })); // insert
		mockCreateSupabaseServerClient.mockResolvedValue({ from });
		mockGetRefreshSignalsForArticle.mockResolvedValue(articleSignals());
		mockGetArticlePerformance.mockResolvedValue([
			{ articleId: ARTICLE_ID, views: 40, ctaClicks: 2, searchImpressions: 300, searchClicks: 12, avgPosition: 14.2 },
		]);

		const result = await recordRefreshIfEligible(ARTICLE_ID, refreshContext());

		expect(result).toEqual({ ok: true, created: true });
		expect(from).toHaveBeenCalledTimes(2);
		const insertChain = from.mock.results[1]?.value;
		const insertedRow = insertChain.insert.mock.calls[0]?.[0];
		expect(insertedRow.reasons).toEqual(articleSignals().reasons);
		expect(insertedRow.baseline_views).toBe(40);
		expect(insertedRow.baseline_cta_clicks).toBe(2);
		expect(insertedRow.baseline_search_impressions).toBe(300);
		expect(insertedRow.baseline_search_clicks).toBe(12);
		expect(insertedRow.baseline_avg_position).toBe(14.2);
		expect(insertedRow.locale).toBe("en");
		expect(insertedRow.evaluation_status).toBe("pending");
		expect(insertedRow.created_by).toBe("editor-1");
	});

	it("uses the caller-supplied context verbatim -- article_updated_at_before and triggered_at are never re-derived here", async () => {
		const from = vi.fn();
		from.mockReturnValueOnce(fakeChain({ data: null }));
		from.mockReturnValueOnce(fakeChain({ error: null }));
		mockCreateSupabaseServerClient.mockResolvedValue({ from });
		mockGetRefreshSignalsForArticle.mockResolvedValue(articleSignals());
		mockGetArticlePerformance.mockResolvedValue([]);
		const context = refreshContext({ triggeredAt: new Date("2026-03-01T12:00:00.000Z"), articleUpdatedAtBefore: "2025-11-20T09:30:00.000Z" });

		await recordRefreshIfEligible(ARTICLE_ID, context);

		const insertedRow = from.mock.results[1]?.value.insert.mock.calls[0]?.[0];
		// Not articleSignals().article.updatedAt (2025-06-01) -- that would
		// be the bug this correction fixes: a post-save read mislabelled
		// as "before".
		expect(insertedRow.article_updated_at_before).toBe("2025-11-20T09:30:00.000Z");
		expect(insertedRow.triggered_at).toBe("2026-03-01T12:00:00.000Z");
	});

	it("computes an exact [triggeredAt - N, triggeredAt) baseline window, anchored to the supplied triggeredAt", async () => {
		const from = vi.fn();
		from.mockReturnValueOnce(fakeChain({ data: null }));
		from.mockReturnValueOnce(fakeChain({ error: null }));
		mockCreateSupabaseServerClient.mockResolvedValue({ from });
		const triggeredAt = new Date("2026-01-01T00:00:00.000Z");
		const publishedAt = new Date(triggeredAt.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString(); // live 45 days -> capped at 30
		mockGetRefreshSignalsForArticle.mockResolvedValue(articleSignals({ publishedAt }));
		mockGetArticlePerformance.mockResolvedValue([
			{ articleId: ARTICLE_ID, views: 0, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null },
		]);

		await recordRefreshIfEligible(ARTICLE_ID, refreshContext({ triggeredAt }));

		const pendingCheckChain = from.mock.results[0]?.value;
		expect(pendingCheckChain.eq.mock.calls[0]).toEqual(["article_id", ARTICLE_ID]);
		expect(pendingCheckChain.eq.mock.calls[1]).toEqual(["evaluation_status", "pending"]);

		const [daysBack, window] = mockGetArticlePerformance.mock.calls[0]!;
		expect(daysBack).toBe(30);
		expect(window.end.toISOString()).toBe(triggeredAt.toISOString());
		expect(window.start.toISOString()).toBe(new Date(triggeredAt.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString());
	});

	it("EN and PL articles are independent -- each save is scoped to its own article id", async () => {
		const enId = "11111111-1111-4111-8111-111111111111";
		const plId = "22222222-2222-4222-8222-222222222222";

		for (const [id, locale] of [
			[enId, "en"],
			[plId, "pl"],
		] as const) {
			const from = vi.fn();
			from.mockReturnValueOnce(fakeChain({ data: null }));
			from.mockReturnValueOnce(fakeChain({ error: null }));
			mockCreateSupabaseServerClient.mockResolvedValue({ from });
			mockGetRefreshSignalsForArticle.mockResolvedValue(articleSignals({ locale }));
			mockGetArticlePerformance.mockResolvedValue([
				{ articleId: id, views: 0, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null },
			]);

			await recordRefreshIfEligible(id, refreshContext());

			const pendingCheckChain = from.mock.results[0]?.value;
			expect(pendingCheckChain.eq.mock.calls[0]).toEqual(["article_id", id]);
			const insertedRow = from.mock.results[1]?.value.insert.mock.calls[0]?.[0];
			expect(insertedRow.locale).toBe(locale);
		}
	});

	it("skips creating a new row when a pending episode already exists for this article", async () => {
		const from = vi.fn();
		from.mockReturnValueOnce(fakeChain({ data: { id: "existing-pending-id" } }));
		mockCreateSupabaseServerClient.mockResolvedValue({ from });

		const result = await recordRefreshIfEligible(ARTICLE_ID, refreshContext());

		expect(result).toEqual({ ok: true, created: false });
		expect(from).toHaveBeenCalledTimes(1); // never reached insert
		expect(mockGetRefreshSignalsForArticle).not.toHaveBeenCalled();
	});

	it("resolves a concurrent duplicate-pending insert conflict (lost race) to created: false, not a persistence failure", async () => {
		const from = vi.fn();
		from.mockReturnValueOnce(fakeChain({ data: null })); // pre-check found nothing...
		from.mockReturnValueOnce(fakeChain({ error: { message: "duplicate key value violates unique constraint", code: "23505" } })); // ...but lost the race on insert
		mockCreateSupabaseServerClient.mockResolvedValue({ from });
		mockGetRefreshSignalsForArticle.mockResolvedValue(articleSignals());
		mockGetArticlePerformance.mockResolvedValue([]);

		const result = await recordRefreshIfEligible(ARTICLE_ID, refreshContext());

		expect(result).toEqual({ ok: true, created: false });
	});

	it("still reports an unrelated insert error as a genuine persistence failure", async () => {
		const from = vi.fn();
		from.mockReturnValueOnce(fakeChain({ data: null }));
		from.mockReturnValueOnce(fakeChain({ error: { message: "connection reset", code: "08006" } }));
		mockCreateSupabaseServerClient.mockResolvedValue({ from });
		mockGetRefreshSignalsForArticle.mockResolvedValue(articleSignals());
		mockGetArticlePerformance.mockResolvedValue([]);

		const result = await recordRefreshIfEligible(ARTICLE_ID, refreshContext());

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.kind).toBe("persistence");
			expect(result.message).toBe("connection reset");
		}
	});

	it("marks the episode insufficient_data immediately when the article hasn't been live long enough", async () => {
		const from = vi.fn();
		from.mockReturnValueOnce(fakeChain({ data: null }));
		from.mockReturnValueOnce(fakeChain({ error: null }));
		mockCreateSupabaseServerClient.mockResolvedValue({ from });
		const triggeredAt = new Date("2026-01-01T00:00:00.000Z");
		// Published 3 days before triggeredAt -- below the 7-day floor.
		const publishedAt = new Date(triggeredAt.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
		mockGetRefreshSignalsForArticle.mockResolvedValue(articleSignals({ publishedAt }));
		mockGetArticlePerformance.mockResolvedValue([{ articleId: ARTICLE_ID, views: 1, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null }]);

		await recordRefreshIfEligible(ARTICLE_ID, refreshContext({ triggeredAt }));

		const insertedRow = from.mock.results[1]?.value.insert.mock.calls[0]?.[0];
		expect(insertedRow.evaluation_status).toBe("insufficient_data");
		expect(insertedRow.evaluation_window_days).toBeNull();
		expect(insertedRow.baseline_window_days).toBe(3);
	});

	it("returns not_found when the article has no performance data (unpublished)", async () => {
		const from = vi.fn();
		from.mockReturnValueOnce(fakeChain({ data: null }));
		mockCreateSupabaseServerClient.mockResolvedValue({ from });
		mockGetRefreshSignalsForArticle.mockResolvedValue(null);

		const result = await recordRefreshIfEligible(ARTICLE_ID, refreshContext());

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.kind).toBe("not_found");
	});
});

describe("classifyRefreshOutcome", () => {
	it("classifies improved when engagement rises past the threshold", () => {
		const status = classifyRefreshOutcome(
			{ views: 100, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null },
			{ views: 130, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null },
		);
		expect(status).toBe("improved"); // +30%
	});

	it("classifies declined when engagement falls past the threshold", () => {
		const status = classifyRefreshOutcome(
			{ views: 100, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null },
			{ views: 70, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null },
		);
		expect(status).toBe("declined"); // -30%
	});

	it("classifies neutral for a small movement under the threshold", () => {
		const status = classifyRefreshOutcome(
			{ views: 100, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null },
			{ views: 110, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null },
		);
		expect(status).toBe("neutral"); // +10%, under 20%
	});

	it("stays exactly on the engagement threshold boundary as improved (>=)", () => {
		const status = classifyRefreshOutcome(
			{ views: 100, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null },
			{ views: 120, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null },
		);
		expect(status).toBe("improved"); // exactly +20%
	});

	it("stays exactly on the negative engagement threshold boundary as declined (<=)", () => {
		const status = classifyRefreshOutcome(
			{ views: 100, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null },
			{ views: 80, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null },
		);
		expect(status).toBe("declined"); // exactly -20%
	});

	it("stays neutral one unit inside each engagement boundary", () => {
		const up = classifyRefreshOutcome(
			{ views: 100, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null },
			{ views: 119, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null },
		);
		const down = classifyRefreshOutcome(
			{ views: 100, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null },
			{ views: 81, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null },
		);
		expect(up).toBe("neutral");
		expect(down).toBe("neutral");
	});

	it("stays exactly on the position threshold boundary in both directions", () => {
		const improved = classifyRefreshOutcome(
			{ views: 0, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: 20 },
			{ views: 0, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: 17 }, // exactly -3
		);
		const declined = classifyRefreshOutcome(
			{ views: 0, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: 10 },
			{ views: 0, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: 13 }, // exactly +3
		);
		expect(improved).toBe("improved");
		expect(declined).toBe("declined");
	});

	it("treats zero baseline engagement with real after-activity as improved", () => {
		const status = classifyRefreshOutcome(
			{ views: 0, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null },
			{ views: 5, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null },
		);
		expect(status).toBe("improved");
	});

	it("returns insufficient_data when both baseline and after are entirely zero", () => {
		const status = classifyRefreshOutcome(
			{ views: 0, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null },
			{ views: 0, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null },
		);
		expect(status).toBe("insufficient_data");
	});

	it("ignores a tiny baseline below MIN_ENGAGEMENT_BASE for percentage purposes, falling back to insufficient_data with no position data", () => {
		// 1 view -> 3 views would be "+200%" but is not a real signal.
		const status = classifyRefreshOutcome(
			{ views: 1, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null },
			{ views: 3, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null },
		);
		expect(status).toBe("insufficient_data");
	});

	it("treats a lower average position as improvement (position 1 is best)", () => {
		const status = classifyRefreshOutcome(
			{ views: 0, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: 20 },
			{ views: 0, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: 14 },
		);
		expect(status).toBe("improved"); // moved up 6 positions
	});

	it("treats a higher average position as decline", () => {
		const status = classifyRefreshOutcome(
			{ views: 0, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: 10 },
			{ views: 0, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: 16 },
		);
		expect(status).toBe("declined");
	});

	it("stays neutral when engagement and position disagree (mixed signal)", () => {
		const status = classifyRefreshOutcome(
			{ views: 100, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: 10 },
			{ views: 130, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: 20 }, // engagement up, position down
		);
		expect(status).toBe("neutral");
	});

	it("weights CTA clicks the same way calibration.ts does (x5)", () => {
		const status = classifyRefreshOutcome(
			{ views: 0, ctaClicks: 10, searchImpressions: 0, searchClicks: 0, avgPosition: null }, // 50
			{ views: 0, ctaClicks: 13, searchImpressions: 0, searchClicks: 0, avgPosition: null }, // 65, +30%
		);
		expect(status).toBe("improved");
	});
});

describe("evaluateRefresh", () => {
	const PENDING_ROW = {
		id: "log-1",
		article_id: ARTICLE_ID,
		triggered_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
		evaluation_window_days: 30,
		evaluation_status: "pending",
		baseline_views: 50,
		baseline_cta_clicks: 0,
		baseline_search_impressions: 0,
		baseline_search_clicks: 0,
		baseline_avg_position: null,
	};

	it("rejects a non-editor session", async () => {
		mockGetAdminSession.mockResolvedValue({ ...EDITOR_SESSION, isEditor: false });

		const result = await evaluateRefresh("log-1");

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.kind).toBe("auth");
	});

	it("refuses evaluation before the full after-window has elapsed", async () => {
		const from = vi.fn();
		from.mockReturnValueOnce(
			fakeChain({ data: { ...PENDING_ROW, triggered_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() } }),
		);
		mockCreateSupabaseServerClient.mockResolvedValue({ from });

		const result = await evaluateRefresh("log-1");

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.kind).toBe("not_eligible");
	});

	it("evaluates once eligible and persists the after-evidence and classification", async () => {
		const from = vi.fn();
		from.mockReturnValueOnce(fakeChain({ data: PENDING_ROW }));
		const updateChain = fakeChain({ data: [{ evaluation_status: "improved" }], error: null });
		from.mockReturnValueOnce(updateChain);
		mockCreateSupabaseServerClient.mockResolvedValue({ from });
		mockGetArticlePerformance.mockResolvedValue([
			{ articleId: ARTICLE_ID, views: 80, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null },
		]);

		const result = await evaluateRefresh("log-1");

		expect(result).toEqual({ ok: true, status: "improved" }); // 50 -> 80, +60%
		const updatedFields = updateChain.update.mock.calls[0]?.[0];
		expect(updatedFields.evaluation_status).toBe("improved");
		expect(updatedFields.after_views).toBe(80);
		expect(updatedFields.evaluated_at).toBeTruthy();
	});

	it("is idempotent -- re-evaluating an already-terminal row returns the stored status without recomputing", async () => {
		const from = vi.fn();
		from.mockReturnValueOnce(fakeChain({ data: { ...PENDING_ROW, evaluation_status: "improved" } }));
		mockCreateSupabaseServerClient.mockResolvedValue({ from });

		const result = await evaluateRefresh("log-1");

		expect(result).toEqual({ ok: true, status: "improved" });
		expect(from).toHaveBeenCalledTimes(1); // never reached the update
		expect(mockGetArticlePerformance).not.toHaveBeenCalled();
	});

	it("produces the same result regardless of how long after eligibility Evaluate is clicked, given the same after-window data", async () => {
		const oldRow = { ...PENDING_ROW, triggered_at: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString() };
		const from = vi.fn();
		from.mockReturnValueOnce(fakeChain({ data: oldRow }));
		from.mockReturnValueOnce(fakeChain({ data: [{ evaluation_status: "improved" }], error: null }));
		mockCreateSupabaseServerClient.mockResolvedValue({ from });
		mockGetArticlePerformance.mockResolvedValue([
			{ articleId: ARTICLE_ID, views: 80, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null },
		]);

		await evaluateRefresh("log-1");

		// The exact window passed to getArticlePerformance is anchored to
		// triggered_at, not to "now" -- verified by asserting the window
		// bounds it was actually called with.
		const [daysBack, window] = mockGetArticlePerformance.mock.calls[0]!;
		expect(daysBack).toBe(30);
		expect(window.start.toISOString()).toBe(new Date(oldRow.triggered_at).toISOString());
		expect(window.end.getTime() - window.start.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
	});

	it("evaluating the same triggered_at at day 40 vs day 180 yields the identical window and the identical classification", async () => {
		const triggeredAt = new Date(Date.now() - 500 * 24 * 60 * 60 * 1000).toISOString(); // ancient, so both "click dates" are eligible
		const afterData = [{ articleId: ARTICLE_ID, views: 80, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null }];
		const windows: { start: Date; end: Date }[] = [];
		const results: unknown[] = [];

		for (let i = 0; i < 2; i++) {
			const from = vi.fn();
			from.mockReturnValueOnce(fakeChain({ data: { ...PENDING_ROW, triggered_at: triggeredAt } }));
			from.mockReturnValueOnce(fakeChain({ data: [{ evaluation_status: "improved" }], error: null }));
			mockCreateSupabaseServerClient.mockResolvedValue({ from });
			mockGetArticlePerformance.mockReset().mockResolvedValue(afterData);

			results.push(await evaluateRefresh("log-1"));
			windows.push(mockGetArticlePerformance.mock.calls[0]![1] as { start: Date; end: Date });
		}

		expect(results[0]).toEqual(results[1]);
		expect(windows[0]!.start.toISOString()).toBe(windows[1]!.start.toISOString());
		expect(windows[0]!.end.toISOString()).toBe(windows[1]!.end.toISOString());
	});

	it("marks insufficient_data when the article no longer appears in the published performance set", async () => {
		const from = vi.fn();
		from.mockReturnValueOnce(fakeChain({ data: PENDING_ROW }));
		const updateChain = fakeChain({ data: [{ evaluation_status: "insufficient_data" }], error: null });
		from.mockReturnValueOnce(updateChain);
		mockCreateSupabaseServerClient.mockResolvedValue({ from });
		mockGetArticlePerformance.mockResolvedValue([]); // article unpublished since refresh

		const result = await evaluateRefresh("log-1");

		expect(result).toEqual({ ok: true, status: "insufficient_data" });
		expect(updateChain.update.mock.calls[0]?.[0].after_views).toBeNull();
	});

	it("a lost race (zero rows matched by the conditional update) returns the actual stored terminal status, not the locally-computed one", async () => {
		const from = vi.fn();
		from.mockReturnValueOnce(fakeChain({ data: PENDING_ROW })); // read: still pending
		from.mockReturnValueOnce(fakeChain({ data: [], error: null })); // update: zero rows matched -- another evaluation won
		from.mockReturnValueOnce(fakeChain({ data: { evaluation_status: "declined" } })); // read-back: the actual winner's result
		mockCreateSupabaseServerClient.mockResolvedValue({ from });
		mockGetArticlePerformance.mockResolvedValue([
			{ articleId: ARTICLE_ID, views: 80, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null }, // would locally classify as "improved" (50 -> 80)
		]);

		const result = await evaluateRefresh("log-1");

		// Not "improved" -- this call's own locally-computed classification
		// was never actually persisted, so it must never be claimed either.
		expect(result).toEqual({ ok: true, status: "declined" });
	});

	it("two concurrent Evaluate calls cannot both persist a terminal result -- only the winner's update matches a row", async () => {
		const winnerFrom = vi.fn();
		winnerFrom.mockReturnValueOnce(fakeChain({ data: PENDING_ROW }));
		const winnerUpdate = fakeChain({ data: [{ evaluation_status: "improved" }], error: null });
		winnerFrom.mockReturnValueOnce(winnerUpdate);
		mockCreateSupabaseServerClient.mockResolvedValueOnce({ from: winnerFrom });
		mockGetArticlePerformance.mockResolvedValueOnce([
			{ articleId: ARTICLE_ID, views: 80, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null },
		]);
		const winnerResult = await evaluateRefresh("log-1");

		const loserFrom = vi.fn();
		loserFrom.mockReturnValueOnce(fakeChain({ data: PENDING_ROW })); // read still saw "pending" -- raced before the winner's commit
		loserFrom.mockReturnValueOnce(fakeChain({ data: [], error: null })); // by the time it updates, the row is no longer pending
		loserFrom.mockReturnValueOnce(fakeChain({ data: { evaluation_status: "improved" } }));
		mockCreateSupabaseServerClient.mockResolvedValueOnce({ from: loserFrom });
		mockGetArticlePerformance.mockResolvedValueOnce([
			{ articleId: ARTICLE_ID, views: 55, ctaClicks: 0, searchImpressions: 0, searchClicks: 0, avgPosition: null }, // would locally classify as "neutral" (50 -> 55, +10%) -- must be discarded
		]);
		const loserResult = await evaluateRefresh("log-1");

		expect(winnerResult).toEqual({ ok: true, status: "improved" });
		expect(loserResult).toEqual({ ok: true, status: "improved" }); // matches the winner's persisted value, not its own zero-effect update
		expect(winnerUpdate.update).toHaveBeenCalledTimes(1);
	});
});

describe("listRefreshHistory", () => {
	it("maps stored rows to the RefreshLogRow shape", async () => {
		const from = vi.fn();
		from.mockReturnValueOnce(
			fakeChain({
				data: [
					{
						id: "log-1",
						article_id: ARTICLE_ID,
						locale: "pl",
						triggered_at: "2026-01-01T00:00:00.000Z",
						reasons: ["Not updated in 200 days (threshold: 180)."],
						baseline_window_days: 30,
						baseline_views: 10,
						baseline_cta_clicks: 1,
						baseline_search_impressions: 50,
						baseline_search_clicks: 2,
						baseline_avg_position: 12.5,
						evaluation_window_days: 30,
						evaluation_status: "pending",
						evaluated_at: null,
						after_views: null,
						after_cta_clicks: null,
						after_search_impressions: null,
						after_search_clicks: null,
						after_avg_position: null,
					},
				],
			}),
		);
		mockCreateSupabaseServerClient.mockResolvedValue({ from });

		const rows = await listRefreshHistory();

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ id: "log-1", locale: "pl", evaluationStatus: "pending", baselineAvgPosition: 12.5 });
	});
});
