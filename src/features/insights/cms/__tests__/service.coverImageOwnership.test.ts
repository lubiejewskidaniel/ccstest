import { describe, it, expect, vi, beforeEach } from "vitest";

// createArticle/updateArticle must never write cover_image_url or
// cover_image_alt - those columns belong to the Article Visual approval
// workflow.

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

describe("updateArticle - cannot write managed cover fields", () => {
	it("never sends a cover_image_url key in the update payload", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await updateArticle(ARTICLE_ID, validArticleInput());

		expect(result.ok).toBe(true);
		const { update } = supabase.from("insights_articles");
		const updatedRow = update.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
		expect(updatedRow).toBeDefined();
		expect(Object.prototype.hasOwnProperty.call(updatedRow, "cover_image_url")).toBe(false);
	});

	it("never sends a cover_image_alt key in the update payload", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		await updateArticle(ARTICLE_ID, validArticleInput());

		const { update } = supabase.from("insights_articles");
		const updatedRow = update.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
		expect(Object.prototype.hasOwnProperty.call(updatedRow, "cover_image_alt")).toBe(false);
	});

	it("still omits both cover columns even when a caller submits them explicitly (e.g. a stale form) - Zod strips them before toRow() ever sees them", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		await updateArticle(
			ARTICLE_ID,
			validArticleInput({
				coverImageUrl: "https://stale.example.com/old-cover.webp",
				coverImageAlt: "Stale alt text from before an approval happened",
			}),
		);

		const { update } = supabase.from("insights_articles");
		const updatedRow = update.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
		expect(Object.prototype.hasOwnProperty.call(updatedRow, "cover_image_url")).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(updatedRow, "cover_image_alt")).toBe(false);
	});

	it("updating unrelated content (title) leaves managed cover state untouched - the update payload only ever carries ordinary content fields", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		await updateArticle(ARTICLE_ID, validArticleInput({ title: "A brand new, unrelated title" }));

		const { update } = supabase.from("insights_articles");
		const updatedRow = update.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
		expect(updatedRow?.title).toBe("A brand new, unrelated title");
		expect(Object.prototype.hasOwnProperty.call(updatedRow, "cover_image_url")).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(updatedRow, "cover_image_alt")).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(updatedRow, "cover_image_status")).toBe(false);
	});
});

describe("createArticle - cover fields are left at the database default, article creation still works", () => {
	it("succeeds for a normal new article", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await createArticle(validArticleInput({ status: "draft" }));

		expect(result.ok).toBe(true);
	});

	it("never sends a cover_image_url or cover_image_alt key on insert - a new article always starts with no managed cover, exactly like an AI-promoted article", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		await createArticle(validArticleInput({ status: "draft" }));

		const { insert } = supabase.from("insights_articles");
		const insertedRow = insert.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
		expect(insertedRow).toBeDefined();
		expect(Object.prototype.hasOwnProperty.call(insertedRow, "cover_image_url")).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(insertedRow, "cover_image_alt")).toBe(false);
	});

	it("still succeeds even if a caller submits coverImageUrl/coverImageAlt explicitly - they are silently ignored, not an error", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await createArticle(
			validArticleInput({ status: "draft", coverImageUrl: "https://example.com/cover.webp", coverImageAlt: "Some alt text" }),
		);

		expect(result.ok).toBe(true);
	});
});
