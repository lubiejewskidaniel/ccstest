import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Article } from "@/features/insights/types/article";
import type { ArticleVisualBrief } from "../articleVisualBrief";
import type { ArticleVisualCandidate } from "../articleVisualStorage";
import type { ArticleVisualProvider, GeneratedArticleVisual } from "../ArticleVisualProvider";

/**
 * Phase 3C.4B.5B — coverage for the orchestration service that connects
 * `buildArticleVisualBrief()` -> `ArticleVisualProvider.generate()` ->
 * `storeGeneratedArticleVisual()`. Every collaborator is mocked
 * (`@/lib/supabase/server`, `@/lib/supabase/adminAuth`,
 * `@/features/insights/cms/queries`, `../OpenAiArticleVisualProvider`,
 * `../articleVisualStorageService`) — no real Supabase, no real OpenAI
 * request, ever, in this file. `buildArticleVisualBrief` itself is NOT
 * mocked: it's pure and already covered by its own test file, so
 * exercising it for real here is what proves the article-context ->
 * brief wiring is correct end to end.
 */

const mockCreateSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: () => mockCreateSupabaseServerClient(),
}));

const mockGetAdminSession = vi.fn();
vi.mock("@/lib/supabase/adminAuth", () => ({
	getAdminSession: () => mockGetAdminSession(),
}));

const mockGetArticleForAdmin = vi.fn();
vi.mock("@/features/insights/cms/queries", () => ({
	getArticleForAdmin: (id: string) => mockGetArticleForAdmin(id),
}));

const mockCreateOpenAiArticleVisualProvider = vi.fn();
vi.mock("../OpenAiArticleVisualProvider", () => ({
	createOpenAiArticleVisualProvider: () => mockCreateOpenAiArticleVisualProvider(),
}));

const mockStoreGeneratedArticleVisual = vi.fn();
vi.mock("../articleVisualStorageService", () => ({
	storeGeneratedArticleVisual: (input: unknown) => mockStoreGeneratedArticleVisual(input),
}));

const { generateArticleVisualCandidate } = await import("../articleVisualGenerationService");

const EDITOR_SESSION = { userId: "u1", email: "editor@example.com", roles: ["editor"], isAdmin: false, isEditor: true };
const NON_EDITOR_SESSION = { userId: "u2", email: "viewer@example.com", roles: [], isAdmin: false, isEditor: false };

const ARTICLE_ID = "11111111-1111-4111-8111-111111111111";
const FAKE_SUPABASE = { marker: "fake-supabase-client" };

const BASE_ARTICLE: Article = {
	id: ARTICLE_ID,
	locale: "en",
	slug: "how-we-cut-build-times-in-half",
	translationOf: null,
	category: { id: "cat-1", key: "build", slug: "build", name: "Build", description: null, sortOrder: 0 },
	tags: [],
	title: "How We Cut Build Times in Half",
	excerpt: "A sufficiently long excerpt for the visual brief to succeed, comfortably over twenty characters.",
	coverImageUrl: null,
	coverImageAlt: null,
	coverImageStatus: "missing",
	body: [{ type: "paragraph", text: "This body text must never reach the image provider." }],
	readingMinutes: 6,
	authorName: "CCS Team",
	status: "draft",
	scheduledAt: null,
	publishedAt: null,
	seoTitle: null,
	seoDescription: "This SEO description must never reach the image provider either.",
	source: "human",
	featured: false,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

function fakeProvider(overrides: Partial<ArticleVisualProvider> = {}): ArticleVisualProvider {
	return {
		id: "openai",
		isConfigured: () => true,
		generate: vi.fn(async () => successfulGeneration()),
		...overrides,
	};
}

function successfulGeneration(): { ok: true; visual: GeneratedArticleVisual } {
	return {
		ok: true,
		visual: { data: { kind: "bytes", data: new Uint8Array([1, 2, 3]) }, mimeType: "image/png", width: 1600, height: 896 },
	};
}

const STORED_CANDIDATE: ArticleVisualCandidate = {
	articleId: ARTICLE_ID,
	visualId: "22222222-2222-4222-8222-222222222222",
	storagePath: `${ARTICLE_ID}/22222222-2222-4222-8222-222222222222.png`,
	altText: 'Cover illustration for the article "How We Cut Build Times in Half"',
	sourceType: "generated",
	provider: "openai",
	width: 1600,
	height: 896,
	mimeType: "image/png",
	createdAt: "2026-01-01T00:00:00.000Z",
};

function setHappyPathMocks(overrides: { provider?: ArticleVisualProvider; article?: Article | null } = {}) {
	mockCreateSupabaseServerClient.mockResolvedValue(FAKE_SUPABASE);
	mockGetAdminSession.mockResolvedValue(EDITOR_SESSION);
	mockGetArticleForAdmin.mockResolvedValue(overrides.article === undefined ? BASE_ARTICLE : overrides.article);
	mockCreateOpenAiArticleVisualProvider.mockReturnValue(overrides.provider ?? fakeProvider());
	mockStoreGeneratedArticleVisual.mockResolvedValue({ ok: true, candidate: STORED_CANDIDATE });
}

describe("generateArticleVisualCandidate", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	// 1. Supabase not configured -> no provider call
	it("1. returns not_configured and never calls the provider when Supabase isn't configured", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(null);
		const result = await generateArticleVisualCandidate(ARTICLE_ID);
		expect(result).toEqual({ ok: false, kind: "not_configured", message: expect.any(String) });
		expect(mockCreateOpenAiArticleVisualProvider).not.toHaveBeenCalled();
		expect(mockGetAdminSession).not.toHaveBeenCalled();
	});

	// 2. unauthenticated -> no provider call
	it("2. returns auth and never calls the provider when there is no session", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(FAKE_SUPABASE);
		mockGetAdminSession.mockResolvedValue(null);
		const result = await generateArticleVisualCandidate(ARTICLE_ID);
		expect(result).toEqual({ ok: false, kind: "auth", message: expect.any(String) });
		expect(mockCreateOpenAiArticleVisualProvider).not.toHaveBeenCalled();
	});

	// 3. non-editor -> no provider call
	it("3. returns auth and never calls the provider for a non-editor session", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(FAKE_SUPABASE);
		mockGetAdminSession.mockResolvedValue(NON_EDITOR_SESSION);
		const result = await generateArticleVisualCandidate(ARTICLE_ID);
		expect(result).toEqual({ ok: false, kind: "auth", message: expect.any(String) });
		expect(mockCreateOpenAiArticleVisualProvider).not.toHaveBeenCalled();
	});

	// 4. invalid article id -> no provider call
	it("4. returns validation and never calls the provider for a malformed article id", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(FAKE_SUPABASE);
		mockGetAdminSession.mockResolvedValue(EDITOR_SESSION);
		const result = await generateArticleVisualCandidate("not-a-uuid");
		expect(result).toEqual({ ok: false, kind: "validation", message: expect.any(String) });
		expect(mockGetArticleForAdmin).not.toHaveBeenCalled();
		expect(mockCreateOpenAiArticleVisualProvider).not.toHaveBeenCalled();
	});

	// 5. missing article -> no provider call
	it("5. returns not_found and never calls the provider when the article does not exist", async () => {
		setHappyPathMocks({ article: null });
		const result = await generateArticleVisualCandidate(ARTICLE_ID);
		expect(result).toEqual({ ok: false, kind: "not_found", message: expect.any(String) });
		expect(mockCreateOpenAiArticleVisualProvider).not.toHaveBeenCalled();
	});

	// 6. missing/invalid category -> no provider call
	it("6. returns validation and never calls the provider when the category key is invalid", async () => {
		setHappyPathMocks({ article: { ...BASE_ARTICLE, category: { ...BASE_ARTICLE.category, key: "unknown" as Article["category"]["key"] } } });
		const result = await generateArticleVisualCandidate(ARTICLE_ID);
		expect(result).toEqual({ ok: false, kind: "validation", message: expect.any(String) });
		expect(mockCreateOpenAiArticleVisualProvider).not.toHaveBeenCalled();
	});

	// 7. insufficient visual brief -> no provider call
	it("7. returns validation and never calls the provider when the excerpt is too short", async () => {
		setHappyPathMocks({ article: { ...BASE_ARTICLE, excerpt: "too short" } });
		const result = await generateArticleVisualCandidate(ARTICLE_ID);
		expect(result).toEqual({ ok: false, kind: "validation", message: expect.any(String) });
		expect(mockCreateOpenAiArticleVisualProvider).not.toHaveBeenCalled();
	});

	// 8. provider not configured -> no generate call
	it("8. returns not_configured and never calls generate() when the provider isn't configured", async () => {
		const provider = fakeProvider({ isConfigured: () => false, generate: vi.fn() });
		setHappyPathMocks({ provider });
		const result = await generateArticleVisualCandidate(ARTICLE_ID);
		expect(result).toEqual({ ok: false, kind: "not_configured", message: expect.any(String) });
		expect(provider.generate).not.toHaveBeenCalled();
	});

	// 9. successful article context builds ArticleVisualBrief
	// 10. only approved ArticleVisualBrief fields reach provider
	// 11. body is never forwarded to provider
	// 12. article id is never forwarded to provider prompt/input
	it("9-12. builds a correct ArticleVisualBrief from the article and forwards only that to the provider", async () => {
		const provider = fakeProvider();
		setHappyPathMocks({ provider });
		await generateArticleVisualCandidate(ARTICLE_ID);

		expect(provider.generate).toHaveBeenCalledTimes(1);
		const [brief] = (provider.generate as ReturnType<typeof vi.fn>).mock.calls[0] as [ArticleVisualBrief, unknown];

		expect(brief.subject).toBe(BASE_ARTICLE.title);
		expect(brief.categoryKey).toBe(BASE_ARTICLE.category.key);
		expect(brief.locale).toBe(BASE_ARTICLE.locale);
		expect(brief.altText).toContain(BASE_ARTICLE.title);

		// Only the approved brief fields exist on the object passed to the provider.
		expect(Object.keys(brief).sort()).toEqual(["altText", "avoidElements", "categoryKey", "locale", "requiredElements", "subject"]);

		const serializedBrief = JSON.stringify(brief);
		expect(serializedBrief).not.toContain("must never reach the image provider");
		expect(serializedBrief).not.toContain(ARTICLE_ID);
		expect(serializedBrief).not.toContain(BASE_ARTICLE.seoDescription);
	});

	// 13. provider.generate called exactly once
	it("13. calls provider.generate exactly once per invocation", async () => {
		const provider = fakeProvider();
		setHappyPathMocks({ provider });
		await generateArticleVisualCandidate(ARTICLE_ID);
		expect(provider.generate).toHaveBeenCalledTimes(1);
	});

	// 14. canonical options are width=1600 height=900
	it("14. always requests the canonical width=1600 height=900 options", async () => {
		const provider = fakeProvider();
		setHappyPathMocks({ provider });
		await generateArticleVisualCandidate(ARTICLE_ID);
		const [, options] = (provider.generate as ReturnType<typeof vi.fn>).mock.calls[0] as [unknown, { width: number; height: number }];
		expect(options).toEqual({ width: 1600, height: 900 });
	});

	// 15. provider success flows into storeGeneratedArticleVisual
	// 16. provider id passed to storage
	// 17. same ArticleVisualBrief passed to storage
	// 18. generated visual passed unchanged to storage
	it("15-18. passes the provider's id, the same brief, and the unchanged visual into storage", async () => {
		const generation = successfulGeneration();
		const provider = fakeProvider({ id: "openai", generate: vi.fn(async () => generation) });
		setHappyPathMocks({ provider });
		await generateArticleVisualCandidate(ARTICLE_ID);

		expect(mockStoreGeneratedArticleVisual).toHaveBeenCalledTimes(1);
		const storeInput = mockStoreGeneratedArticleVisual.mock.calls[0]?.[0];
		expect(storeInput.articleId).toBe(ARTICLE_ID);
		expect(storeInput.providerId).toBe("openai");
		expect(storeInput.visual).toBe(generation.visual);
		expect(storeInput.brief.subject).toBe(BASE_ARTICLE.title);
	});

	// 19. generated candidate alt originates from ArticleVisualBrief
	it("19. never fabricates a second alt text -- the brief's altText is what storage receives", async () => {
		setHappyPathMocks();
		await generateArticleVisualCandidate(ARTICLE_ID);
		const storeInput = mockStoreGeneratedArticleVisual.mock.calls[0]?.[0];
		expect(storeInput.brief.altText).toBe('Cover illustration for the article "How We Cut Build Times in Half"');
	});

	// 20. provider_error -> storage never called
	it("20. maps provider_error and never calls storage", async () => {
		const provider = fakeProvider({ generate: vi.fn(async () => ({ ok: false as const, kind: "provider_error" as const, message: "boom" })) });
		setHappyPathMocks({ provider });
		const result = await generateArticleVisualCandidate(ARTICLE_ID);
		expect(result).toEqual({ ok: false, kind: "provider_error", message: "boom" });
		expect(mockStoreGeneratedArticleVisual).not.toHaveBeenCalled();
	});

	// 21. invalid_response -> storage never called
	it("21. maps invalid_response and never calls storage", async () => {
		const provider = fakeProvider({ generate: vi.fn(async () => ({ ok: false as const, kind: "invalid_response" as const, message: "bad body" })) });
		setHappyPathMocks({ provider });
		const result = await generateArticleVisualCandidate(ARTICLE_ID);
		expect(result).toEqual({ ok: false, kind: "invalid_response", message: "bad body" });
		expect(mockStoreGeneratedArticleVisual).not.toHaveBeenCalled();
	});

	// 22. budget_exceeded -> storage never called
	it("22. maps budget_exceeded and never calls storage", async () => {
		const provider = fakeProvider({ generate: vi.fn(async () => ({ ok: false as const, kind: "budget_exceeded" as const, message: "over budget" })) });
		setHappyPathMocks({ provider });
		const result = await generateArticleVisualCandidate(ARTICLE_ID);
		expect(result).toEqual({ ok: false, kind: "budget_exceeded", message: "over budget" });
		expect(mockStoreGeneratedArticleVisual).not.toHaveBeenCalled();
	});

	// 23. storage failure -> no retry generation
	it("23. maps a storage failure to storage_error without retrying generation", async () => {
		const provider = fakeProvider();
		setHappyPathMocks({ provider });
		mockStoreGeneratedArticleVisual.mockResolvedValue({ ok: false, kind: "storage_error", message: "Could not upload the image to storage." });
		const result = await generateArticleVisualCandidate(ARTICLE_ID);
		expect(result).toEqual({ ok: false, kind: "storage_error", message: "Could not upload the image to storage." });
		expect(provider.generate).toHaveBeenCalledTimes(1);
	});

	// 24. success returns ArticleVisualCandidate
	// 25. success candidate remains pending_review (ArticleVisualCandidate carries no status field at all -- see articleVisualStorage.ts)
	it("24-25. a successful call returns the stored ArticleVisualCandidate as-is", async () => {
		setHappyPathMocks();
		const result = await generateArticleVisualCandidate(ARTICLE_ID);
		expect(result).toEqual({ ok: true, candidate: STORED_CANDIDATE });
		if (result.ok) {
			expect(result.candidate).not.toHaveProperty("status");
		}
	});

	// 26. existing approved cover is never modified by orchestration
	// 27. existing pending candidates are never superseded
	it("26-27. never touches cover/approval state itself -- that is entirely storeGeneratedArticleVisual's job", async () => {
		setHappyPathMocks({ article: { ...BASE_ARTICLE, status: "published", coverImageStatus: "approved", coverImageUrl: "https://example.com/existing.png", coverImageAlt: "Existing cover" } });
		const result = await generateArticleVisualCandidate(ARTICLE_ID);
		expect(result.ok).toBe(true);
		// The orchestration service itself never writes to insights_articles/article_visuals --
		// confirmed structurally below (#28-#31) -- so there is nothing here that COULD supersede
		// or modify an existing approved cover; storage is the only write path, and it is mocked.
		expect(mockStoreGeneratedArticleVisual).toHaveBeenCalledTimes(1);
	});

	// 37. published article is allowed to generate a replacement candidate
	it("37. allows generation for an already-published article", async () => {
		setHappyPathMocks({ article: { ...BASE_ARTICLE, status: "published", publishedAt: "2026-01-02T00:00:00.000Z" } });
		const result = await generateArticleVisualCandidate(ARTICLE_ID);
		expect(result.ok).toBe(true);
	});

	// 28-33, 41: structural source checks
	const SOURCE = readFileSync(resolve(process.cwd(), "src/features/content-intelligence/visuals/articleVisualGenerationService.ts"), "utf8");
	const STRIPPED_SOURCE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

	it("28. never imports or calls the approval service", () => {
		expect(STRIPPED_SOURCE).not.toMatch(/approveArticleVisual/);
		expect(STRIPPED_SOURCE).not.toMatch(/articleVisualReviewService/);
	});

	it("29. never imports or calls a publish/status-transition function", () => {
		expect(STRIPPED_SOURCE).not.toMatch(/transitionArticleStatus/);
		expect(STRIPPED_SOURCE).not.toMatch(/insightsCms/);
	});

	it("30. never imports the privileged/service-role Supabase client", () => {
		expect(STRIPPED_SOURCE).not.toMatch(/createSupabasePrivilegedClient/);
		expect(STRIPPED_SOURCE).not.toMatch(/service.?role/i);
	});

	it("31. never calls fetch directly -- only the provider owns OpenAI network I/O", () => {
		expect(STRIPPED_SOURCE).not.toMatch(/\bfetch\(/);
	});

	it("32. never imports a scheduler/cron module", () => {
		expect(STRIPPED_SOURCE).not.toMatch(/cron/i);
		expect(STRIPPED_SOURCE).not.toMatch(/scheduler/i);
	});

	it("33. contains no loop construct around the provider call (no automatic retry)", () => {
		expect(STRIPPED_SOURCE).not.toMatch(/\bfor\s*\(/);
		expect(STRIPPED_SOURCE).not.toMatch(/\bwhile\s*\(/);
		expect(STRIPPED_SOURCE).not.toMatch(/\.retry\(/);
	});

	// 34. no raw provider response returned
	// 35. no image bytes/base64 returned from orchestration result
	it("34-35. a successful result never carries raw provider data, bytes, or base64", async () => {
		setHappyPathMocks();
		const result = await generateArticleVisualCandidate(ARTICLE_ID);
		const serialized = JSON.stringify(result);
		expect(serialized).not.toMatch(/b64_json/);
		expect(serialized).not.toMatch(/data:image/);
		expect(result.ok && "data" in result.candidate).toBe(false);
	});

	// 36. one explicit invocation creates at most one candidate
	it("36. one invocation results in exactly one storeGeneratedArticleVisual call", async () => {
		setHappyPathMocks();
		await generateArticleVisualCandidate(ARTICLE_ID);
		expect(mockStoreGeneratedArticleVisual).toHaveBeenCalledTimes(1);
	});

	// 38. provider configuration failure is safe/non-leaking
	it("38. a provider not_configured message never leaks an API key or internal detail", async () => {
		const provider = fakeProvider({ isConfigured: () => false, generate: vi.fn() });
		setHappyPathMocks({ provider });
		const result = await generateArticleVisualCandidate(ARTICLE_ID);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.message).not.toMatch(/sk-|api[_-]?key/i);
		}
	});

	// 39. storage error is safe/non-leaking
	it("39. a storage error message is forwarded as-is and contains no raw database detail", async () => {
		setHappyPathMocks();
		mockStoreGeneratedArticleVisual.mockResolvedValue({ ok: false, kind: "database_error", message: "Could not save this visual candidate. The uploaded image has been removed." });
		const result = await generateArticleVisualCandidate(ARTICLE_ID);
		expect(result).toEqual({ ok: false, kind: "storage_error", message: "Could not save this visual candidate. The uploaded image has been removed." });
		if (!result.ok) {
			expect(result.message).not.toMatch(/postgres|pg_|relation ".*" does not exist/i);
		}
	});

	// 40. deterministic orchestration input for the same article state
	it("40. produces an identical brief and options for the same article state across two calls", async () => {
		const provider = fakeProvider();
		setHappyPathMocks({ provider });
		await generateArticleVisualCandidate(ARTICLE_ID);
		await generateArticleVisualCandidate(ARTICLE_ID);
		const calls = (provider.generate as ReturnType<typeof vi.fn>).mock.calls;
		expect(JSON.stringify(calls[0])).toBe(JSON.stringify(calls[1]));
	});
});
