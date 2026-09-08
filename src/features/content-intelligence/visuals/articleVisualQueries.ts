import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getArticleVisualPublicUrl } from "./articleVisualStorageService";
import type { ArticleVisualSourceType, ArticleVisualStatus } from "./articleVisualStorage";

/**
 * Admin-only read model for article visual candidates — the read-side
 * sibling of `articleVisualReviewService.ts`, following the same
 * "queries stay separate from writes" shape as
 * `src/features/insights/cms/queries.ts`. Not used by any UI yet
 * (Phase 3C.4B.4B); this exists so the review UI has something to call.
 *
 * RLS (the `article_visuals` "editor select" policy from migration 011)
 * is the real access boundary here, exactly as in `cms/queries.ts` — no
 * `getAdminSession()` re-check in this file itself.
 */

export type ArticleVisualListItem = {
	id: string;
	articleId: string;
	storagePath: string;
	publicUrl: string;
	altText: string | null;
	sourceType: ArticleVisualSourceType;
	provider: string | null;
	status: ArticleVisualStatus;
	width: number;
	height: number;
	mimeType: string;
	reviewedAt: string | null;
	reviewedBy: string | null;
	createdAt: string;
};

/** Every stored candidate for one article, newest first (created_at
 * descending, with id descending as a deterministic tie-break for rows
 * sharing the same timestamp). */
export async function listArticleVisuals(articleId: string): Promise<ArticleVisualListItem[]> {
	const supabase = await createSupabaseServerClient();
	if (!supabase) return [];

	const { data } = await supabase
		.from("article_visuals")
		.select("id, article_id, storage_path, alt_text, source_type, provider, status, width, height, mime_type, reviewed_at, reviewed_by, created_at")
		.eq("article_id", articleId)
		.order("created_at", { ascending: false })
		.order("id", { ascending: false });

	if (!data) return [];

	return data.map((row) => ({
		id: row.id,
		articleId: row.article_id,
		storagePath: row.storage_path,
		publicUrl: getArticleVisualPublicUrl(supabase, row.storage_path),
		altText: row.alt_text,
		sourceType: row.source_type,
		provider: row.provider,
		status: row.status,
		width: row.width,
		height: row.height,
		mimeType: row.mime_type,
		reviewedAt: row.reviewed_at,
		reviewedBy: row.reviewed_by,
		createdAt: row.created_at,
	}));
}
