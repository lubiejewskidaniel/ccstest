import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase 3C.4B.4A — coverage for the article visual approval backend.
 * Same mocking shape as `articleVisualStorageService.test.ts`
 * (`@/lib/supabase/adminAuth` + `@/lib/supabase/server` mocked, a
 * hand-built fake Supabase client covering only the
 * `.from("article_visuals").select(...).eq(...).maybeSingle()`,
 * `.storage.from(...).getPublicUrl(...)` and `.rpc(...)` surface this
 * service actually touches).
 *
 * The approval transaction itself (superseding, locking, the atomic
 * article/visual update) lives entirely in the `approve_article_visual`
 * PL/pgSQL function and cannot run against a real Postgres instance in
 * this test architecture (no scenario here does that). Those behaviours
 * are instead covered as structural assertions against the migration's
 * own SQL text further down this file, following the same precedent as
 * `articleVisualStorage.test.ts`'s migration-011 structural tests.
 */

const mockGetAdminSession = vi.fn();
vi.mock("@/lib/supabase/adminAuth", () => ({
	getAdminSession: () => mockGetAdminSession(),
}));

const mockCreateSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: () => mockCreateSupabaseServerClient(),
}));

const { approveArticleVisual } = await import("../articleVisualReviewService");

const EDITOR_SESSION = { userId: "u1", email: "editor@example.com", roles: ["editor"], isAdmin: false, isEditor: true };
const NON_EDITOR_SESSION = { userId: "u2", email: "viewer@example.com", roles: [], isAdmin: false, isEditor: false };

const ARTICLE_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ARTICLE_ID = "22222222-2222-4222-8222-222222222222";
const VISUAL_ID = "33333333-3333-4333-8333-333333333333";
const STORAGE_PATH = `${ARTICLE_ID}/${VISUAL_ID}.png`;
const DERIVED_PUBLIC_URL = `https://project.supabase.co/storage/v1/object/public/article-visuals/${STORAGE_PATH}`;

type Candidate = { id: string; article_id: string; storage_path: string } | null;

type FakeSupabaseOptions = {
	candidate?: Candidate;
	candidateError?: { message: string } | null;
	rpcError?: { message: string } | null;
};

/** A minimal fake of the exact Supabase surface `articleVisualReviewService.ts`
 * touches: `.from("article_visuals").select(...).eq(...).maybeSingle()`,
 * `.storage.from("article-visuals").getPublicUrl(...)`, and
 * `.rpc("approve_article_visual", ...)`. No `.storage.from(...).upload`
 * or `.remove` are defined at all — calling either would throw, which is
 * how "no Storage object is deleted/uploaded during approval" is
 * enforced below. */
function fakeSupabase(opts: FakeSupabaseOptions = {}) {
	const { candidate = { id: VISUAL_ID, article_id: ARTICLE_ID, storage_path: STORAGE_PATH }, candidateError = null, rpcError = null } = opts;

	const maybeSingle = vi.fn(async () => ({ data: candidate, error: candidateError }));
	const selectEq = vi.fn(() => ({ maybeSingle }));
	const select = vi.fn(() => ({ eq: selectEq }));

	const from = vi.fn((table: string) => {
		if (table === "article_visuals") return { select };
		throw new Error(`fakeSupabase: unexpected table "${table}"`);
	});

	const getPublicUrl = vi.fn((path: string) => ({ data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/article-visuals/${path}` } }));
	const storageFrom = vi.fn((_bucket: string) => ({ getPublicUrl }));

	const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({ data: null, error: rpcError }));

	return {
		from,
		storage: { from: storageFrom },
		rpc,
		spies: { select, selectEq, maybeSingle, storageFrom, getPublicUrl, rpc },
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
		const result = await approveArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID, altText: "A cat" });
		expect(result).toEqual({ ok: false, kind: "not_configured", message: expect.any(String) });
	});

	it("2. rejects an unauthenticated caller before any database call", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);
		mockGetAdminSession.mockResolvedValue(null);

		const result = await approveArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID, altText: "A cat" });

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.kind).toBe("auth");
		expect(supabase.spies.select).not.toHaveBeenCalled();
		expect(supabase.spies.rpc).not.toHaveBeenCalled();
	});

	it("3. rejects an authenticated non-editor before any database call", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);
		mockGetAdminSession.mockResolvedValue(NON_EDITOR_SESSION);

		const result = await approveArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID, altText: "A cat" });

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.kind).toBe("auth");
		expect(supabase.spies.select).not.toHaveBeenCalled();
		expect(supabase.spies.rpc).not.toHaveBeenCalled();
	});
});

describe("candidate and article ownership checks", () => {
	it("4. a candidate that the RPC reports as belonging to a missing article produces a not_found result (article existence is enforced inside the transaction, not by this service)", async () => {
		const supabase = fakeSupabase({ rpcError: { message: "CCS_ARTICLE_NOT_FOUND" } });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await approveArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID, altText: "A cat" });

		expect(result).toEqual({ ok: false, kind: "not_found", message: expect.any(String) });
	});

	it("5. rejects a missing visual candidate", async () => {
		const supabase = fakeSupabase({ candidate: null });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await approveArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID, altText: "A cat" });

		expect(result).toEqual({ ok: false, kind: "not_found", message: expect.any(String) });
		expect(supabase.spies.rpc).not.toHaveBeenCalled();
	});

	it("6. rejects a candidate that belongs to a different article", async () => {
		const supabase = fakeSupabase({ candidate: { id: VISUAL_ID, article_id: OTHER_ARTICLE_ID, storage_path: STORAGE_PATH } });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await approveArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID, altText: "A cat" });

		expect(result).toEqual({ ok: false, kind: "not_found", message: expect.any(String) });
		expect(supabase.spies.rpc).not.toHaveBeenCalled();
	});
});

describe("alt text validation and trimming", () => {
	it("7. rejects blank alt text", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await approveArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID, altText: "" });

		expect(result).toEqual({ ok: false, kind: "validation", message: expect.any(String) });
		expect(supabase.spies.rpc).not.toHaveBeenCalled();
	});

	it("8. rejects whitespace-only alt text", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await approveArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID, altText: "   \t  " });

		expect(result).toEqual({ ok: false, kind: "validation", message: expect.any(String) });
		expect(supabase.spies.rpc).not.toHaveBeenCalled();
	});

	it("9. trims the final alt text before sending it to the RPC", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await approveArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID, altText: "  A cat on a wall  " });

		expect(result.ok).toBe(true);
		expect(supabase.spies.rpc).toHaveBeenCalledWith("approve_article_visual", expect.objectContaining({ p_alt_text: "A cat on a wall" }));
	});
});

describe("reviewer identity and RPC arguments", () => {
	it("12. never accepts or forwards a caller-supplied reviewed_by — the RPC call carries only article id, visual id, alt text and the derived public URL", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		await approveArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID, altText: "A cat" });

		const [, rpcArgs] = supabase.spies.rpc.mock.calls[0] ?? [];
		expect(rpcArgs).toEqual({
			p_article_id: ARTICLE_ID,
			p_visual_id: VISUAL_ID,
			p_alt_text: "A cat",
			p_public_url: DERIVED_PUBLIC_URL,
		});
		expect(Object.keys(rpcArgs as Record<string, unknown>)).not.toContain("reviewed_by");
		expect(Object.keys(rpcArgs as Record<string, unknown>)).not.toContain("reviewer_id");
	});
});

describe("public Storage URL derivation", () => {
	it("19 & 20. derives the public URL server-side from the candidate's trusted storage_path via getPublicUrl, never from a provider or client-submitted URL", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		await approveArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID, altText: "A cat" });

		expect(supabase.spies.storageFrom).toHaveBeenCalledWith("article-visuals");
		expect(supabase.spies.getPublicUrl).toHaveBeenCalledWith(STORAGE_PATH);
		const [, rpcArgs] = supabase.spies.rpc.mock.calls[0] ?? [];
		expect((rpcArgs as Record<string, unknown>).p_public_url).toBe(DERIVED_PUBLIC_URL);
	});

	it("25. never calls Storage upload or remove during approval (the fake client defines no such methods; calling either would throw)", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await approveArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID, altText: "A cat" });

		expect(result.ok).toBe(true);
	});
});

describe("RPC outcome mapping", () => {
	it("10, 11, 13, 14, 15. a successful RPC call is reported as ok:true (the resulting state transition — candidate approved, reviewed_at populated, article cover url/alt/status updated — is the RPC's own responsibility, asserted structurally against its SQL below)", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await approveArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID, altText: "A cat" });

		expect(result).toEqual({ ok: true });
	});

	it("18. reports a superseded candidate as not_approvable", async () => {
		const supabase = fakeSupabase({ rpcError: { message: "CCS_VISUAL_NOT_APPROVABLE" } });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await approveArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID, altText: "A cat" });

		expect(result).toEqual({ ok: false, kind: "not_approvable", message: expect.any(String) });
	});

	it("21. an unrecognised RPC/database failure produces a safe, non-leaking application error", async () => {
		const supabase = fakeSupabase({ rpcError: { message: 'duplicate key value violates unique constraint "article_visuals_one_approved_per_article_idx"' } });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await approveArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID, altText: "A cat" });

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.kind).toBe("persistence");
			expect(result.message).not.toMatch(/duplicate key|constraint|article_visuals_one_approved/i);
		}
	});

	it("a failed candidate lookup produces a safe, non-leaking application error", async () => {
		const supabase = fakeSupabase({ candidateError: { message: "relation article_visuals does not exist: internal detail" } });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await approveArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID, altText: "A cat" });

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.kind).toBe("persistence");
			expect(result.message).not.toMatch(/relation|internal detail/i);
		}
	});

	it("23. a repeated approval request for the already-current approved visual is reported as ok:true (the RPC's own idempotent no-op branch, asserted structurally below)", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await approveArticleVisual({ articleId: ARTICLE_ID, visualId: VISUAL_ID, altText: "A cat" });

		expect(result).toEqual({ ok: true });
	});
});

describe("input validation", () => {
	it("rejects a malformed article id without calling the database", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await approveArticleVisual({ articleId: "not-a-uuid", visualId: VISUAL_ID, altText: "A cat" });

		expect(result).toEqual({ ok: false, kind: "validation", message: expect.any(String) });
		expect(supabase.spies.select).not.toHaveBeenCalled();
	});

	it("rejects a malformed visual id without calling the database", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await approveArticleVisual({ articleId: ARTICLE_ID, visualId: "not-a-uuid", altText: "A cat" });

		expect(result).toEqual({ ok: false, kind: "validation", message: expect.any(String) });
		expect(supabase.spies.select).not.toHaveBeenCalled();
	});
});

describe("articleVisualReviewService.ts structural boundaries", () => {
	const SOURCE_PATH = resolve(process.cwd(), "src/features/content-intelligence/visuals/articleVisualReviewService.ts");
	const source = readFileSync(SOURCE_PATH, "utf8");
	// Strip comments first: this module's own doc comments legitimately
	// name concepts (temporary_url, service-role) to document that they
	// are absent from the implementation.
	const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

	it("19. never references a provider temporary URL", () => {
		expect(codeOnly).not.toMatch(/temporary_url/);
	});

	it("does not use the privileged/service-role Supabase client", () => {
		expect(codeOnly).not.toMatch(/createSupabasePrivilegedClient|service_role/);
	});

	it("never accepts a reviewed_by field on its input type", () => {
		expect(codeOnly).not.toMatch(/reviewed_by\s*:/);
	});

	it("imports the shared getArticleVisualPublicUrl helper from articleVisualStorageService rather than deriving the public URL itself", () => {
		expect(codeOnly).toMatch(/import\s*\{\s*getArticleVisualPublicUrl\s*\}\s*from\s*["']\.\/articleVisualStorageService["']/);
	});

	it("calls getArticleVisualPublicUrl(...) using the loaded candidate's storage_path", () => {
		expect(codeOnly).toMatch(/getArticleVisualPublicUrl\([^)]*candidate\.storage_path[^)]*\)/);
	});

	it("never calls Storage upload or remove itself (that would duplicate the shared helper's ownership of the Storage client)", () => {
		expect(codeOnly).not.toMatch(/\.storage\.[\s\S]{0,80}\.(upload|remove)\(/);
	});
});

describe("supabase/migrations/012_article_visual_approval.sql", () => {
	const MIGRATION_PATH = resolve(process.cwd(), "supabase/migrations/012_article_visual_approval.sql");
	const migrationSource = readFileSync(MIGRATION_PATH, "utf8");
	const executableSql = migrationSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "");

	it("defines approve_article_visual as security definer with a fixed search_path", () => {
		expect(executableSql).toMatch(/create or replace function public\.approve_article_visual/);
		expect(executableSql).toMatch(/security definer/);
		expect(executableSql).toMatch(/set search_path = public/);
	});

	it("checks is_active_editor_or_admin() before making any change", () => {
		expect(executableSql).toMatch(/if not public\.is_active_editor_or_admin\(\) then\s*\n\s*raise exception 'CCS_NOT_AUTHORISED';/);
	});

	it("12. derives the reviewer from auth.uid() and never accepts a reviewed_by parameter", () => {
		expect(executableSql).toMatch(/reviewed_by\s*=\s*auth\.uid\(\)/);
		expect(executableSql).not.toMatch(/p_reviewed_by/);
	});

	it("locks the article and visual rows before mutating them (row-level concurrency control)", () => {
		expect(executableSql).toMatch(/from public\.insights_articles\s*\n\s*where id = p_article_id\s*\n\s*for update;/);
		expect(executableSql).toMatch(/from public\.article_visuals\s*\n\s*where id = p_visual_id\s*\n\s*for update;/);
	});

	it("4. raises CCS_ARTICLE_NOT_FOUND when the article row does not exist", () => {
		expect(executableSql).toMatch(/raise exception 'CCS_ARTICLE_NOT_FOUND';/);
	});

	it("5 & 6. raises CCS_VISUAL_NOT_FOUND and CCS_VISUAL_WRONG_ARTICLE for a missing or mismatched candidate", () => {
		expect(executableSql).toMatch(/raise exception 'CCS_VISUAL_NOT_FOUND';/);
		expect(executableSql).toMatch(/raise exception 'CCS_VISUAL_WRONG_ARTICLE';/);
	});

	it("18. rejects a superseded candidate rather than approving it implicitly", () => {
		expect(executableSql).toMatch(/if v_visual_status = 'superseded' then\s*\n\s*raise exception 'CCS_VISUAL_NOT_APPROVABLE';/);
	});

	it("23. defines an explicit idempotent no-op only when candidate status, article status, article cover URL and article cover alt text all four already agree with this candidate", () => {
		expect(executableSql).toMatch(
			/if\s*\n\s*v_visual_status = 'approved'\s*\n\s*and v_article_cover_status = 'approved'\s*\n\s*and v_article_cover_url = p_public_url\s*\n\s*and v_article_cover_alt = v_alt_text\s*\n\s*then\s*\n\s*return;\s*\n\s*end if;/,
		);
	});

	it("23. reads the article's current cover_image_url and cover_image_alt (not just cover_image_status) into the locked row so the idempotency check can compare them", () => {
		expect(executableSql).toMatch(
			/select cover_image_status, cover_image_url, cover_image_alt\s*\n\s*into v_article_cover_status, v_article_cover_url, v_article_cover_alt\s*\n\s*from public\.insights_articles/,
		);
	});

	it("23. a matching status alone is not sufficient for the no-op — the condition is a single conjunction of all four checks, so a URL or alt mismatch necessarily falls through to the reconciling writes below rather than returning early", () => {
		// The whole idempotency guard is one `if <a> and <b> and <c> and <d> then return; end if;`
		// statement — there is no separate branch that returns early on
		// status alone. Structurally proving the single-conjunction shape
		// (already asserted above) is what proves a URL-only or alt-only
		// match can never short-circuit the reconciliation writes; this
		// test additionally pins that the four conditions are the *only*
		// four inside that one `if`, so nothing else could make it more
		// lenient than intended.
		const guardMatch = executableSql.match(/if\s*\n((?:\s*(?:v_visual_status|and)[^\n]*\n)+)\s*then\s*\n\s*return;\s*\n\s*end if;/);
		expect(guardMatch).not.toBeNull();
		const guardBody = guardMatch?.[1] ?? "";
		const conditionCount = (guardBody.match(/v_visual_status = 'approved'|v_article_cover_status = 'approved'|v_article_cover_url = p_public_url|v_article_cover_alt = v_alt_text/g) ?? []).length;
		expect(conditionCount).toBe(4);
	});

	it("16 & 17. supersedes only the article's other currently approved row, leaving pending candidates untouched", () => {
		expect(executableSql).toMatch(/set status = 'superseded'\s*\n\s*where article_id = p_article_id\s*\n\s*and status = 'approved'\s*\n\s*and id <> p_visual_id;/);
		// The supersede statement is scoped to status = 'approved' only —
		// it never mentions pending_review, so a pending candidate can
		// never be touched by it.
		expect(executableSql).not.toMatch(/set status = 'superseded'[\s\S]{0,200}pending_review/);
	});

	it("10, 11, 13, 14, 15. approves the selected candidate and updates the article's live cover fields in the same function body", () => {
		expect(executableSql).toMatch(/set\s*\n\s*status = 'approved',\s*\n\s*alt_text = v_alt_text,\s*\n\s*reviewed_at = now\(\),\s*\n\s*reviewed_by = auth\.uid\(\)\s*\n\s*where id = p_visual_id;/);
		expect(executableSql).toMatch(/set\s*\n\s*cover_image_url = p_public_url,\s*\n\s*cover_image_alt = v_alt_text,\s*\n\s*cover_image_status = 'approved'\s*\n\s*where id = p_article_id;/);
	});

	it("22. every mutating statement follows all validation and locking, so a raised exception always precedes any write (Postgres runs the whole function body in one transaction, so an exception rolls back any statement that already ran)", () => {
		const firstUpdateIndex = executableSql.indexOf("update public.article_visuals");
		const lastRaiseIndex = executableSql.lastIndexOf("raise exception");
		expect(firstUpdateIndex).toBeGreaterThan(-1);
		expect(lastRaiseIndex).toBeGreaterThan(-1);
		expect(lastRaiseIndex).toBeLessThan(firstUpdateIndex);
	});

	it("24. does not touch or drop the pre-existing partial unique index that guarantees one approved row per article", () => {
		expect(executableSql).not.toMatch(/drop index/i);
		expect(executableSql).not.toMatch(/article_visuals_one_approved_per_article_idx/);
	});

	it("2 & 3. is only callable by authenticated and service_role, never by the public role", () => {
		expect(executableSql).toMatch(/revoke all\s*\n\s*on function public\.approve_article_visual\(uuid, uuid, text, text\)\s*\n\s*from public;/);
		expect(executableSql).toMatch(/grant execute\s*\n\s*on function public\.approve_article_visual\(uuid, uuid, text, text\)\s*\n\s*to authenticated;/);
	});

	it("does not construct a Supabase Storage URL itself (the trusted public URL is passed in, derived by the TypeScript service)", () => {
		expect(executableSql).not.toMatch(/storage\.objects|getPublicUrl|supabase_storage/i);
	});
});
