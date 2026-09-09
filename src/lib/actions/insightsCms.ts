"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createArticle, updateArticle, transitionArticleStatus, deleteArticle } from "@/features/insights/cms/service";
import { approveArticleVisual } from "@/features/content-intelligence/visuals/articleVisualReviewService";
import { generateArticleVisualCandidate } from "@/features/content-intelligence/visuals/articleVisualGenerationService";
import { deleteArticleVisual } from "@/features/content-intelligence/visuals/articleVisualDeletionService";
import { routes } from "@/lib/routes";
import { articlePath } from "@/features/insights/seo/paths";

/**
 * Server Actions - the form-facing transport for the Insights CMS.
 * FormData → `src/features/insights/cms/service.ts`, mirroring
 * `src/lib/actions/leads.ts`'s shape exactly. All validation and
 * persistence live in the service module; this file only adapts
 * `FormData` into a plain object and adapts the result back into the
 * `CmsFormState` `useActionState` needs.
 */

export type CmsFormState = {
	status: "idle" | "success" | "error";
	message?: string;
	fieldErrors?: Record<string, string>;
};

function parseBodyJson(raw: FormDataEntryValue | null): { value: unknown } | { error: string } {
	const text = String(raw ?? "").trim() || "[]";
	try {
		return { value: JSON.parse(text) };
	} catch {
		return { error: "Body must be valid JSON — check for a missing comma or bracket." };
	}
}

function articleInputFromFormData(formData: FormData, bodyValue: unknown) {
	return {
		locale: formData.get("locale"),
		slug: formData.get("slug"),
		translationOf: formData.get("translationOf") ?? "",
		categoryId: formData.get("categoryId"),
		tagIds: formData.getAll("tagIds"),
		title: formData.get("title"),
		excerpt: formData.get("excerpt"),
		coverImageUrl: formData.get("coverImageUrl") ?? "",
		coverImageAlt: formData.get("coverImageAlt") ?? "",
		body: bodyValue,
		readingMinutes: formData.get("readingMinutes") ?? "",
		authorName: formData.get("authorName"),
		status: formData.get("status"),
		scheduledAt: formData.get("scheduledAt") ?? "",
		seoTitle: formData.get("seoTitle") ?? "",
		seoDescription: formData.get("seoDescription") ?? "",
		featured: formData.get("featured") === "on",
		source: formData.get("source") || undefined,
	};
}

/** Revalidates every public surface a published/archived article could
 * appear on. Deliberately broad (hub + both category/tag listing trees +
 * the article page itself) rather than trying to compute the precise
 * affected set — publishing is infrequent enough that over-revalidating
 * costs nothing, and under-revalidating would mean stale content on a
 * page an editor just expected to be live. */
function revalidateInsightsSurfaces(locale: "en" | "pl", slug: string) {
	revalidatePath(routes.insights[locale]);
	revalidatePath(articlePath(slug, locale));
}

export async function createArticleAction(_prevState: CmsFormState, formData: FormData): Promise<CmsFormState> {
	const body = parseBodyJson(formData.get("bodyJson"));
	if ("error" in body) return { status: "error", fieldErrors: { body: body.error } };

	const result = await createArticle(articleInputFromFormData(formData, body.value));

	if (!result.ok) {
		if (result.kind === "validation") return { status: "error", fieldErrors: result.fieldErrors };
		return { status: "error", message: result.message };
	}

	const locale = String(formData.get("locale")) as "en" | "pl";
	const slug = String(formData.get("slug"));
	revalidateInsightsSurfaces(locale, slug);
	redirect(`/admin/insights/${result.id}/edit?created=1`);
}

export async function updateArticleAction(
	id: string,
	_prevState: CmsFormState,
	formData: FormData,
): Promise<CmsFormState> {
	const body = parseBodyJson(formData.get("bodyJson"));
	if ("error" in body) return { status: "error", fieldErrors: { body: body.error } };

	const result = await updateArticle(id, articleInputFromFormData(formData, body.value));

	if (!result.ok) {
		if (result.kind === "validation") return { status: "error", fieldErrors: result.fieldErrors };
		return { status: "error", message: result.message };
	}

	const locale = String(formData.get("locale")) as "en" | "pl";
	const slug = String(formData.get("slug"));
	revalidateInsightsSurfaces(locale, slug);
	return { status: "success" };
}

/** Bound with an article's id/locale/slug from the admin list/edit page
 * so a plain button can call this like a normal async function (Server
 * Actions can be invoked directly from a Client Component, not just via
 * a `<form action>`). `scheduledAt` is only required when transitioning
 * into `"scheduled"`. */
export async function setArticleStatusAction(
	args: { id: string; locale: "en" | "pl"; slug: string },
	status: string,
	scheduledAt?: string,
) {
	const result = await transitionArticleStatus({ id: args.id, status, scheduledAt });
	if (result.ok) revalidateInsightsSurfaces(args.locale, args.slug);
	return result;
}

/** Admin-only hard delete, bound the same way as `setArticleStatusAction`.
 * Also revalidates the Insights hub in case the deleted article was live. */
export async function deleteArticleAction(args: { id: string; locale: "en" | "pl"; slug: string }) {
	const result = await deleteArticle(args.id);
	if (result.ok) revalidateInsightsSurfaces(args.locale, args.slug);
	return result;
}


/** Bound with an article's id/locale/slug from the admin edit page, the
 * same way as `setArticleStatusAction` — approving a cover image is a
 * narrower write than the full article form, so a review action button
 * doesn't need to resubmit it. Contains no approval logic itself; that
 * all lives in `approveArticleVisual` (and the `approve_article_visual`
 * database function it calls), which is the only place
 * `cover_image_status` is allowed to become `"approved"`. */
export async function approveArticleVisualAction(args: {
	articleId: string;
	visualId: string;
	altText: string;
	locale: "en" | "pl";
	slug: string;
}) {
	const result = await approveArticleVisual({ articleId: args.articleId, visualId: args.visualId, altText: args.altText });
	if (result.ok) {
		revalidatePath(`/admin/insights/${args.articleId}/edit`);
		revalidateInsightsSurfaces(args.locale, args.slug);
	}
	return result;
}

/** Bound with an article's id/locale/slug from the admin edit page, the
 * same way as `approveArticleVisualAction` -- transport/revalidation
 * only, exactly like every other action in this file. Contains no
 * generation business logic itself: authentication, editor
 * authorization, article/category/brief validation, the single
 * provider call, and the storage handoff are all owned by
 * `generateArticleVisualCandidate` (Phase 3C.4B.5B). This action never
 * receives or forwards a prompt, provider id, image bytes, a URL, a
 * storage path, an API key, or a `reviewedBy` value from the client --
 * the only input it accepts is the same `{ articleId, locale, slug }`
 * shape `approveArticleVisualAction` already uses.
 *
 * Only revalidates the admin edit route on success. Unlike approval,
 * a freshly generated candidate is always `pending_review` -- it can
 * never be publicly visible -- so there is no real reason to also
 * revalidate the public Insights surfaces the way
 * `approveArticleVisualAction` does; a failed generation revalidates
 * nothing at all. */
export async function generateArticleVisualAction(args: { articleId: string; locale: "en" | "pl"; slug: string }) {
	const result = await generateArticleVisualCandidate(args.articleId);
	if (result.ok) {
		revalidatePath(`/admin/insights/${args.articleId}/edit`);
	}
	return result;
}

/** Bound with an article's id/locale/slug from the admin edit page, the
 * same way as `approveArticleVisualAction`/`generateArticleVisualAction`
 * -- transport/revalidation only. Contains no deletion business logic
 * itself: authentication, editor authorization, article/candidate
 * lookup, ownership validation, deletable-status validation, the
 * Storage object delete, and the database row delete are all owned by
 * `deleteArticleVisual` (Phase 3C.4B.7A). This action never receives or
 * forwards a storage path, a public URL, a provider id, a reviewedBy
 * value, or a status/approved field from the client -- the only input
 * it accepts is the same `{ articleId, visualId, locale, slug }` shape
 * `approveArticleVisualAction` already uses.
 *
 * Only revalidates the admin edit route on success. An `approved`
 * candidate can never be deleted (`deleteArticleVisual`'s own locked
 * rule), so a successful deletion here can only ever remove a
 * `pending_review` or `superseded` row -- neither is ever publicly
 * visible, so there is no real reason to also revalidate the public
 * Insights surfaces the way `approveArticleVisualAction` does. This
 * action never calls `transitionArticleStatus` or any publication
 * logic, and a failed deletion revalidates nothing at all. */
export async function deleteArticleVisualAction(args: { articleId: string; visualId: string; locale: "en" | "pl"; slug: string }) {
	const result = await deleteArticleVisual({ articleId: args.articleId, visualId: args.visualId });
	if (result.ok) {
		revalidatePath(`/admin/insights/${args.articleId}/edit`);
	}
	return result;
}
