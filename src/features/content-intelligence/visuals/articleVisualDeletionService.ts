import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/supabase/adminAuth";
import { ARTICLE_VISUALS_BUCKET } from "./articleVisualStorageService";
import type { ArticleVisualStatus } from "./articleVisualStorage";

/**
 * Phase 3C.4B.7A — deletion of an unused article visual candidate.
 *
 * A deliberately separate module from `articleVisualReviewService.ts`
 * (approval) and `articleVisualStorageService.ts` (generated/uploaded
 * candidate creation): deleting a candidate is a different
 * responsibility from either, and this file never approves, generates,
 * or uploads anything.
 *
 * LOCKED deletion rule (never relaxed here): only a `pending_review` or
 * `superseded` candidate may be physically deleted. An `approved`
 * candidate is always the article's live cover (or, in a genuinely
 * inconsistent state, still claims to be) and is never deletable in
 * this phase — there is no "remove active cover" workflow here, and
 * this module never writes `cover_image_url`, `cover_image_alt`, or
 * `cover_image_status` on `insights_articles`, never supersedes another
 * candidate, and never chooses a replacement automatically. A
 * genuinely inconsistent state is not repaired or guessed at — deletion
 * of an `approved` row simply fails, every time, with `not_deletable`.
 *
 * Uses the ordinary session-aware Supabase server client — never a
 * service-role client. RLS (`article_visuals`'s "editor delete" policy,
 * migration 013) is the real authorization backstop underneath this
 * module's own `getAdminSession()` check, exactly as approval and
 * storage already rely on RLS underneath their own application-level
 * checks.
 *
 * Deletion order and partial-failure strategy (the smallest safe
 * approach available, given Storage and Postgres are not one atomic
 * transaction):
 *   1. Load and validate the candidate row (existence, ownership by the
 *      given article, deletable status) BEFORE touching Storage.
 *   2. Delete the Storage object first, using only the trusted
 *      `storage_path` read from that row — never a client-supplied
 *      path, URL, or filename.
 *   3. Only once the Storage delete has actually succeeded, delete the
 *      `article_visuals` row.
 *   4. If the Storage delete fails, the DB row is left untouched and a
 *      `storage_error` is returned — never delete a DB row while its
 *      backing object might still exist and the delete attempt itself
 *      just failed, and never leave a DB row silently pointing at
 *      nothing.
 *   5. If the Storage delete succeeds but the DB delete then fails,
 *      this is a genuine, honestly-reported partial failure: the
 *      object is already gone, and this codebase has no existing safe,
 *      reusable mechanism to re-upload it as compensation, so none is
 *      invented here. A `database_error` result is returned describing
 *      exactly that limitation — this is never silently reported as
 *      success.
 */

const uuidSchema = z.string().uuid();

/** The only statuses this phase allows physical deletion for. `approved`
 * is deliberately absent — see this module's own doc comment above. */
const DELETABLE_STATUSES: ReadonlySet<ArticleVisualStatus> = new Set(["pending_review", "superseded"]);

export type DeleteArticleVisualInput = {
	articleId: string;
	visualId: string;
};

/** Success carries only what the UI actually needs (the id of the
 * candidate that was deleted, so the caller can log/report it) — never
 * Storage internals, never the deleted row's other fields. */
export type DeleteArticleVisualResult =
	| { ok: true; visualId: string }
	| { ok: false; kind: "not_configured"; message: string }
	| { ok: false; kind: "auth"; message: string }
	| { ok: false; kind: "validation"; message: string }
	| { ok: false; kind: "not_found"; message: string }
	| { ok: false; kind: "not_deletable"; message: string }
	| { ok: false; kind: "storage_error"; message: string }
	| { ok: false; kind: "database_error"; message: string };

export async function deleteArticleVisual(input: DeleteArticleVisualInput): Promise<DeleteArticleVisualResult> {
	// Steps 1-2: configuration + auth, exactly mirroring
	// articleVisualReviewService.ts / articleVisualStorageService.ts's
	// own requireEditorClient()-shaped checks -- kept inline here rather
	// than importing that other module's private helper, matching how
	// articleVisualReviewService.ts already does its own inline version
	// of the same two checks rather than sharing code across modules.
	const supabase = await createSupabaseServerClient();
	if (!supabase) {
		return { ok: false, kind: "not_configured", message: "Supabase isn't configured in this environment." };
	}

	const session = await getAdminSession();
	if (!session?.isEditor) {
		return { ok: false, kind: "auth", message: "You must be signed in as an editor to delete an article visual." };
	}

	// Step 3-4: valid articleId/visualId.
	const articleId = uuidSchema.safeParse(input.articleId);
	const visualId = uuidSchema.safeParse(input.visualId);
	if (!articleId.success || !visualId.success) {
		return { ok: false, kind: "validation", message: "Invalid article or visual id." };
	}

	// Steps 5-7: load the trusted candidate row. Never trusts a
	// client-supplied storage_path/status/articleId match -- everything
	// checked below comes from this one authoritative read.
	const { data: candidate, error: selectError } = await supabase
		.from("article_visuals")
		.select("id, article_id, status, storage_path")
		.eq("id", visualId.data)
		.maybeSingle();

	if (selectError) {
		return { ok: false, kind: "database_error", message: "Could not load this visual candidate. Please try again in a moment." };
	}
	if (!candidate || candidate.article_id !== articleId.data) {
		return { ok: false, kind: "not_found", message: "That article or visual could not be found." };
	}

	// Step 8: status validation. Fails safe for `approved` and for any
	// unrecognized future status alike -- never a default-allow list.
	if (!DELETABLE_STATUSES.has(candidate.status as ArticleVisualStatus)) {
		return {
			ok: false,
			kind: "not_deletable",
			message: "This candidate is the article's active cover and cannot be deleted.",
		};
	}

	// Storage delete, using only the trusted storage_path from the row
	// just loaded -- never a client-supplied path.
	const { error: removeError } = await supabase.storage.from(ARTICLE_VISUALS_BUCKET).remove([candidate.storage_path]);
	if (removeError) {
		return { ok: false, kind: "storage_error", message: "Could not remove the stored image. Please try again in a moment." };
	}

	// DB row delete. The extra `.in("status", [...])` re-check mirrors
	// the same "re-check the condition at write time, not just at the
	// earlier read" defense-in-depth pattern
	// articleVisualStorageService.ts's cover_image_status update already
	// uses -- a concurrent status change landing between this module's
	// read and this delete can never cause an approved row to be
	// removed.
	const { error: deleteError } = await supabase.from("article_visuals").delete().eq("id", visualId.data).in("status", ["pending_review", "superseded"]);

	if (deleteError) {
		// Genuine partial failure: the Storage object is already gone,
		// the database row is not. Reported honestly, never as success.
		return {
			ok: false,
			kind: "database_error",
			message: "The stored image was removed, but the candidate record could not be deleted. Please try again or contact support.",
		};
	}

	return { ok: true, visualId: visualId.data };
}
