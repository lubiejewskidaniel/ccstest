import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression coverage for the public Insights content-visibility fix:
 * every public read in `../queries` must explicitly request
 * `status = "published"` from the database, as defence-in-depth on top
 * of (never instead of) the "public select published" RLS policy. These
 * tests assert the query the code actually constructs (the `.eq()` calls
 * sent to the fake Supabase builder below) — same mocking convention as
 * `content-intelligence/market/__tests__/queries.test.ts` — so a future
 * edit that drops the filter fails here even though the fake builder
 * itself does no real filtering.
 */

const mockCreateSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: () => mockCreateSupabaseServerClient(),
}));

const {
	getPublishedArticleBySlug,
	listPublishedArticles,
	listFeaturedArticles,
	searchPublishedArticles,
	listPublishedArticlesForFeed,
	getArticleTranslation,
} = await import("../queries");

type Result = { data: unknown; error: { message: string } | null; count?: number };

/** A minimal but mapper-shaped row — `mapArticle`/`mapArticleSummary`
 * require a joined category to not discard the row as bad data. */
const RAW_CATEGORY = {
	id: "cat-1",
	key: "build",
	slug_en: "build",
	slug_pl: "buduj",
	name_en: "Build",
	name_pl: "Buduj",
	description_en: null,
	description_pl: null,
	sort_order: 1,
};

function rawArticleRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "article-1",
		locale: "en",
		slug: "custom-software-vs-saas",
		translation_of: null,
		category: RAW_CATEGORY,
		insights_article_tags: [],
		title: "Custom Software vs SaaS",
		excerpt: "A decision guide.",
		cover_image_url: null,
		cover_image_alt: null,
		cover_image_status: "approved",
		body: [],
		reading_minutes: 5,
		author_name: "CCS Editorial",
		status: "published",
		scheduled_at: null,
		published_at: "2026-01-01T00:00:00.000Z",
		seo_title: null,
		seo_description: null,
		source: "human",
		featured: false,
		created_at: "2026-01-01T00:00:00.000Z",
		updated_at: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

/** A stand-in for a Supabase PostgREST query builder: every chain method
 * records its call and returns the same builder, and the builder itself
 * is thenable (so `await query` and `await query.maybeSingle()` both
 * resolve to `result`) — matching how `../queries` uses the real client. */
function queryResult(data: unknown, error: { message: string } | null = null, count?: number) {
	const result: Result = { data, error, count };
	const builder: {
		select: ReturnType<typeof vi.fn>;
		eq: ReturnType<typeof vi.fn>;
		or: ReturnType<typeof vi.fn>;
		order: ReturnType<typeof vi.fn>;
		range: ReturnType<typeof vi.fn>;
		limit: ReturnType<typeof vi.fn>;
		maybeSingle: ReturnType<typeof vi.fn>;
		then: (onFulfilled: (value: Result) => unknown, onRejected?: (reason: unknown) => unknown) => unknown;
	} = {
		select: vi.fn(() => builder),
		eq: vi.fn(() => builder),
		or: vi.fn(() => builder),
		order: vi.fn(() => builder),
		range: vi.fn(() => builder),
		limit: vi.fn(() => builder),
		maybeSingle: vi.fn(() => Promise.resolve(result)),
		then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
	};
	return builder;
}

function fakeSupabase(builder: ReturnType<typeof queryResult>) {
	return { from: vi.fn(() => builder) };
}

function eqCalls(builder: ReturnType<typeof queryResult>): unknown[][] {
	return (builder.eq as ReturnType<typeof vi.fn>).mock.calls;
}

beforeEach(() => {
	mockCreateSupabaseServerClient.mockReset();
});

describe("getPublishedArticleBySlug", () => {
	it("requests status = published", async () => {
		const builder = queryResult(rawArticleRow());
		mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase(builder));

		await getPublishedArticleBySlug("en", "custom-software-vs-saas");

		expect(eqCalls(builder)).toContainEqual(["status", "published"]);
	});
});

describe("listPublishedArticles", () => {
	it("requests status = published", async () => {
		const builder = queryResult([rawArticleRow()], null, 1);
		mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase(builder));

		await listPublishedArticles("en");

		expect(eqCalls(builder)).toContainEqual(["status", "published"]);
	});
});

describe("listFeaturedArticles", () => {
	it("requests status = published", async () => {
		const builder = queryResult([rawArticleRow({ featured: true })]);
		mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase(builder));

		await listFeaturedArticles("en");

		expect(eqCalls(builder)).toContainEqual(["status", "published"]);
	});
});

describe("searchPublishedArticles", () => {
	it("requests status = published", async () => {
		const builder = queryResult([rawArticleRow()]);
		mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase(builder));

		await searchPublishedArticles("en", "software");

		expect(eqCalls(builder)).toContainEqual(["status", "published"]);
	});
});

describe("listPublishedArticlesForFeed", () => {
	it("requests status = published", async () => {
		const builder = queryResult([rawArticleRow()]);
		mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase(builder));

		await listPublishedArticlesForFeed("en");

		expect(eqCalls(builder)).toContainEqual(["status", "published"]);
	});

	it("still drops a row with no published_at, preserving the existing safety filter", async () => {
		const builder = queryResult([
			rawArticleRow({ published_at: null }),
			rawArticleRow({ slug: "second", published_at: "2026-02-01T00:00:00.000Z" }),
		]);
		mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase(builder));

		const rows = await listPublishedArticlesForFeed("en");

		expect(rows).toHaveLength(1);
		expect(rows[0]?.slug).toBe("second");
	});
});

describe("getArticleTranslation", () => {
	it("requests status = published on direction 1 (this article points at its translation)", async () => {
		const builder = queryResult(rawArticleRow({ id: "translation-1", locale: "pl" }));
		mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase(builder));

		const article = { ...rawMappedArticle(), translationOf: "translation-1" };
		await getArticleTranslation(article);

		expect(eqCalls(builder)).toContainEqual(["status", "published"]);
	});

	it("requests status = published on direction 2 (the other article points back at this one)", async () => {
		const builder = queryResult(null);
		mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase(builder));

		const article = { ...rawMappedArticle(), translationOf: null };
		await getArticleTranslation(article);

		expect(eqCalls(builder)).toContainEqual(["status", "published"]);
	});
});

/** A minimal mapped `Article` — only the fields `getArticleTranslation`
 * itself reads (`locale`, `translationOf`, `id`) are meaningful here. */
function rawMappedArticle() {
	return {
		id: "article-1",
		locale: "en" as const,
		slug: "custom-software-vs-saas",
		translationOf: null as string | null,
		category: { id: "cat-1", key: "build" as const, slug: "build", name: "Build", description: null, sortOrder: 1 },
		tags: [],
		title: "Custom Software vs SaaS",
		excerpt: "A decision guide.",
		coverImageUrl: null,
		coverImageAlt: null,
		coverImageStatus: "approved" as const,
		body: [],
		readingMinutes: 5,
		authorName: "CCS Editorial",
		status: "published" as const,
		scheduledAt: null,
		publishedAt: "2026-01-01T00:00:00.000Z",
		seoTitle: null,
		seoDescription: null,
		source: "human" as const,
		featured: false,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
	};
}
