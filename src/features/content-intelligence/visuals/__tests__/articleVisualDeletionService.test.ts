import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * Phase 3C.4B.7A — coverage for the article visual candidate deletion
 * backend (`articleVisualDeletionService.ts`). Same mocking shape as
 * `articleVisualReviewService.test.ts`/`articleVisualStorageService.test.ts`:
 * `@/lib/supabase/adminAuth` + `@/lib/supabase/server` mocked, a
 * hand-built fake Supabase client covering only the
 * `.from("article_visuals").select(...).eq(...).maybeSingle()`,
 * `.from("article_visuals").delete().eq(...).in(...)`, and
 * `.storage.from("article-visuals").remove(...)` surface this service
 * actually touches. No real delete against a live Supabase project ever
 * runs here.
 */

const mockGetAdminSession = vi.fn();
vi.mock("@/lib/supabase/adminAuth", () => ({
	getAdminSession: () => mockGetAdminSession(),
}));

const mockCreateSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: () => mockCreateSupabaseServerClient(),
}));

const { deleteArticleVisual } = await import("../articleVisualDeletionService");

const EDITOR_SESSION = { userId: "u1", email: "editor@example.com", roles: ["editor"], isAdmin: false, isEditor: true };
const NON_EDITOR_SESSION = { userId: "u2", email: "viewer@example.com", roles: [], isAdmin: false, isEditor: false };

const ARTICLE_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ARTICLE_ID = "22222222-2222-4222-8222-222222222222";
const VISUAL_ID = "33333333-3333-4333-8333-333333333333";
const STORAGE_PATH = `${ARTICLE_ID}/${VISUAL_ID}.png`;

type Candidate = { id: string; article_id: string; status: string; storage_path: string } | null;

type FakeSupabaseOptions = {
	candidate?: Candidate;
	selectError?: { message: string } | null;
	removeError?: { message: string } | null;
	deleteError?: { message: string } | null;
};

/** A minimal fake of the exact Supabase surface `articleVisualDeletionService.ts`
 * touches: `.from("article_visuals").select(...).eq(...).maybeSingle()`,
 * `.from("article_visuals").delete().eq(...).in(...)`, and
 * `.storage.from("article-visuals").remove(...)`. No `.storage.from(...).upload`
 * or `.getPublicUrl` are defined at all -- calling either would throw,
 * which is how "deletion never re-derives or re-uploads anything" is
 * enforced below. */
function fakeSupabase(opts: FakeSupabaseOptions = {}) {
	const {
		candidate = { id: VISUAL_ID, article_id: ARTICLE_ID, status: "pending_review", storage_path: STORAGE_PATH },
		selectError = null,
		removeError = null,
		deleteError = null,
	} = opts;

	const maybeSingle = vi.fn(async () => ({ data: candidate, error: selectError }));
	const selectEq = vi.fn(() => ({ maybeSingle }));
	const select = vi.fn(() => ({ eq: selectEq }));

	// .delete().eq(id).in("status", [...]) resolves to { error }
	const deleteIn = vi.fn(async () => ({ error: deleteError }));
	const deleteEq = vi.fn(() => ({ in: deleteIn }));
	const del = vi.fn(() => ({ eq: deleteEq }));

	const from = vi.fn((table: string) => {
		if (table === "article_visuals") return { select, delete: del };
		throw new Error(`fakeSupabase: unexpected table "${table}"`);
	});

	const remove = vi.fn(async (_paths: string[]) => ({ data: null, error: removeError }));
	const storageFrom = vi.fn((_bucket: string) => ({ remove }));

	return {
		from,
		storage: { from: storageFrom },
		spies: { select, selectEq, maybeSingle, del, deleteEq, deleteIn, storageFrom, remove },
	};
}

beforeEach(() => {
	mockGetAdminSession.mockReset().mockResolvedValue(EDITOR_SESSION);
	mockCreateSupabaseServerClient.mockReset();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("configuration and authentication gates", () => {
	it("1. rejects when Supabase is not configured", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(null);
		const result = await deleteArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID });
		expect(result).toEqual({ ok: false, kind: "not_configured", message: expect.any(String) });
	});

	it("2. rejects an unauthenticated caller before any database call", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);
		mockGetAdminSession.mockResolvedValue(null);

		const result = await deleteArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID });

		expect(result).toEqual({ ok: false, kind: "auth", message: expect.any(String) });
		expect(supabase.spies.select).not.toHaveBeenCalled();
		expect(supabase.spies.remove).not.toHaveBeenCalled();
		expect(supabase.spies.del).not.toHaveBeenCalled();
	});

	it("3. rejects an authenticated non-editor before any database call", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);
		mockGetAdminSession.mockResolvedValue(NON_EDITOR_SESSION);

		const result = await deleteArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID });

		expect(result).toEqual({ ok: false, kind: "auth", message: expect.any(String) });
		expect(supabase.spies.select).not.toHaveBeenCalled();
		expect(supabase.spies.remove).not.toHaveBeenCalled();
	});
});

describe("input validation", () => {
	it("rejects a malformed article id without calling the database", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await deleteArticleVisual({ articleId: "not-a-uuid", visualId: VISUAL_ID });

		expect(result).toEqual({ ok: false, kind: "validation", message: expect.any(String) });
		expect(supabase.spies.select).not.toHaveBeenCalled();
	});

	it("rejects a malformed visual id without calling the database", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await deleteArticleVisual({ articleId: ARTICLE_ID, visualId: "not-a-uuid" });

		expect(result).toEqual({ ok: false, kind: "validation", message: expect.any(String) });
		expect(supabase.spies.select).not.toHaveBeenCalled();
	});
});

describe("candidate and article ownership checks", () => {
	it("rejects a missing visual candidate", async () => {
		const supabase = fakeSupabase({ candidate: null });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await deleteArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID });

		expect(result).toEqual({ ok: false, kind: "not_found", message: expect.any(String) });
		expect(supabase.spies.remove).not.toHaveBeenCalled();
		expect(supabase.spies.del).not.toHaveBeenCalled();
	});

	it("rejects a candidate that belongs to a different article", async () => {
		const supabase = fakeSupabase({
			candidate: { id: VISUAL_ID, article_id: OTHER_ARTICLE_ID, status: "pending_review", storage_path: STORAGE_PATH },
		});
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await deleteArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID });

		expect(result).toEqual({ ok: false, kind: "not_found", message: expect.any(String) });
		expect(supabase.spies.remove).not.toHaveBeenCalled();
		expect(supabase.spies.del).not.toHaveBeenCalled();
	});

	it("a failed candidate lookup produces a safe, non-leaking application error", async () => {
		const supabase = fakeSupabase({ selectError: { message: "relation article_visuals does not exist: internal detail" } });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await deleteArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID });

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.kind).toBe("database_error");
			expect(result.message).not.toMatch(/relation|internal detail/i);
		}
	});
});

describe("deletable-status enforcement (LOCKED: only pending_review and superseded)", () => {
	it("allows deleting a pending_review candidate", async () => {
		const supabase = fakeSupabase({ candidate: { id: VISUAL_ID, article_id: ARTICLE_ID, status: "pending_review", storage_path: STORAGE_PATH } });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await deleteArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID });

		expect(result).toEqual({ ok: true, visualId: VISUAL_ID });
	});

	it("allows deleting a superseded candidate", async () => {
		const supabase = fakeSupabase({ candidate: { id: VISUAL_ID, article_id: ARTICLE_ID, status: "superseded", storage_path: STORAGE_PATH } });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await deleteArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID });

		expect(result).toEqual({ ok: true, visualId: VISUAL_ID });
	});

	it("HARD REQUIREMENT: rejects deleting an approved candidate (the active cover), never touching Storage or the database row", async () => {
		const supabase = fakeSupabase({ candidate: { id: VISUAL_ID, article_id: ARTICLE_ID, status: "approved", storage_path: STORAGE_PATH } });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await deleteArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID });

		expect(result).toEqual({ ok: false, kind: "not_deletable", message: expect.any(String) });
		expect(supabase.spies.remove).not.toHaveBeenCalled();
		expect(supabase.spies.del).not.toHaveBeenCalled();
	});

	it("never guesses or repairs an inconsistent state -- an approved row is rejected even if it were somehow not the article's current live cover", async () => {
		// This service intentionally makes no attempt to check the
		// article's own cover_image_status/url at all -- status ===
		// "approved" alone is sufficient, and always sufficient, to
		// reject the delete. There is no code path here that would ever
		// treat an approved row as deletable under any circumstance.
		const supabase = fakeSupabase({ candidate: { id: VISUAL_ID, article_id: ARTICLE_ID, status: "approved", storage_path: STORAGE_PATH } });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await deleteArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID });

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.kind).toBe("not_deletable");
	});

	it("source_type-independence: an uploaded pending_review candidate follows the identical deletable rule as a generated one (status is the only input this service reads)", async () => {
		const supabase = fakeSupabase({ candidate: { id: VISUAL_ID, article_id: ARTICLE_ID, status: "pending_review", storage_path: STORAGE_PATH } });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await deleteArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID });

		expect(result).toEqual({ ok: true, visualId: VISUAL_ID });
	});
});

describe("trusted storage_path usage and Storage/DB deletion order", () => {
	it("deletes the Storage object using only the server-loaded, trusted storage_path -- never a client-supplied value (this input type doesn't even accept one)", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		await deleteArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID });

		expect(supabase.spies.storageFrom).toHaveBeenCalledWith("article-visuals");
		expect(supabase.spies.remove).toHaveBeenCalledWith([STORAGE_PATH]);
	});

	it("deletes Storage before the database row (Storage call happens strictly before the delete call)", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const callOrder: string[] = [];
		supabase.spies.remove.mockImplementation(async () => {
			callOrder.push("storage");
			return { data: null, error: null };
		});
		supabase.spies.deleteIn.mockImplementation(async () => {
			callOrder.push("database");
			return { error: null };
		});

		await deleteArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID });

		expect(callOrder).toEqual(["storage", "database"]);
	});

	it("if the Storage delete fails, the DB row is left untouched (no delete call is ever made) and a storage_error is returned", async () => {
		const supabase = fakeSupabase({ removeError: { message: "Storage: object not found: internal detail" } });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await deleteArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID });

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.kind).toBe("storage_error");
			expect(result.message).not.toMatch(/internal detail/i);
		}
		expect(supabase.spies.del).not.toHaveBeenCalled();
	});

	it("if the DB delete fails after the Storage delete succeeded, this is an honestly-reported partial failure (database_error), never silently reported as success", async () => {
		const supabase = fakeSupabase({ deleteError: { message: "connection reset: internal detail" } });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await deleteArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID });

		expect(supabase.spies.remove).toHaveBeenCalledWith([STORAGE_PATH]);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.kind).toBe("database_error");
			expect(result.message).not.toMatch(/connection reset|internal detail/i);
		}
	});

	it("the database delete re-checks status at write time (.in) so a concurrent status change to approved between load and delete can never remove an approved row", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		await deleteArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID });

		expect(supabase.spies.deleteEq).toHaveBeenCalledWith("id", VISUAL_ID);
		expect(supabase.spies.deleteIn).toHaveBeenCalledWith("status", ["pending_review", "superseded"]);
	});
});

describe("no sibling mutation, no approval/publication side effects, no cover_image_* writes", () => {
	it("never calls Storage upload or getPublicUrl (the fake client defines neither; calling either would throw)", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await deleteArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID });

		expect(result.ok).toBe(true);
	});

	it("touches only the article_visuals table -- calling .from with any other table name throws in this fake, so a passing run proves no insights_articles write occurred", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		await expect(deleteArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID })).resolves.toEqual({ ok: true, visualId: VISUAL_ID });
		expect(supabase.spies.select).toHaveBeenCalled();
	});

	it("success result carries only { ok: true; visualId } -- no Storage internals, no candidate row fields", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await deleteArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID });

		expect(result).toEqual({ ok: true, visualId: VISUAL_ID });
		expect(Object.keys(result)).toEqual(["ok", "visualId"]);
	});
});

describe("articleVisualDeletionService.ts structural boundaries", () => {
	it("does not use the privileged/service-role Supabase client", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const SOURCE_PATH = resolve(process.cwd(), "src/features/content-intelligence/visuals/articleVisualDeletionService.ts");
		const source = readFileSync(SOURCE_PATH, "utf8");
		const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

		expect(codeOnly).not.toMatch(/createSupabasePrivilegedClient|service_role/);
	});

	it("never writes cover_image_url, cover_image_alt, or cover_image_status", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const SOURCE_PATH = resolve(process.cwd(), "src/features/content-intelligence/visuals/articleVisualDeletionService.ts");
		const source = readFileSync(SOURCE_PATH, "utf8");
		const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

		expect(codeOnly).not.toMatch(/cover_image_url|cover_image_alt|cover_image_status/);
	});

	it("never references insights_articles at all", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const SOURCE_PATH = resolve(process.cwd(), "src/features/content-intelligence/visuals/articleVisualDeletionService.ts");
		const source = readFileSync(SOURCE_PATH, "utf8");
		const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

		expect(codeOnly).not.toMatch(/insights_articles/);
	});

	it("never introduces a soft-delete/archived/removed status", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const SOURCE_PATH = resolve(process.cwd(), "src/features/content-intelligence/visuals/articleVisualDeletionService.ts");
		const source = readFileSync(SOURCE_PATH, "utf8");
		const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

		expect(codeOnly).not.toMatch(/"deleted"|"archived"|"removed"/);
	});
});

describe("supabase/migrations/013_article_visual_deletion.sql", () => {
	it("adds exactly one DELETE policy gated by is_active_editor_or_admin(), to authenticated only", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const MIGRATION_PATH = resolve(process.cwd(), "supabase/migrations/013_article_visual_deletion.sql");
		const migrationSource = readFileSync(MIGRATION_PATH, "utf8");
		const executableSql = migrationSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "");

		expect(executableSql).toMatch(/create policy "article_visuals: editor delete"\s*\n\s*on public\.article_visuals\s*\n\s*for delete\s*\n\s*to authenticated\s*\n\s*using \(public\.is_active_editor_or_admin\(\)\);/);
		expect(executableSql).toMatch(/grant delete\s*\n\s*on table public\.article_visuals\s*\n\s*to authenticated;/);
	});

	it("never grants anonymous delete", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const MIGRATION_PATH = resolve(process.cwd(), "supabase/migrations/013_article_visual_deletion.sql");
		const migrationSource = readFileSync(MIGRATION_PATH, "utf8");
		const executableSql = migrationSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "");

		expect(executableSql).not.toMatch(/to anon\b/);
		expect(executableSql).not.toMatch(/to public\b/);
	});

	it("never touches SELECT/INSERT/UPDATE policies or the partial unique index", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const MIGRATION_PATH = resolve(process.cwd(), "supabase/migrations/013_article_visual_deletion.sql");
		const migrationSource = readFileSync(MIGRATION_PATH, "utf8");
		const executableSql = migrationSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "");

		expect(executableSql).not.toMatch(/for select|for insert|for update/);
		expect(executableSql).not.toMatch(/article_visuals_one_approved_per_article_idx/);
		expect(executableSql).not.toMatch(/drop index|drop policy/i);
	});
});
