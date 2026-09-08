import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/supabase/adminAuth";
import { getArticleVisualPublicUrl } from "./articleVisualStorageService";

/**
 * Phase 3C.4B.4A — article visual approval.
 *
 * A deliberately separate module from `articleVisualStorageService.ts`:
 * storing a new candidate and reviewing/activating one are different
 * responsibilities. This file never uploads or validates image bytes,
 * and `articleVisualStorageService.ts` never approves anything.
 *
 * The actual approval — superseding the previous approved candidate,
 * marking the selected one approved and updating the article's live
 * cover fields — happens atomically inside the
 * `approve_article_visual` Postgres function
 * (`supabase/migrations/012_article_visual_approval.sql`), not as
 * separate sequential writes here. This service's job is: authenticate,
 * validate input, load and check the candidate, derive a trusted public
 * URL, call that function, and translate its result into a safe,
 * non-leaking outcome.
 */

const uuidSchema = z.string().uuid();

export type ApproveArticleVisualInput = {
	articleId: string;
	visualId: string;
	altText: string;
};

export type ApproveArticleVisualResult =
	| { ok: true }
	| { ok: false; kind: "not_configured"; message: string }
	| { ok: false; kind: "auth"; message: string }
	| { ok: false; kind: "validation"; message: string }
	| { ok: false; kind: "not_found"; message: string }
	| { ok: false; kind: "not_approvable"; message: string }
	| { ok: false; kind: "persistence"; message: string };

/** Maps a known `approve_article_visual` exception message to the
 * result kind it represents. Anything else (a genuine, unexpected
 * database error) falls through to a generic `persistence` result —
 * the raw Postgres message is never returned to a caller. */
function mapRpcError(message: string | undefined): ApproveArticleVisualResult {
	switch (message) {
		case "CCS_NOT_AUTHORISED":
			return { ok: false, kind: "auth", message: "You must be signed in as an editor to do this." };
		case "CCS_ARTICLE_NOT_FOUND":
		case "CCS_VISUAL_NOT_FOUND":
		case "CCS_VISUAL_WRONG_ARTICLE":
			return { ok: false, kind: "not_found", message: "That article or visual could not be found." };
		case "CCS_ALT_TEXT_REQUIRED":
			return { ok: false, kind: "validation", message: "Alt text is required to approve a cover image." };
		case "CCS_VISUAL_NOT_APPROVABLE":
			return { ok: false, kind: "not_approvable", message: "This candidate has already been superseded and cannot be approved." };
		default:
			return { ok: false, kind: "persistence", message: "We couldn't approve this cover image. Please try again in a moment." };
	}
}

export async function approveArticleVisual(input: ApproveArticleVisualInput): Promise<ApproveArticleVisualResult> {
	const supabase = await createSupabaseServerClient();
	if (!supabase) {
		return { ok: false, kind: "not_configured", message: "Supabase isn't configured in this environment." };
	}

	const session = await getAdminSession();
	if (!session?.isEditor) {
		return { ok: false, kind: "auth", message: "You must be signed in as an editor to do this." };
	}

	const articleId = uuidSchema.safeParse(input.articleId);
	const visualId = uuidSchema.safeParse(input.visualId);
	if (!articleId.success || !visualId.success) {
		return { ok: false, kind: "validation", message: "Invalid article or visual id." };
	}

	const altText = input.altText.trim();
	if (altText === "") {
		return { ok: false, kind: "validation", message: "Alt text is required to approve a cover image." };
	}

	const { data: candidate, error: candidateError } = await supabase
		.from("article_visuals")
		.select("id, article_id, storage_path")
		.eq("id", visualId.data)
		.maybeSingle();

	if (candidateError) {
		return { ok: false, kind: "persistence", message: "We couldn't load this candidate. Please try again in a moment." };
	}
	if (!candidate || candidate.article_id !== articleId.data) {
		return { ok: false, kind: "not_found", message: "That article or visual could not be found." };
	}

	const publicUrl = getArticleVisualPublicUrl(supabase, candidate.storage_path);

	const { error: rpcError } = await supabase.rpc("approve_article_visual", {
		p_article_id: articleId.data,
		p_visual_id: visualId.data,
		p_alt_text: altText,
		p_public_url: publicUrl,
	});

	if (rpcError) {
		return mapRpcError(rpcError.message);
	}

	return { ok: true };
}
