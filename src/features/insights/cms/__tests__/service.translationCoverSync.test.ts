import { describe, it, expect, vi, beforeEach } from "vitest";

// createArticle/updateArticle call sync_linked_translation_cover
// whenever the saved article has a non-null translationOf, on every
// save, not only when the link changes - this lets a save retry a
// sync that failed on an earlier save. The actual propagation logic
// lives in the sync_linked_translation_cover and approve_article_visual
// Postgres functions (supabase/migrations/015_translation_cover_sync.sql)
// - this file only proves the trigger conditions from the application
// side.

const mockGetAdminSession = vi.fn();
vi.mock("@/lib/supabase/adminAuth", () => ({
	getAdminSession: () => mockGetAdminSession(),
}));

const mockCreateSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: () => mockCreateSupabaseServerClient(),
}));

const { createArticle, updateArticle } = await import("../service");

const EDITOR_SESSION = {
	userId: "u1",
	email: "editor@example.com",
	roles: ["editor"],
	isAdmin: false,
	isEditor: true,
};

const ARTICLE_ID = "11111111-1111-4111-8111-111111111111";
const CATEGORY_ID = "22222222-2222-4222-8222-222222222222";
const TRANSLATION_ID = "33333333-3333-4333-8333-333333333333";

function fakeSupabase() {
	const insertSelect = vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: ARTICLE_ID }, error: null })) }));
	const insert = vi.fn((_row: Record<string, unknown>) => ({ select: insertSelect }));

	const updateEq = vi.fn(async () => ({ error: null }));
	const update = vi.fn((_row: Record<string, unknown>) => ({ eq: updateEq }));

	const deleteEq = vi.fn(async () => ({ error: null }));
	const del = vi.fn(() => ({ eq: deleteEq }));

	const rpc = vi.fn(async () => ({ data: null, error: null }));

	return { from: vi.fn((_table: string) => ({ insert, update, delete: del })), rpc };
}

function validArticleInput(overrides: Record<string, unknown> = {}) {
	return {
		locale: "en",
		slug: "custom-software-vs-saas",
		translationOf: "",
		categoryId: CATEGORY_ID,
		tagIds: [],
		title: "A perfectly valid article title",
		excerpt: "This excerpt is long enough to clear the twenty character minimum easily.",
		body: [],
		readingMinutes: "",
		authorName: "Jane Editor",
		status: "in_review",
		scheduledAt: "",
		seoTitle: "",
		seoDescription: "",
		featured: false,
		...overrides,
	};
}

beforeEach(() => {
	mockGetAdminSession.mockReset().mockResolvedValue(EDITOR_SESSION);
	mockCreateSupabaseServerClient.mockReset();
});

describe("createArticle - new translation link", () => {
	it("calls sync_linked_translation_cover for the new article when translationOf is set", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		await createArticle(validArticleInput({ translationOf: TRANSLATION_ID }));

		expect(supabase.rpc).toHaveBeenCalledWith("sync_linked_translation_cover", { p_article_id: ARTICLE_ID });
	});

	it("does not call sync_linked_translation_cover when translationOf is empty", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		await createArticle(validArticleInput());

		expect(supabase.rpc).not.toHaveBeenCalled();
	});
});

describe("updateArticle - translation link present", () => {
	it("calls sync_linked_translation_cover when translationOf is newly set", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		await updateArticle(ARTICLE_ID, validArticleInput({ translationOf: TRANSLATION_ID }));

		expect(supabase.rpc).toHaveBeenCalledWith("sync_linked_translation_cover", { p_article_id: ARTICLE_ID });
	});

	it("calls sync_linked_translation_cover again on a later save with the same translation link, so a save can retry a sync that failed before", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		await updateArticle(ARTICLE_ID, validArticleInput({ translationOf: TRANSLATION_ID }));
		await updateArticle(ARTICLE_ID, validArticleInput({ translationOf: TRANSLATION_ID }));

		expect(supabase.rpc).toHaveBeenCalledTimes(2);
		expect(supabase.rpc).toHaveBeenNthCalledWith(1, "sync_linked_translation_cover", { p_article_id: ARTICLE_ID });
		expect(supabase.rpc).toHaveBeenNthCalledWith(2, "sync_linked_translation_cover", { p_article_id: ARTICLE_ID });
	});

	it("retries the sync on the next save after the sync call failed on a previous save", async () => {
		const supabase = fakeSupabase();
		supabase.rpc.mockRejectedValueOnce(new Error("connection reset"));
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const first = await updateArticle(ARTICLE_ID, validArticleInput({ translationOf: TRANSLATION_ID }));
		expect(first.ok).toBe(true);

		const second = await updateArticle(ARTICLE_ID, validArticleInput({ translationOf: TRANSLATION_ID }));
		expect(second.ok).toBe(true);

		expect(supabase.rpc).toHaveBeenCalledTimes(2);
	});

	it("does not call sync_linked_translation_cover when there is no translation link", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		await updateArticle(ARTICLE_ID, validArticleInput());

		expect(supabase.rpc).not.toHaveBeenCalled();
	});

	it("does not call sync_linked_translation_cover when unlinking (translationOf cleared)", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		await updateArticle(ARTICLE_ID, validArticleInput({ translationOf: TRANSLATION_ID }));
		await updateArticle(ARTICLE_ID, validArticleInput({ translationOf: "" }));

		expect(supabase.rpc).toHaveBeenCalledTimes(1);
	});

	it("still succeeds even when the sync call fails", async () => {
		const supabase = fakeSupabase();
		supabase.rpc.mockRejectedValue(new Error("connection reset"));
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await updateArticle(ARTICLE_ID, validArticleInput({ translationOf: TRANSLATION_ID }));

		expect(result.ok).toBe(true);
	});

	it("still never sends cover_image_url, cover_image_alt or cover_image_status in the update payload when linking a translation", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		await updateArticle(ARTICLE_ID, validArticleInput({ translationOf: TRANSLATION_ID }));

		const updatedRow = supabase.from("insights_articles").update.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
		expect(Object.prototype.hasOwnProperty.call(updatedRow, "cover_image_url")).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(updatedRow, "cover_image_alt")).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(updatedRow, "cover_image_status")).toBe(false);
	});
});
