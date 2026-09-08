import { listArticleVisuals } from "./articleVisualQueries";
import { ArticleVisualReviewList } from "./ArticleVisualReviewList";
import type { ArticleCoverImageStatus } from "@/features/insights/types/article";
import type { Locale } from "@/lib/routes";

/**
 * Phase 3C.4B.4B — the "Article visual" review panel, rendered as a
 * sibling of `ArticleStatusActions` and `ArticleEditorForm` on the admin
 * edit page (never embedded into the content form itself), following
 * the same principle `ArticleStatusActions` already establishes:
 * cross-cutting state — here, which stored candidate is the article's
 * live, approved cover — must not change as a side effect of an
 * unrelated content save.
 *
 * Server Component: loads candidates directly via `listArticleVisuals`
 * (RLS-gated, no `getAdminSession()` recheck here either, matching
 * `cms/queries.ts`'s convention) and passes down only the article
 * fields actually needed to establish active-cover context alongside
 * them — `coverImageAlt` plays no part in that (the legacy note and
 * consistency check only need the URL and status), so it isn't
 * threaded through. The interactive review/approve behaviour lives
 * entirely in the client child, `ArticleVisualReviewList`.
 */
export async function ArticleVisualReviewPanel({
	articleId,
	locale,
	slug,
	coverImageUrl,
	coverImageStatus,
}: {
	articleId: string;
	locale: Locale;
	slug: string;
	coverImageUrl: string | null;
	coverImageStatus: ArticleCoverImageStatus;
}) {
	const candidates = await listArticleVisuals(articleId);

	return (
		<ArticleVisualReviewList
			articleId={articleId}
			locale={locale}
			slug={slug}
			candidates={candidates}
			articleCoverImageUrl={coverImageUrl}
			articleCoverImageStatus={coverImageStatus}
		/>
	);
}
