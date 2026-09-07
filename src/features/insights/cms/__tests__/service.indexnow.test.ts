import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { siteUrl } from "@/lib/seo/metadata";

/**
 * IndexNow-trigger coverage for the two CMS write paths that were wired
 * up to `pingIndexNow()`: `transitionArticleStatus` (manual publish) and
 * `updateArticle` (editing an already-published article). The scheduler's
 * own IndexNow call (`src/app/api/v1/scheduler/publish/route.ts`) already
 * existed and is unchanged here.
 *
 * Mocks the two Supabase-facing seams this module actually calls
 * (`@/lib/supabase/adminAuth`, `@/lib/supabase/server`) rather than a
 * hand-rolled Supabase client — the real `pingIndexNow()` HTTP call is
 * exercised for real (via a mocked global `fetch`), the same pattern
 * `src/lib/crm/__tests__/HubSpotProvider.test.ts` uses for its own
 * outbound-fetch integration. `createSupabasePrivilegedClient` (used only
 * by `deleteArticle`, not under test here) is left unmocked — it never
 * touches `next/headers`, so importing it for real is safe.
 *
 * The `mock`-prefix on every vi.mock-closed-over variable is required —
 * Vitest hoists `vi.mock` factories above imports and only allows a
 * factory to reference an outer variable whose name starts with "mock"
 * (see `src/lib/analytics/__tests__/events.test.ts` for the same
 * convention already used in this repo).
 */

const mockGetAdminSession = vi.fn();
vi.mock("@/lib/supabase/adminAuth", () => ({
  getAdminSession: () => mockGetAdminSession(),
}));

const mockCreateSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => mockCreateSupabaseServerClient(),
}));

const { transitionArticleStatus, updateArticle } = await import("../service");

const EDITOR_SESSION = {
  userId: "u1",
  email: "editor@example.com",
  roles: ["editor"],
  isAdmin: false,
  isEditor: true,
};

// RFC 4122-shaped UUIDs — Zod v4's `.uuid()` (used by both
// `statusTransitionSchema.id` and `articleInputSchema.categoryId`)
// enforces the real version/variant nibbles, not just "8-4-4-4-12 hex
// digits". A same-digit placeholder like "11111111-1111-1111-1111-
// 111111111111" LOOKS like a UUID but fails that check (variant
// nibble must be 8/9/a/b) — these deliberately use a valid v4 shape
// (version nibble 4, variant nibble 8) so validation actually passes
// and the tests exercise the Supabase mocks, not Zod rejecting the
// input before Supabase is ever touched.
const ARTICLE_ID = "11111111-1111-4111-8111-111111111111";
const CATEGORY_ID = "22222222-2222-4222-8222-222222222222";
const FUTURE_ISO = new Date(Date.now() + 86_400_000).toISOString();

// Phase 3C.4A -- cover_image_status/url/alt are optional here (default
// undefined) because most of these fixtures exercise a target status
// OTHER than "published" (draft/in_review/scheduled/archived), or a
// published -> published no-op, neither of which the publication gate
// evaluates. Only fixtures that exercise an actual NEW publish (a
// non-published -> published transition) need to supply a fully
// approved, non-empty cover image -- see PUBLISHABLE_COVER below.
type ExistingRow = {
  status: string;
  published_at: string | null;
  locale: string;
  slug: string;
  cover_image_status?: string;
  cover_image_url?: string | null;
  cover_image_alt?: string | null;
} | null;

/** A satisfied Phase 3C.4A publication gate, spread into any fixture
 * that represents a genuine non-published -> published transition --
 * this file proves IndexNow behaviour still works AFTER the universal
 * publication invariant is satisfied, not by bypassing or mocking away
 * the gate. */
const PUBLISHABLE_COVER = {
  cover_image_status: "approved",
  cover_image_url: "https://example.com/cover.webp",
  cover_image_alt: "A descriptive alt text for this article's cover image",
};

/** A minimal fake of the one Supabase surface these two functions touch:
 * `.from("insights_articles").select(...).eq(...).maybeSingle()`,
 * `.from(<table>).update(...).eq(...)`, and (via `syncTags`)
 * `.from("insights_article_tags").delete(...).eq(...)` /
 * `.insert(...)`. Table name is ignored — nothing here needs the two
 * tables to behave differently for these tests. */
function fakeSupabase(opts: { existing?: ExistingRow; updateError?: { message: string } | null } = {}) {
  const maybeSingle = vi.fn(async () => ({ data: opts.existing ?? null }));
  const selectEq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq: selectEq }));

  const updateEq = vi.fn(async () => ({ error: opts.updateError ?? null }));
  const update = vi.fn(() => ({ eq: updateEq }));

  const deleteEq = vi.fn(async () => ({ error: null }));
  const del = vi.fn(() => ({ eq: deleteEq }));

  const insert = vi.fn(async () => ({ error: null }));

  return { from: vi.fn(() => ({ select, update, delete: del, insert })) };
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

function submittedUrls(fetchMock: { mock: { calls: unknown[][] } }): string[] {
  const call = fetchMock.mock.calls[0] as [unknown, RequestInit | undefined] | undefined;
  const body = JSON.parse(String(call?.[1]?.body));
  return body.urlList;
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, INDEXNOW_KEY: "test-indexnow-key-0123456789abcdef" };
  mockGetAdminSession.mockReset().mockResolvedValue(EDITOR_SESSION);
  mockCreateSupabaseServerClient.mockReset();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("transitionArticleStatus -> IndexNow (manual publish)", () => {
  it("submits the article's public URL on a non-published -> published transition", async () => {
    // Phase 3C.4A: a real new publish now also requires a satisfied
    // cover-image gate -- this fixture represents a publishable
    // article, proving IndexNow still fires once the invariant holds.
    mockCreateSupabaseServerClient.mockResolvedValue(
      fakeSupabase({ existing: { status: "draft", published_at: null, locale: "en", slug: "my-article", ...PUBLISHABLE_COVER } })
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));

    const result = await transitionArticleStatus({ id: ARTICLE_ID, status: "published" });

    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://api.indexnow.org/indexnow");
    expect(submittedUrls(fetchSpy)).toEqual([new URL("/insights/my-article", siteUrl).toString()]);
  });

  it("builds the /pl/wiedza/{slug} URL for a Polish article", async () => {
    // Phase 3C.4A: same reasoning as above -- a real new publish
    // requires the gate to be satisfied first.
    mockCreateSupabaseServerClient.mockResolvedValue(
      fakeSupabase({ existing: { status: "in_review", published_at: null, locale: "pl", slug: "moj-artykul", ...PUBLISHABLE_COVER } })
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));

    await transitionArticleStatus({ id: ARTICLE_ID, status: "published" });

    expect(submittedUrls(fetchSpy)).toEqual([new URL("/pl/wiedza/moj-artykul", siteUrl).toString()]);
  });

  it("never pings IndexNow for a transition into draft, in_review, scheduled or archived", async () => {
    for (const status of ["draft", "in_review", "scheduled", "archived"] as const) {
      mockCreateSupabaseServerClient.mockResolvedValue(
        fakeSupabase({ existing: { status: "in_review", published_at: null, locale: "en", slug: "x" } })
      );
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));

      const result = await transitionArticleStatus({
        id: ARTICLE_ID,
        status,
        scheduledAt: status === "scheduled" ? FUTURE_ISO : undefined,
      });

      expect(result.ok).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    }
  });

  it("does not re-submit an article that was already published (e.g. an unrelated re-save while status stays published)", async () => {
    mockCreateSupabaseServerClient.mockResolvedValue(
      fakeSupabase({
        existing: { status: "published", published_at: "2026-01-01T00:00:00.000Z", locale: "en", slug: "already-live" },
      })
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));

    const result = await transitionArticleStatus({ id: ARTICLE_ID, status: "published" });

    expect(result.ok).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never pings IndexNow when the database update itself fails", async () => {
    // Phase 3C.4A: this fixture must satisfy the publication gate so the
    // failure this test actually exercises is the database update
    // failing -- not the gate rejecting the request first (which would
    // also produce `ok: false` and no fetch call, but for the wrong
    // reason, silently no longer testing the DB-failure path at all).
    mockCreateSupabaseServerClient.mockResolvedValue(
      fakeSupabase({
        existing: { status: "draft", published_at: null, locale: "en", slug: "my-article", ...PUBLISHABLE_COVER },
        updateError: { message: "db exploded" },
      })
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));

    const result = await transitionArticleStatus({ id: ARTICLE_ID, status: "published" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("persistence");
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("still reports the publish as successful when IndexNow itself fails", async () => {
    // Phase 3C.4A: this is a real new publish, so the fixture must be
    // publishable, not merely "IndexNow failing shouldn't matter".
    mockCreateSupabaseServerClient.mockResolvedValue(
      fakeSupabase({ existing: { status: "draft", published_at: null, locale: "en", slug: "my-article", ...PUBLISHABLE_COVER } })
    );
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await transitionArticleStatus({ id: ARTICLE_ID, status: "published" });

    expect(result.ok).toBe(true);
  });

  it("never touches Supabase or IndexNow for a non-editor session", async () => {
    mockGetAdminSession.mockResolvedValue(null);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await transitionArticleStatus({ id: ARTICLE_ID, status: "published" });

    expect(result.ok).toBe(false);
    expect(mockCreateSupabaseServerClient).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("updateArticle -> IndexNow (published-article edits)", () => {
  it("submits the current public URL when an already-published article is edited and saved", async () => {
    mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase());
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));

    const result = await updateArticle(ARTICLE_ID, validArticleInput({ status: "published", slug: "live-article" }));

    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(submittedUrls(fetchSpy)).toEqual([new URL("/insights/live-article", siteUrl).toString()]);
  });

  it("never pings IndexNow merely because updateArticle() was called on an unpublished article", async () => {
    for (const status of ["draft", "in_review", "scheduled", "archived"] as const) {
      mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase());
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));

      const result = await updateArticle(
        ARTICLE_ID,
        validArticleInput({ status, scheduledAt: status === "scheduled" ? FUTURE_ISO : "" })
      );

      expect(result.ok).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    }
  });

  it("never pings IndexNow when the database update itself fails", async () => {
    mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase({ updateError: { message: "db exploded" } }));
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));

    const result = await updateArticle(ARTICLE_ID, validArticleInput({ status: "published" }));

    expect(result.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("still reports the save as successful when IndexNow itself fails", async () => {
    mockCreateSupabaseServerClient.mockResolvedValue(fakeSupabase());
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("server error", { status: 500 }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await updateArticle(ARTICLE_ID, validArticleInput({ status: "published" }));

    expect(result.ok).toBe(true);
  });
});
