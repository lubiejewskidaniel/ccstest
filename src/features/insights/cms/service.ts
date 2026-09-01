import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/supabase/adminAuth";
import { articleInputSchema, statusTransitionSchema, type ArticleInput } from "./schema";

/**
 * Business logic + data access for the Insights CMS — the write-side
 * sibling of `cms/queries.ts`, following the same "separate transport
 * from logic" shape as `src/features/leads/service.ts`:
 *
 *   src/lib/actions/insightsCms.ts ("use server") — FormData → this module
 *
 * This file is server-only but does not itself carry "use server" - it's
 * a plain module only ever imported from Server Actions.
 *
 * Every function re-checks `getAdminSession()` before writing, on top of
 * the RLS policies the session-aware client is already subject to — RLS
 * is the real boundary (an unauthorized write is rejected at the
 * database regardless), this check just turns that into a clear "not
 * authorized" result instead of a raw Postgres error surfacing in the UI.
 */

export type CmsResult =
	| { ok: true; id: string }
	| { ok: false; kind: "auth"; message: string }
	| { ok: false; kind: "validation"; fieldErrors: Record<string, string> }
	| { ok: false; kind: "persistence"; message: string };

function zodToFieldErrors(error: z.ZodError): Record<string, string> {
	const out: Record<string, string> = {};
	for (const issue of error.issues) {
		const key = issue.path.join(".") || "form";
		if (!out[key]) out[key] = issue.message;
	}
	return out;
}

function toRow(input: ArticleInput) {
	return {
		locale: input.locale,
		slug: input.slug,
		translation_of: input.translationOf,
		category_id: input.categoryId,
		title: input.title,
		excerpt: input.excerpt,
		cover_image_url: input.coverImageUrl,
		cover_image_alt: input.coverImageAlt,
		body: input.body,
		reading_minutes: input.readingMinutes,
		author_name: input.authorName,
		status: input.status,
		scheduled_at: input.status === "scheduled" ? input.scheduledAt : null,
		// published_at is set separately by transitionArticleStatus's
		// publish path, never here — creating/editing a row does not by
		// itself count as "the first time it went live".
		seo_title: input.seoTitle,
		seo_description: input.seoDescription,
		featured: input.featured,
		source: input.source,
	};
}

async function requireEditorSession() {
	const session = await getAdminSession();
	if (!session?.isEditor) {
		return null;
	}
	return session;
}

export async function createArticle(raw: unknown): Promise<CmsResult> {
	const session = await requireEditorSession();
	if (!session) return { ok: false, kind: "auth", message: "You must be signed in as an editor to do this." };

	const parsed = articleInputSchema.safeParse(raw);
	if (!parsed.success) return { ok: false, kind: "validation", fieldErrors: zodToFieldErrors(parsed.error) };

	const supabase = await createSupabaseServerClient();
	if (!supabase) {
		return { ok: false, kind: "persistence", message: "Supabase isn't configured in this environment." };
	}

	const row = toRow(parsed.data);
	const { data, error } = await supabase.from("insights_articles").insert(row).select("id").single();

	if (error || !data) {
		return { ok: false, kind: "persistence", message: describeWriteError(error?.message) };
	}

	await syncTags(supabase, data.id, parsed.data.tagIds);

	return { ok: true, id: data.id };
}

export async function updateArticle(id: string, raw: unknown): Promise<CmsResult> {
	const session = await requireEditorSession();
	if (!session) return { ok: false, kind: "auth", message: "You must be signed in as an editor to do this." };

	const parsed = articleInputSchema.safeParse(raw);
	if (!parsed.success) return { ok: false, kind: "validation", fieldErrors: zodToFieldErrors(parsed.error) };

	const supabase = await createSupabaseServerClient();
	if (!supabase) {
		return { ok: false, kind: "persistence", message: "Supabase isn't configured in this environment." };
	}

	const row = toRow(parsed.data);
	const { error } = await supabase.from("insights_articles").update(row).eq("id", id);

	if (error) return { ok: false, kind: "persistence", message: describeWriteError(error.message) };

	await syncTags(supabase, id, parsed.data.tagIds);

	return { ok: true, id };
}

/**
 * Publish / schedule / archive / back-to-draft — a narrower write than
 * `updateArticle` (only touches status + the two timestamp columns it
 * implies), so a quick action button doesn't need to resubmit the whole
 * editor form. `published_at` is set once, the first time an article
 * transitions into `published`, and is never cleared by a later
 * transition (docs/INSIGHTS_DATABASE.md §2.3) — an archived-then-
 * republished article keeps its original publish date.
 */
export async function transitionArticleStatus(raw: unknown): Promise<CmsResult> {
	const session = await requireEditorSession();
	if (!session) return { ok: false, kind: "auth", message: "You must be signed in as an editor to do this." };

	const parsed = statusTransitionSchema.safeParse(raw);
	if (!parsed.success) return { ok: false, kind: "validation", fieldErrors: zodToFieldErrors(parsed.error) };

	const supabase = await createSupabaseServerClient();
	if (!supabase) {
		return { ok: false, kind: "persistence", message: "Supabase isn't configured in this environment." };
	}

	const { id, status, scheduledAt } = parsed.data;

	if (status === "scheduled" && !scheduledAt) {
		return { ok: false, kind: "validation", fieldErrors: { scheduledAt: "Pick a date and time to schedule for." } };
	}

	const patch: Record<string, unknown> = { status };
	if (status === "scheduled") patch.scheduled_at = scheduledAt;
	if (status !== "scheduled") patch.scheduled_at = null;

	if (status === "published") {
		// Only set published_at if it isn't already set (a re-publish after
		// archiving keeps the original date) — a single UPDATE can express
		// this with a raw SQL fragment, which the JS client doesn't support
		// directly, so it's done as a read-then-conditionally-write pair.
		const { data: existing } = await supabase.from("insights_articles").select("published_at").eq("id", id).maybeSingle();
		if (!existing?.published_at) patch.published_at = new Date().toISOString();
	}

	const { error } = await supabase.from("insights_articles").update(patch).eq("id", id);
	if (error) return { ok: false, kind: "persistence", message: describeWriteError(error.message) };

	return { ok: true, id };
}

/** Replaces an article's tag set entirely — simpler and safer than
 * diffing add/remove for a form that always submits the full desired
 * set of tag ids. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncTags(supabase: any, articleId: string, tagIds: string[]) {
	await supabase.from("insights_article_tags").delete().eq("article_id", articleId);
	if (tagIds.length === 0) return;
	await supabase.from("insights_article_tags").insert(tagIds.map((tagId) => ({ article_id: articleId, tag_id: tagId })));
}

function describeWriteError(message?: string): string {
	if (message?.includes("insights_articles_locale_slug_key") || message?.includes("duplicate key")) {
		return "An article with this slug already exists for this language. Choose a different slug.";
	}
	return "We couldn't save this article. Please try again in a moment.";
}
