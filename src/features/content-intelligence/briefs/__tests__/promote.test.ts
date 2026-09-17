import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A2 — promotion coverage. Same mocking convention as
 * `generation/__tests__/generate.test.ts`: every collaborator is mocked
 * at the module boundary and `promoteToArticles` is exercised for real.
 */

const mockGetAdminSession = vi.fn();
vi.mock("@/lib/supabase/adminAuth", () => ({
	getAdminSession: () => mockGetAdminSession(),
}));

const mockGetBrief = vi.fn();
const mockUpdateBriefRow = vi.fn();
vi.mock("../service", () => ({
	getBrief: (id: string) => mockGetBrief(id),
	updateBriefRow: (id: string, patch: Record<string, unknown>) => mockUpdateBriefRow(id, patch),
}));

const mockCreateArticle = vi.fn();
vi.mock("@/features/insights/cms/service", () => ({
	createArticle: (input: unknown) => mockCreateArticle(input),
}));

const mockCreateSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: () => mockCreateSupabaseServerClient(),
}));

const { promoteToArticles } = await import("../promote");

const BRIEF_ID = "11111111-1111-4111-8111-111111111111";
const EDITOR_SESSION = { userId: "u1", email: "editor@example.com", roles: ["editor"], isAdmin: false, isEditor: true };

const GENERATED_DRAFT = {
	title: "A Sufficiently Long Generated Title",
	excerpt: "An excerpt that is definitely long enough to pass the length validation applied after generation.",
	slug: "a-sufficiently-long-generated-title",
	body: [
		{ type: "heading", level: 2, text: "Intro", id: "intro" },
		{ type: "paragraph", text: "Body text." },
	],
};

const LOCALIZED_DRAFT = {
	title: "Tytuł wygenerowany po polsku",
	excerpt: "Wystarczająco długi opis artykułu po polsku, spełniający wymagania walidacji długości.",
	slug: "tytul-wygenerowany-po-polsku",
	body: [
		{ type: "heading", level: 2, text: "Wstęp", id: "wstep" },
		{ type: "paragraph", text: "Treść artykułu." },
	],
};

function baseBrief(overrides: Record<string, unknown> = {}) {
	return {
		id: BRIEF_ID,
		opportunityId: null,
		primaryLocale: "en",
		categoryId: "22222222-2222-4222-8222-222222222222",
		topic: "Edge caching",
		status: "quality_passed",
		generated: GENERATED_DRAFT,
		localized: null,
		localizedLocale: null,
		qualityIssues: [],
		primaryArticleId: null,
		localizedArticleId: null,
		...overrides,
	};
}

beforeEach(() => {
	mockGetAdminSession.mockReset().mockResolvedValue(EDITOR_SESSION);
	mockGetBrief.mockReset();
	mockUpdateBriefRow.mockReset().mockResolvedValue({ ok: true });
	mockCreateArticle.mockReset();
	mockCreateSupabaseServerClient.mockReset().mockResolvedValue(null);
});

describe("A2 - an already-promoted brief cannot be re-promoted", () => {
	it("rejects with a clear validation message when the primary article already exists and there is no localized half pending", async () => {
		mockGetBrief.mockResolvedValue(baseBrief({ primaryArticleId: "article-1", localized: null, localizedArticleId: null }));

		const result = await promoteToArticles(BRIEF_ID);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.kind).toBe("validation");
			expect(result.message).toBe(
				"This brief has already been promoted. Make further content changes directly in the article editor, not by promoting again.",
			);
		}
		expect(mockCreateArticle).not.toHaveBeenCalled();
	});

	it("rejects re-promotion of a bilingual brief where both halves were already created (regenerated after a full promotion)", async () => {
		mockGetBrief.mockResolvedValue(
			baseBrief({
				primaryArticleId: "article-1",
				localized: LOCALIZED_DRAFT,
				localizedLocale: "pl",
				localizedArticleId: "article-2",
			}),
		);

		const result = await promoteToArticles(BRIEF_ID);

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.kind).toBe("validation");
		expect(mockCreateArticle).not.toHaveBeenCalled();
		// The already-promoted status is not silently reaffirmed as if
		// something new had happened.
		expect(mockUpdateBriefRow).not.toHaveBeenCalledWith(BRIEF_ID, expect.objectContaining({ status: "promoted" }));
	});

	it("does not automatically update the already-created article from newly regenerated brief content", async () => {
		mockGetBrief.mockResolvedValue(baseBrief({ primaryArticleId: "article-1", localized: null, localizedArticleId: null }));

		await promoteToArticles(BRIEF_ID);

		expect(mockCreateArticle).not.toHaveBeenCalled();
	});
});

describe("A2 - genuine partial-promotion retry remains possible", () => {
	it("does not duplicate the primary article and completes only the still-missing localized half", async () => {
		mockGetBrief.mockResolvedValue(
			baseBrief({
				primaryArticleId: "article-1", // already created on a prior attempt
				localized: LOCALIZED_DRAFT,
				localizedLocale: "pl",
				localizedArticleId: null, // still pending -- this attempt failed last time
			}),
		);
		mockCreateArticle.mockResolvedValue({ ok: true, id: "article-2" });

		const result = await promoteToArticles(BRIEF_ID);

		expect(result.ok).toBe(true);
		expect(mockCreateArticle).toHaveBeenCalledTimes(1);
		expect(mockCreateArticle.mock.calls[0]?.[0]).toMatchObject({ locale: "pl", translationOf: "article-1" });
		expect(mockUpdateBriefRow).toHaveBeenCalledWith(
			BRIEF_ID,
			expect.objectContaining({ status: "promoted", primary_article_id: "article-1", localized_article_id: "article-2" }),
		);
	});

	it("a genuine first promotion of a bilingual brief creates both articles exactly once each", async () => {
		mockGetBrief.mockResolvedValue(
			baseBrief({ primaryArticleId: null, localized: LOCALIZED_DRAFT, localizedLocale: "pl", localizedArticleId: null }),
		);
		mockCreateArticle.mockResolvedValueOnce({ ok: true, id: "article-1" }).mockResolvedValueOnce({ ok: true, id: "article-2" });

		const result = await promoteToArticles(BRIEF_ID);

		expect(result.ok).toBe(true);
		expect(mockCreateArticle).toHaveBeenCalledTimes(2);
	});

	it("a brief with no localized draft at all promotes its primary article normally on a genuine first attempt", async () => {
		mockGetBrief.mockResolvedValue(baseBrief({ primaryArticleId: null, localized: null, localizedArticleId: null }));
		mockCreateArticle.mockResolvedValue({ ok: true, id: "article-1" });

		const result = await promoteToArticles(BRIEF_ID);

		expect(result.ok).toBe(true);
		expect(mockCreateArticle).toHaveBeenCalledTimes(1);
	});
});

describe("promotion always creates in_review drafts, never publishes", () => {
	it("both created articles use status in_review", async () => {
		mockGetBrief.mockResolvedValue(
			baseBrief({ primaryArticleId: null, localized: LOCALIZED_DRAFT, localizedLocale: "pl", localizedArticleId: null }),
		);
		mockCreateArticle.mockResolvedValueOnce({ ok: true, id: "article-1" }).mockResolvedValueOnce({ ok: true, id: "article-2" });

		await promoteToArticles(BRIEF_ID);

		expect(mockCreateArticle).toHaveBeenCalledTimes(2);
		for (const call of mockCreateArticle.mock.calls) {
			expect(call[0]).toMatchObject({ status: "in_review" });
		}
	});

	it("the single-article path also uses status in_review", async () => {
		mockGetBrief.mockResolvedValue(baseBrief({ primaryArticleId: null, localized: null, localizedArticleId: null }));
		mockCreateArticle.mockResolvedValue({ ok: true, id: "article-1" });

		await promoteToArticles(BRIEF_ID);

		expect(mockCreateArticle.mock.calls[0]?.[0]).toMatchObject({ status: "in_review" });
	});
});

describe("existing preconditions unchanged", () => {
	it("still requires status quality_passed", async () => {
		mockGetBrief.mockResolvedValue(baseBrief({ status: "generated" }));

		const result = await promoteToArticles(BRIEF_ID);

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.message).toBe("Only a brief that has passed the quality gate can be promoted.");
		expect(mockCreateArticle).not.toHaveBeenCalled();
	});

	it("still requires a generated draft", async () => {
		mockGetBrief.mockResolvedValue(baseBrief({ generated: null }));

		const result = await promoteToArticles(BRIEF_ID);

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.message).toBe("No generated draft to promote.");
	});
});
