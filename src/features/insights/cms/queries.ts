import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Locale } from "@/lib/routes";
import type { Article, ArticleSummary, ArticleStatus } from "../types/article";
import { mapArticle, mapArticleSummary } from "../data/mappers";

/**
 * Admin-only reads — the parallel, deliberately separate module from
 * `src/features/insights/data/queries.ts` (docs/INSIGHTS_ARCHITECTURE.md
 * §5). These see every status (RLS's "editor select all" policy, not the
 * public "published only" one) and are never imported from
 * `src/app/insights/**` or `src/app/pl/wiedza/**`.
 *
 * RLS is still the real access boundary here — an unauthenticated or
 * non-editor session simply gets zero rows back, since the "editor
 * select all" policy requires `is_active_editor_or_admin()`. Server
 * Actions and admin pages additionally check `getAdminSession()` before
 * ever calling these, so a denial reads as a clear redirect rather than
 * a silent empty table.
 */

const ADMIN_COLUMNS = `
  id, locale, slug, translation_of, title, excerpt, cover_image_url,
  cover_image_alt, cover_image_status, reading_minutes, author_name, status, scheduled_at,
  published_at, seo_title, seo_description, source, featured,
  created_at, updated_at,
  category:insights_categories(*),
  insights_article_tags(tag:insights_tags(*))
`;

const ADMIN_ARTICLE_COLUMNS = `${ADMIN_COLUMNS.trim()}, body`;

export async function listArticlesForAdmin(filter: { status?: ArticleStatus; locale?: Locale } = {}): Promise<ArticleSummary[]> {
	const supabase = await createSupabaseServerClient();
	if (!supabase) return [];

	let query = supabase.from("insights_articles").select(ADMIN_COLUMNS).order("updated_at", { ascending: false });

	if (filter.status) query = query.eq("status", filter.status);
	if (filter.locale) query = query.eq("locale", filter.locale);

	const { data } = await query;
	if (!data) return [];

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return data.map((row: any) => mapArticleSummary(row)).filter((a): a is ArticleSummary => a !== null);
}

export async function getArticleForAdmin(id: string): Promise<Article | null> {
	const supabase = await createSupabaseServerClient();
	if (!supabase) return null;

	const { data } = await supabase.from("insights_articles").select(ADMIN_ARTICLE_COLUMNS).eq("id", id).maybeSingle();
	if (!data) return null;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return mapArticle(data as any);
}

export type TopArticleRow = { slug: string; locale: string; viewCount: number };
export type CtaClickRow = { slug: string; ctaLocation: string; clickCount: number };

/** Reads the `insights_top_articles` SECURITY DEFINER RPC
 * (`supabase/migrations/004_analytics_events.sql`) — the function itself
 * re-checks `is_active_editor_or_admin()` before returning anything, so
 * this is safe to call with the ordinary session-aware client rather
 * than needing a privileged one. Returns an empty array (never throws)
 * when Supabase isn't configured or the caller isn't authorized, same
 * safe-degradation pattern as every other read in this app. */
export async function getTopArticles(daysBack = 30, limit = 10): Promise<TopArticleRow[]> {
	const supabase = await createSupabaseServerClient();
	if (!supabase) return [];

	const { data, error } = await supabase.rpc("insights_top_articles", { days_back: daysBack, result_limit: limit });
	if (error || !data) return [];

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (data as any[]).map((row) => ({ slug: row.slug, locale: row.locale, viewCount: Number(row.view_count) }));
}

export async function getCtaClickCounts(daysBack = 30): Promise<CtaClickRow[]> {
	const supabase = await createSupabaseServerClient();
	if (!supabase) return [];

	const { data, error } = await supabase.rpc("insights_cta_click_counts", { days_back: daysBack });
	if (error || !data) return [];

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (data as any[]).map((row) => ({
		slug: row.slug,
		ctaLocation: row.cta_location,
		clickCount: Number(row.click_count),
	}));
}
