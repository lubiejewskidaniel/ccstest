import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Phase 3C.4A — coverage for the universal article-visual publication
 * gate added to `transitionArticleStatus`. Same mocking shape as
 * `service.indexnow.test.ts` (the closest existing precedent for testing
 * this exact function): mock the two Supabase-facing seams
 * (`@/lib/supabase/adminAuth`, `@/lib/supabase/server`) and a fake
 * Supabase client covering the `.select(...).eq(...).maybeSingle()` /
 * `.update(...).eq(...)` surface `transitionArticleStatus` actually
 * touches, rather than a hand-rolled real client.
 *
 * Deliberately does NOT cover upload/provider/review-UI behaviour --
 * none of that exists yet (Phase 3C.4B+). This file only exercises the
 * gate itself: draft/in_review/scheduled/archived transitions are
 * unaffected, and a transition into "published" is rejected unless the
 * row's CURRENT stored cover_image_status/url/alt (never anything the
 * caller submits on the same request -- `statusTransitionSchema` has no
 * such fields) together satisfy all three conditions.
 */

const mockGetAdminSession = vi.fn();
vi.mock("@/lib/supabase/adminAuth", () => ({
  getAdminSession: () => mockGetAdminSession(),
}));

const mockCreateSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => mockCreateSupabaseServerClient(),
}));

const { transitionArticleStatus, updateArticle, createArticle } = await import("../service");

const EDITOR_SESSION = {
  userId: "u1",
  email: "editor@example.com",
  roles: ["editor"],
  isAdmin: false,
  isEditor: true,
};

// See service.indexnow.test.ts for why these specific hex digits: Zod
// v4's `.uuid()` enforces the real version/variant nibbles.
const ARTICLE_ID = "11111111-1111-4111-8111-111111111111";
const CATEGORY_ID = "22222222-2222-4222-8222-222222222222";

type ExistingRow = {
  status: string;
  published_at: string | null;
  locale: string;
  slug: string;
  cover_image_status: string | null;
  cover_image_url: string | null;
  cover_image_alt: string | null;
} | null;

/** A minimal fake of the one Supabase surface `transitionArticleStatus`,
 * `createArticle`, and `updateArticle` touch. `selectError`, when set,
 * makes the pre-publish read itself fail (a storage-layer problem),
 * distinct from `existing` being null (a row that legitimately doesn't
 * have the columns satisfied yet) and from `updateError` (the write
 * failing after the gate has already passed). */
function fakeSupabase(
  opts: { existing?: ExistingRow; selectError?: { message: string } | null; updateError?: { message: string } | null; insertError?: { message: string } | null } = {}
) {
  const maybeSingle = vi.fn(async () => ({ data: opts.existing ?? null, error: opts.selectError ?? null }));
  const selectEq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq: selectEq }));

  const updateEq = vi.fn(async () => ({ error: opts.updateError ?? null }));
  const update = vi.fn(() => ({ eq: updateEq }));

  const deleteEq = vi.fn(async () => ({ error: null }));
  const del = vi.fn(() => ({ eq: deleteEq }));

  const insertSelect = vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: ARTICLE_ID }, error: opts.insertError ?? null })) }));
  const insert = vi.fn((_row: Record<string, unknown> | Record<string, unknown>[]) => ({ select: insertSelect }));

  return { from: vi.fn((_table: string) => ({ select, update, delete: del, insert })) };
}

function validArticleInput(overrides: Record<string, unknown> = {}) {
  return {
    locale: "en",
    slug: "my-article",
    translationOf: "",
    categoryId: CATEGORY_ID,
    tagIds: [],
    title: "A perfectly valid article title",
    excerpt: "This excerpt is long enough to clear the twenty character minimum easily.",
    coverImageUrl: "",
    coverImageAlt: "",
    body: [],
    readingMinutes: "",
    authorName: "Jane Editor",
    status: "draft",
    scheduledAt: "",
    seoTitle: "",
    seoDescription: "",
    featured: false,
    ...overrides,
  };
}

const FUTURE_ISO = new Date(Date.now() + 86_400_000).toISOString();

beforeEach(() => {
  mockGetAdminSession.mockReset().mockResolvedValue(EDITOR_SESSION);
  mockCreateSupabaseServerClient.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("transitionArticleStatus — non-published transitions are unaffected by the gate", () => {
  it("draft -> in_review succeeds with a missing visual (no image columns read at all)", async () => {
    const supabase = fakeSupabase();
    mockCreateSupabaseServerClient.mockResolvedValue(supabase);

    const result = await transitionArticleStatus({ id: ARTICLE_ID, status: "in_review" });

    expect(result.ok).toBe(true);
    // The gate's pre-publish read (`.select(...)`) only ever happens for
    // a "published" target -- a non-published transition must never
    // even query cover-image state, only write the new status.
    const { select, update } = supabase.from("insights_articles");
    expect(select).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("in_review -> archived succeeds with a missing visual", async () => {
    mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase());

    const result = await transitionArticleStatus({ id: ARTICLE_ID, status: "archived" });

    expect(result.ok).toBe(true);
  });

  it("draft -> scheduled succeeds with a missing visual", async () => {
    mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase());

    const result = await transitionArticleStatus({ id: ARTICLE_ID, status: "scheduled", scheduledAt: FUTURE_ISO });

    expect(result.ok).toBe(true);
  });
});

describe("createArticle / updateArticle — ordinary saves are unaffected by the gate", () => {
  it("createArticle succeeds for a draft with an empty cover image", async () => {
    mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase());

    const result = await createArticle(validArticleInput({ status: "draft" }));

    expect(result.ok).toBe(true);
  });

  it("updateArticle succeeds for an in_review article with an empty cover image", async () => {
    mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase());

    const result = await updateArticle(ARTICLE_ID, validArticleInput({ status: "in_review" }));

    expect(result.ok).toBe(true);
  });

  it("articleInputSchema does not require a cover image to save a draft or in_review article", async () => {
    mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase());

    const draft = await createArticle(validArticleInput({ status: "draft", coverImageUrl: "", coverImageAlt: "" }));
    const inReview = await updateArticle(ARTICLE_ID, validArticleInput({ status: "in_review", coverImageUrl: "", coverImageAlt: "" }));

    expect(draft.ok).toBe(true);
    expect(inReview.ok).toBe(true);
  });
});

describe("transitionArticleStatus — publication rejected when the gate is not satisfied", () => {
  it("rejects: status missing, url empty, alt empty", async () => {
    mockCreateSupabaseServerClient.mockResolvedValue(
      fakeSupabase({
        existing: { status: "in_review", published_at: null, locale: "en", slug: "x", cover_image_status: "missing", cover_image_url: null, cover_image_alt: null },
      })
    );

    const result = await transitionArticleStatus({ id: ARTICLE_ID, status: "published" });

    expect(result.ok).toBe(false);
    if (!result.ok && result.kind === "validation") {
      expect(result.fieldErrors.coverImage).toBe("Add and approve a cover image with alt text before publishing.");
    } else {
      throw new Error("expected a validation result");
    }
  });

  it("rejects: pending_review + valid url + valid alt (not yet approved)", async () => {
    mockCreateSupabaseServerClient.mockResolvedValue(
      fakeSupabase({
        existing: {
          status: "in_review",
          published_at: null,
          locale: "en",
          slug: "x",
          cover_image_status: "pending_review",
          cover_image_url: "https://example.com/cover.webp",
          cover_image_alt: "A descriptive alt text",
        },
      })
    );

    const result = await transitionArticleStatus({ id: ARTICLE_ID, status: "published" });

    expect(result.ok).toBe(false);
  });

  it("rejects: approved + empty url + valid alt", async () => {
    mockCreateSupabaseServerClient.mockResolvedValue(
      fakeSupabase({
        existing: { status: "in_review", published_at: null, locale: "en", slug: "x", cover_image_status: "approved", cover_image_url: "", cover_image_alt: "Alt text" },
      })
    );

    const result = await transitionArticleStatus({ id: ARTICLE_ID, status: "published" });

    expect(result.ok).toBe(false);
  });

  it("rejects: approved + whitespace-only url + valid alt", async () => {
    mockCreateSupabaseServerClient.mockResolvedValue(
      fakeSupabase({
        existing: { status: "in_review", published_at: null, locale: "en", slug: "x", cover_image_status: "approved", cover_image_url: "   ", cover_image_alt: "Alt text" },
      })
    );

    const result = await transitionArticleStatus({ id: ARTICLE_ID, status: "published" });

    expect(result.ok).toBe(false);
  });

  it("rejects: approved + valid url + empty alt", async () => {
    mockCreateSupabaseServerClient.mockResolvedValue(
      fakeSupabase({
        existing: {
          status: "in_review",
          published_at: null,
          locale: "en",
          slug: "x",
          cover_image_status: "approved",
          cover_image_url: "https://example.com/cover.webp",
          cover_image_alt: "",
        },
      })
    );

    const result = await transitionArticleStatus({ id: ARTICLE_ID, status: "published" });

    expect(result.ok).toBe(false);
  });

  it("rejects: approved + valid url + whitespace-only alt", async () => {
    mockCreateSupabaseServerClient.mockResolvedValue(
      fakeSupabase({
        existing: {
          status: "in_review",
          published_at: null,
          locale: "en",
          slug: "x",
          cover_image_status: "approved",
          cover_image_url: "https://example.com/cover.webp",
          cover_image_alt: "   ",
        },
      })
    );

    const result = await transitionArticleStatus({ id: ARTICLE_ID, status: "published" });

    expect(result.ok).toBe(false);
  });

  it("never writes to the database when the gate rejects the transition", async () => {
    const supabase = fakeSupabase({
      existing: { status: "in_review", published_at: null, locale: "en", slug: "x", cover_image_status: "missing", cover_image_url: null, cover_image_alt: null },
    });
    mockCreateSupabaseServerClient.mockResolvedValue(supabase);

    await transitionArticleStatus({ id: ARTICLE_ID, status: "published" });

    // select() was called once (the gate's own read); update() must
    // never be reached once the gate has already rejected.
    expect(supabase.from("insights_articles").update).not.toHaveBeenCalled();
  });
});

describe("transitionArticleStatus — publication allowed once the gate is satisfied", () => {
  it("approved + valid url + valid alt -> published", async () => {
    mockCreateSupabaseServerClient.mockResolvedValue(
      fakeSupabase({
        existing: {
          status: "in_review",
          published_at: null,
          locale: "en",
          slug: "x",
          cover_image_status: "approved",
          cover_image_url: "https://example.com/cover.webp",
          cover_image_alt: "A descriptive alt text",
        },
      })
    );

    const result = await transitionArticleStatus({ id: ARTICLE_ID, status: "published" });

    expect(result.ok).toBe(true);
  });
});

describe("transitionArticleStatus — published -> published is not a NEW publish, so the gate must not apply", () => {
  it("succeeds for an already-published (e.g. legacy) article whose cover_image_status is still 'missing' -- the gate only applies to a future transition INTO published, never to a row that is already published being re-transitioned to the same status", async () => {
    const supabase = fakeSupabase({
      existing: {
        status: "published",
        published_at: "2025-01-01T00:00:00.000Z",
        locale: "en",
        slug: "legacy-article",
        cover_image_status: "missing",
        cover_image_url: null,
        cover_image_alt: null,
      },
    });
    mockCreateSupabaseServerClient.mockResolvedValue(supabase);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));

    const result = await transitionArticleStatus({ id: ARTICLE_ID, status: "published" });

    // Existing status-transition contract: succeeds, and does not
    // overwrite the original published_at (it's already set).
    expect(result.ok).toBe(true);

    // The visual gate must not reject this call.
    if (!result.ok) {
      throw new Error("expected the publication gate to allow a published -> published transition");
    }

    // Not a new publish -> IndexNow must not be re-submitted.
    expect(fetchSpy).not.toHaveBeenCalled();

    const { update } = supabase.from("insights_articles");
    expect(update).toHaveBeenCalledTimes(1);
  });
});

describe("transitionArticleStatus — defence in depth", () => {
  it("reads the row's CURRENT database state for the gate, not a value supplied by the caller", async () => {
    const supabase = fakeSupabase({
      existing: { status: "in_review", published_at: null, locale: "en", slug: "x", cover_image_status: "missing", cover_image_url: null, cover_image_alt: null },
    });
    mockCreateSupabaseServerClient.mockResolvedValue(supabase);

    // statusTransitionSchema has no coverImageStatus/coverImageUrl/
    // coverImageAlt fields at all -- even if a caller tries to smuggle
    // them in, Zod strips unknown keys and the gate still reads the DB.
    const result = await transitionArticleStatus({
      id: ARTICLE_ID,
      status: "published",
      coverImageStatus: "approved",
      coverImageUrl: "https://attacker.example.com/fake.webp",
      coverImageAlt: "fake alt",
    });

    expect(result.ok).toBe(false);
  });

  it("a query failure while reading current visual state surfaces as a storage error, not a visual-validation error", async () => {
    mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase({ selectError: { message: "connection reset" } }));

    const result = await transitionArticleStatus({ id: ARTICLE_ID, status: "published" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("persistence");
    }
  });

  it("a write failure after the gate has passed remains a storage error", async () => {
    mockCreateSupabaseServerClient.mockResolvedValue(
      fakeSupabase({
        existing: {
          status: "in_review",
          published_at: null,
          locale: "en",
          slug: "x",
          cover_image_status: "approved",
          cover_image_url: "https://example.com/cover.webp",
          cover_image_alt: "A descriptive alt text",
        },
        updateError: { message: "db exploded" },
      })
    );

    const result = await transitionArticleStatus({ id: ARTICLE_ID, status: "published" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("persistence");
    }
  });
});

describe("promoteToArticles-equivalent path — new articles rely on the database default", () => {
  it("createArticle's insert payload never sets cover_image_status -- promoted/manual articles pick up the column's own DB default ('missing') rather than the application asserting a value", async () => {
    const supabase = fakeSupabase();
    mockCreateSupabaseServerClient.mockResolvedValue(supabase);

    await createArticle(validArticleInput({ status: "in_review", source: "ai_generated" }));

    const { insert } = supabase.from("insights_articles");
    const insertedRow = insert.mock.calls[0]?.[0] as Record<string, unknown> | undefined;

    expect(insertedRow).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(insertedRow, "cover_image_status")).toBe(false);
  });
});
