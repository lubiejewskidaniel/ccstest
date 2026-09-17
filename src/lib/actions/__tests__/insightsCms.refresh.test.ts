import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Covers the invariants this task added/fixed in updateArticleAction:
 * a refresh measurement episode is only ever attempted after a
 * successful save that explicitly carries refreshIntent="1" -- never on
 * a normal edit, never after a failed save -- and article_updated_at_before
 * is read BEFORE updateArticle runs, not after.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockUpdateArticle = vi.fn();
vi.mock("@/features/insights/cms/service", () => ({
	createArticle: vi.fn(),
	updateArticle: (...args: unknown[]) => mockUpdateArticle(...args),
	transitionArticleStatus: vi.fn(),
	deleteArticle: vi.fn(),
}));

const mockGetArticleForAdmin = vi.fn();
vi.mock("@/features/insights/cms/queries", () => ({
	getArticleForAdmin: (id: string) => mockGetArticleForAdmin(id),
}));

const mockApproveArticleVisual = vi.fn();
vi.mock("@/features/content-intelligence/visuals/articleVisualReviewService", () => ({
	approveArticleVisual: (...args: unknown[]) => mockApproveArticleVisual(...args),
}));
vi.mock("@/features/content-intelligence/visuals/articleVisualGenerationService", () => ({
	generateArticleVisualCandidate: vi.fn(),
}));
vi.mock("@/features/content-intelligence/visuals/articleVisualDeletionService", () => ({
	deleteArticleVisual: vi.fn(),
}));

const mockRecordRefreshIfEligible = vi.fn();
vi.mock("@/features/content-intelligence/refresh/refreshLog", () => ({
	recordRefreshIfEligible: (id: string, context: unknown) => mockRecordRefreshIfEligible(id, context),
}));

const { updateArticleAction } = await import("../insightsCms");

const ARTICLE_ID = "11111111-1111-4111-8111-111111111111";

function baseFormData(extra: Record<string, string> = {}) {
	const fd = new FormData();
	fd.set("bodyJson", "[]");
	fd.set("locale", "en");
	fd.set("slug", "edge-caching");
	for (const [key, value] of Object.entries(extra)) fd.set(key, value);
	return fd;
}

beforeEach(() => {
	mockUpdateArticle.mockReset();
	mockGetArticleForAdmin.mockReset().mockResolvedValue({ updatedAt: "2025-05-01T00:00:00.000Z" });
	mockRecordRefreshIfEligible.mockReset().mockResolvedValue({ ok: true, created: true });
});

describe("updateArticleAction and refresh logging", () => {
	it("a normal save (no refreshIntent) never reads the pre-save article state and never attempts to log a refresh", async () => {
		mockUpdateArticle.mockResolvedValue({ ok: true, id: ARTICLE_ID });

		const result = await updateArticleAction(ARTICLE_ID, { status: "idle" }, baseFormData());

		expect(result.status).toBe("success");
		expect(mockGetArticleForAdmin).not.toHaveBeenCalled();
		expect(mockRecordRefreshIfEligible).not.toHaveBeenCalled();
	});

	it("a failed save never attempts to log a refresh, even with refreshIntent set", async () => {
		mockUpdateArticle.mockResolvedValue({ ok: false, kind: "persistence", message: "db down" });

		const result = await updateArticleAction(ARTICLE_ID, { status: "idle" }, baseFormData({ refreshIntent: "1" }));

		expect(result.status).toBe("error");
		expect(mockRecordRefreshIfEligible).not.toHaveBeenCalled();
	});

	it("a failed validation save never attempts to log a refresh", async () => {
		mockUpdateArticle.mockResolvedValue({ ok: false, kind: "validation", fieldErrors: { title: "Too short." } });

		await updateArticleAction(ARTICLE_ID, { status: "idle" }, baseFormData({ refreshIntent: "1" }));

		expect(mockRecordRefreshIfEligible).not.toHaveBeenCalled();
	});

	it("reads the article's updated_at BEFORE calling updateArticle, and passes that pre-save value through -- not whatever updateArticle leaves behind", async () => {
		const callOrder: string[] = [];
		mockGetArticleForAdmin.mockImplementation(async () => {
			callOrder.push("read-before");
			return { updatedAt: "2025-05-01T00:00:00.000Z" }; // the pre-refresh value
		});
		mockUpdateArticle.mockImplementation(async () => {
			callOrder.push("update"); // this is what bumps updated_at in the real DB
			return { ok: true, id: ARTICLE_ID };
		});

		await updateArticleAction(ARTICLE_ID, { status: "idle" }, baseFormData({ refreshIntent: "1" }));

		expect(callOrder).toEqual(["read-before", "update"]);
		expect(mockRecordRefreshIfEligible).toHaveBeenCalledTimes(1);
		const [calledId, context] = mockRecordRefreshIfEligible.mock.calls[0] as [string, { articleUpdatedAtBefore: string; triggeredAt: Date }];
		expect(calledId).toBe(ARTICLE_ID);
		expect(context.articleUpdatedAtBefore).toBe("2025-05-01T00:00:00.000Z");
	});

	it("captures triggeredAt right after the save succeeds -- a real Date, server-derived, never from the form", async () => {
		mockUpdateArticle.mockResolvedValue({ ok: true, id: ARTICLE_ID });
		const before = Date.now();

		await updateArticleAction(ARTICLE_ID, { status: "idle" }, baseFormData({ refreshIntent: "1" }));
		const after = Date.now();

		const [, context] = mockRecordRefreshIfEligible.mock.calls[0] as [string, { triggeredAt: Date }];
		expect(context.triggeredAt).toBeInstanceOf(Date);
		expect(context.triggeredAt.getTime()).toBeGreaterThanOrEqual(before);
		expect(context.triggeredAt.getTime()).toBeLessThanOrEqual(after);
	});

	it("skips logging (rather than passing a bad context) if the pre-save article read comes back empty", async () => {
		mockGetArticleForAdmin.mockResolvedValue(null);
		mockUpdateArticle.mockResolvedValue({ ok: true, id: ARTICLE_ID });

		const result = await updateArticleAction(ARTICLE_ID, { status: "idle" }, baseFormData({ refreshIntent: "1" }));

		expect(result.status).toBe("success"); // the article save itself still succeeded
		expect(mockRecordRefreshIfEligible).not.toHaveBeenCalled();
	});

	it("repeated successful saves in the same refresh session each call recordRefreshIfEligible, which itself is the idempotency guard", async () => {
		mockUpdateArticle.mockResolvedValue({ ok: true, id: ARTICLE_ID });

		await updateArticleAction(ARTICLE_ID, { status: "idle" }, baseFormData({ refreshIntent: "1" }));
		mockRecordRefreshIfEligible.mockResolvedValueOnce({ ok: true, created: false }); // second save: already pending
		await updateArticleAction(ARTICLE_ID, { status: "idle" }, baseFormData({ refreshIntent: "1" }));

		expect(mockRecordRefreshIfEligible).toHaveBeenCalledTimes(2);
		// The action itself doesn't dedupe -- recordRefreshIfEligible's own
		// pending-episode check (refreshLog.test.ts) is what makes the
		// second call a no-op, verified there.
	});

	it("a failure in recordRefreshIfEligible never fails the already-successful article save", async () => {
		mockUpdateArticle.mockResolvedValue({ ok: true, id: ARTICLE_ID });
		mockRecordRefreshIfEligible.mockResolvedValue({ ok: false, kind: "persistence", message: "log insert failed" });

		const result = await updateArticleAction(ARTICLE_ID, { status: "idle" }, baseFormData({ refreshIntent: "1" }));

		expect(result.status).toBe("success");
	});
});
