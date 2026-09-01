import { createSupabasePrivilegedClient } from "@/lib/supabase/privileged";
import type { Locale } from "@/lib/routes";

export type PublishedItem = { id: string; locale: Locale; slug: string };

/**
 * Publishes every `status = 'scheduled'` article whose `scheduled_at`
 * has passed. Uses the service-role client, not
 * `cms/service.ts`'s `transitionArticleStatus` — this runs from a
 * cron-triggered route with no signed-in editor session to check
 * (`getAdminSession()` would always return null here), the same reason
 * public lead writes go through `createSupabasePrivilegedClient()`
 * instead of the session-aware client (`docs/INSIGHTS_AUDIT.md`'s "public
 * write model" applies equally to "no human is present for this write").
 * The route calling this (`src/app/api/v1/scheduler/publish/route.ts`)
 * is the actual authorization boundary, via a shared secret.
 *
 * The `published_at`-set-once-only rule mirrors
 * `transitionArticleStatus`'s logic exactly (docs/INSIGHTS_DATABASE.md
 * §2.3) — duplicated here as a few lines rather than extracted into a
 * shared helper, to avoid touching the already-verified `cms/service.ts`
 * for a Checkpoint 8 change.
 */
export async function publishDueScheduledArticles(): Promise<PublishedItem[]> {
	const supabase = createSupabasePrivilegedClient();
	if (!supabase) return [];

	const nowIso = new Date().toISOString();

	const { data: due } = await supabase
		.from("insights_articles")
		.select("id, locale, slug, published_at")
		.eq("status", "scheduled")
		.lte("scheduled_at", nowIso);

	if (!due || due.length === 0) return [];

	const published: PublishedItem[] = [];

	for (const row of due) {
		const patch: Record<string, unknown> = { status: "published", scheduled_at: null };
		if (!row.published_at) patch.published_at = nowIso;

		const { error } = await supabase.from("insights_articles").update(patch).eq("id", row.id);
		if (error) {
			console.error(`[scheduler] failed to publish article ${row.id}:`, error.message);
			continue;
		}

		published.push({ id: row.id, locale: row.locale as Locale, slug: row.slug as string });
	}

	return published;
}
