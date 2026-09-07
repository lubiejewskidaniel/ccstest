import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabasePrivilegedClient } from "@/lib/supabase/privileged";
import { getAdminSession } from "@/lib/supabase/adminAuth";
import type { Locale } from "@/lib/routes";
import { pingIndexNow } from "../seo/indexNow";
import { articleUrl } from "../seo/paths";
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

/** Fires a best-effort IndexNow submission for an article that just
 * transitioned into "published", or that was already published and
 * has just been re-saved — the two write paths below
 * (`transitionArticleStatus` and `updateArticle`) that can make a
 * public URL newly live or meaningfully changed. Reuses the exact
 * `pingIndexNow()` / `articleUrl()` the scheduler's publish route
 * already calls, so there is exactly one URL-building path and one
 * submission implementation behind all three triggers.
 * `pingIndexNow` already never throws (a submission failure is
 * logged and swallowed inside it) — this call can never fail the
 * write that has already succeeded by the time it runs. */
async function notifyIndexNowOfPublish(locale: Locale, slug: string) {
	await pingIndexNow([articleUrl(slug, locale)]);
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

	// IndexNow: ArticleEditorForm always resubmits the article's *current*
	// status unchanged (its hidden `status` field mirrors `article.status`
	// exactly — publishing/scheduling only ever happens through
	// `transitionArticleStatus` above, never through this form). So
	// `parsed.data.status === "published"` here means exactly one thing:
	// an already-published article's content was just edited and saved,
	// and its public URL should be resubmitted — never a brand-new
	// publish (that's `transitionArticleStatus`'s job above) and never a
	// draft/in_review/scheduled/archived save.
	if (parsed.data.status === "published") {
		await notifyIndexNowOfPublish(parsed.data.locale, parsed.data.slug);
	}

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

	// Read the row's current status/locale/slug up front whenever this
	// transition targets "published" — needed both for the existing
	// published_at-set-once logic below and to know (a) whether this is
	// actually a non-published -> published transition worth telling
	// IndexNow about, and (b) the locale-correct URL to submit, without
	// a second read after the write below. The same read also carries
	// the three cover-image columns the Phase 3C.4A publication gate
	// checks immediately below — deliberately the row's CURRENT stored
	// state, read fresh from the database right before this mutation,
	// never anything the client submitted on this same request:
	// `statusTransitionSchema` only ever accepts `id`/`status`/
	// `scheduledAt` (see ./schema.ts), so there is no `coverImageStatus`
	// field on `parsed.data` a caller could set to "approved" to bypass
	// review even if it tried.
	let indexNowTarget: { locale: Locale; slug: string } | null = null;

	if (status === "published") {
		const { data: existing, error: existingError } = await supabase
			.from("insights_articles")
			.select("status, published_at, locale, slug, cover_image_status, cover_image_url, cover_image_alt")
			.eq("id", id)
			.maybeSingle();

		// A failure to even READ the current row (connection error, RLS
		// surprise, etc.) is a storage/persistence problem, not "the
		// cover image is missing" — must not be folded into the gate's
		// validation failure below, which would misreport a database
		// outage as "you forgot to add a cover image".
		if (existingError) {
			return { ok: false, kind: "persistence", message: describeWriteError(existingError.message) };
		}

		// Phase 3C.4A — universal publication gate (docs: Phase 3C.4
		// design report). Applies to every article regardless of origin
		// (manually created, AI-promoted, recommendation-originated,
		// future workflows) because this is the one shared path every one
		// of those flows already goes through to reach "published" — see
		// promote.ts, which only ever creates "in_review" articles and
		// never calls this function itself.
		//
		// Gated on isNewPublish, NOT on the requested target status
		// alone: the approved design is explicit that existing published
		// articles are never demoted or retroactively invalidated, and
		// the invariant applies to a *future transition into* published,
		// not to "the row happens to already be published and is being
		// resaved/re-transitioned with the same status". Without this
		// distinction, a published -> published call (a legitimate,
		// pre-existing case this same function already handles below via
		// the indexNowTarget/published_at logic) would incorrectly
		// re-reject a legacy article whose cover_image_status defaulted
		// to "missing" from migration 010, even though it is already
		// live and this call changes nothing about that.
		const isNewPublish = existing?.status !== "published";

		// All three checks are mandatory; none is trusted alone:
		//   - cover_image_status alone doesn't prove a URL/alt exist,
		//   - cover_image_url alone doesn't prove a human reviewed it,
		//   - cover_image_alt alone doesn't prove either of the above.
		// `.trim().length > 0` (not a plain truthiness check) so a
		// whitespace-only value set by any future editor UI is treated
		// the same as empty, not as "present". A missing row (`existing`
		// null -- e.g. an id that no longer exists) counts as a new
		// publish attempt and also fails this check rather than silently
		// proceeding, since there is nothing to have approved a cover
		// image for.
		if (
			isNewPublish &&
			(existing?.cover_image_status !== "approved" ||
				!(typeof existing.cover_image_url === "string" && existing.cover_image_url.trim().length > 0) ||
				!(typeof existing.cover_image_alt === "string" && existing.cover_image_alt.trim().length > 0))
		) {
			return {
				ok: false,
				kind: "validation",
				fieldErrors: { coverImage: "Add and approve a cover image with alt text before publishing." },
			};
		}

		// Only set published_at if it isn't already set (a re-publish after
		// archiving keeps the original date) — a single UPDATE can express
		// this with a raw SQL fragment, which the JS client doesn't support
		// directly, so it's done as a read-then-conditionally-write pair.
		if (!existing?.published_at) patch.published_at = new Date().toISOString();

		// Never submit draft/in_review/scheduled/archived URLs, and never
		// resubmit an article that was already published before this call
		// (an archive-then-republish, or an unrelated field change made via
		// this same transition) — only an actual non-published -> published
		// transition is new discovery-worthy information for IndexNow.
		if (existing && existing.status !== "published") {
			indexNowTarget = { locale: existing.locale as Locale, slug: existing.slug as string };
		}
	}

	const { error } = await supabase.from("insights_articles").update(patch).eq("id", id);
	if (error) return { ok: false, kind: "persistence", message: describeWriteError(error.message) };

	// Only after the database write above has already succeeded — an
	// IndexNow outage must never block or roll back a publish.
	if (indexNowTarget) {
		await notifyIndexNowOfPublish(indexNowTarget.locale, indexNowTarget.slug);
	}

	return { ok: true, id };
}

/**
 * Hard delete — admin-only, not editor. `insights_articles` has no RLS
 * delete policy for the ordinary session-aware client at all (by
 * design: archiving is how content is normally retired), so this goes
 * through the service-role client instead, the same pattern already
 * used for the cron scheduler's writes
 * (`src/features/insights/publishing/scheduler.ts`) — not a new
 * privilege boundary, just the one path this app already uses whenever
 * an action needs to bypass RLS outright. Related rows (tag links,
 * brief/opportunity back-references) are already `on delete cascade`/
 * `on delete set null` at the schema level, so no manual cleanup is
 * needed here.
 */
export async function deleteArticle(id: string): Promise<CmsResult> {
	const session = await getAdminSession();
	if (!session?.isAdmin) return { ok: false, kind: "auth", message: "Only an admin can permanently delete an article." };

	const supabase = createSupabasePrivilegedClient();
	if (!supabase) return { ok: false, kind: "persistence", message: "Supabase isn't configured in this environment." };

	const { error } = await supabase.from("insights_articles").delete().eq("id", id);
	if (error) return { ok: false, kind: "persistence", message: "We couldn't delete this article. Please try again." };

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
