import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Locale } from "@/lib/routes";
import type { Article, ArticleListPage, ArticleSummary, Category, Tag } from "../types/article";
import { mapArticle, mapArticleSummary, mapCategory, mapTag } from "./mappers";

/**
 * Public, read-only query surface for the Insights subsystem. Every
 * function here:
 *
 * - is safe to call with no Supabase configuration (returns an empty/
 *   null result instead of throwing — the same "safe without a real
 *   backend" fallback every other Supabase-backed feature in this app
 *   uses),
 * - relies on RLS to enforce "published only" (docs/INSIGHTS_DATABASE.md
 *   §3) rather than adding its own status filter as the only line of
 *   defense,
 * - is the ONLY place that talks to the `insights_*` tables for public
 *   pages. CMS/admin query functions (Checkpoint 3) live in a separate,
 *   parallel module and are never imported from `src/app/insights/**`
 *   or `src/app/pl/wiedza/**` (docs/INSIGHTS_ARCHITECTURE.md §5).
 */

const SUMMARY_COLUMNS = `
  id, locale, slug, translation_of, title, excerpt, cover_image_url,
  cover_image_alt, cover_image_status, reading_minutes, author_name, status, scheduled_at,
  published_at, seo_title, seo_description, source, featured,
  created_at, updated_at,
  category:insights_categories!inner(*),
  insights_article_tags(tag:insights_tags(*))
`;

const ARTICLE_COLUMNS = `${SUMMARY_COLUMNS.trim()}, body`;

export async function getPublishedArticleBySlug(locale: Locale, slug: string): Promise<Article | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("insights_articles")
    .select(ARTICLE_COLUMNS)
    .eq("locale", locale)
    .eq("slug", slug)
    .maybeSingle();

  if (!data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return mapArticle(data as any);
}

export async function listPublishedArticles(
  locale: Locale,
  options: { categorySlug?: string; tagSlug?: string; page?: number; pageSize?: number } = {},
): Promise<ArticleListPage> {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 12;
  const empty: ArticleListPage = { items: [], page, pageSize, totalCount: 0 };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return empty;

  let query = supabase
    .from("insights_articles")
    .select(SUMMARY_COLUMNS, { count: "exact" })
    .eq("locale", locale)
    .order("published_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (options.categorySlug) {
    const categoryColumn = locale === "pl" ? "slug_pl" : "slug_en";
    query = query.eq(`category.${categoryColumn}`, options.categorySlug);
  }

  const { data, count } = await query;
  if (!data) return empty;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let items = data.map((row: any) => mapArticleSummary(row)).filter((a): a is ArticleSummary => a !== null);

  // Tag filtering is applied after mapping (a many-to-many `.contains`
  // filter on the joined table is awkward to express reliably across
  // Supabase client versions) — acceptable at this page size; revisit
  // with a dedicated RPC if tag listing pages need real pagination.
  if (options.tagSlug) {
    items = items.filter((article) => article.tags.some((tag) => tag.slug === options.tagSlug));
  }

  return { items, page, pageSize, totalCount: count ?? items.length };
}

export async function listFeaturedArticles(locale: Locale, limit = 1): Promise<ArticleSummary[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("insights_articles")
    .select(SUMMARY_COLUMNS)
    .eq("locale", locale)
    .eq("featured", true)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (!data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => mapArticleSummary(row)).filter((a): a is ArticleSummary => a !== null);
}

export async function listCategories(locale: Locale): Promise<Category[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("insights_categories")
    .select("*")
    .order("sort_order", { ascending: true });

  if (!data) return [];
  return data.map((row) => mapCategory(row, locale));
}

/** All tags, alphabetical by locale display name — used both by a future
 * tag-cloud UI and by the CMS editor's tag picker (docs/INSIGHTS_
 * ARCHITECTURE.md §5: reading taxonomy is fine to share, only content
 * reads/writes are kept in separate public/admin modules). */
export async function listTags(locale: Locale): Promise<Tag[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const column = locale === "pl" ? "name_pl" : "name_en";
  const { data } = await supabase.from("insights_tags").select("*").order(column, { ascending: true });

  if (!data) return [];
  return data.map((row) => mapTag(row, locale));
}


export async function getCategoryBySlug(locale: Locale, slug: string): Promise<Category | null> {
  const categories = await listCategories(locale);
  return categories.find((category) => category.slug === slug) ?? null;
}

export async function getTagBySlug(locale: Locale, slug: string): Promise<Tag | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const column = locale === "pl" ? "slug_pl" : "slug_en";
  const { data } = await supabase.from("insights_tags").select("*").eq(column, slug).maybeSingle();
  if (!data) return null;
  return mapTag(data, locale);
}

/** Lean read for `src/app/sitemap.ts` — just enough to build a sitemap
 * entry, deliberately skipping the category/tag joins the full listing
 * queries carry (docs/INSIGHTS_AUDIT.md §4, "duplicate sitemap logic"
 * risk: `lastmod` must come from the real content record, not a static
 * default). */
export async function listPublishedArticlesForSitemap(
  locale: Locale,
): Promise<{ slug: string; updatedAt: string }[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("insights_articles")
    .select("slug, updated_at")
    .eq("locale", locale)
    .eq("status", "published");

  return (data ?? []).map((row) => ({ slug: row.slug as string, updatedAt: row.updated_at as string }));
}

/** Lean read for the RSS feed route handlers — most-recent published
 * articles with just the fields a feed item needs. */
export async function listPublishedArticlesForFeed(
  locale: Locale,
  limit = 30,
): Promise<{ slug: string; title: string; excerpt: string; authorName: string; publishedAt: string }[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("insights_articles")
    .select("slug, title, excerpt, author_name, published_at")
    .eq("locale", locale)
    .order("published_at", { ascending: false })
    .limit(limit);

  return (data ?? [])
    .filter((row) => row.published_at)
    .map((row) => ({
      slug: row.slug as string,
      title: row.title as string,
      excerpt: row.excerpt as string,
      authorName: row.author_name as string,
      publishedAt: row.published_at as string,
    }));
}


/** Resolves an article's translation counterpart, for the language
 * switch's per-article fallback (docs/INSIGHTS_ARCHITECTURE.md §2). */
export async function getArticleTranslation(article: Article): Promise<Article | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const otherLocale: Locale = article.locale === "en" ? "pl" : "en";

  // Direction 1: this article points at its translation.
  if (article.translationOf) {
    const { data } = await supabase
      .from("insights_articles")
      .select(ARTICLE_COLUMNS)
      .eq("id", article.translationOf)
      .eq("locale", otherLocale)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (data) return mapArticle(data as any);
  }

  // Direction 2: the other article points back at this one.
  const { data } = await supabase
    .from("insights_articles")
    .select(ARTICLE_COLUMNS)
    .eq("translation_of", article.id)
    .eq("locale", otherLocale)
    .eq("status", "published")
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data ? mapArticle(data as any) : null;
}

/**
 * Search over published articles — title/excerpt substring match (ILIKE),
 * not full-text ranking. docs/INSIGHTS_DATABASE.md §7 deliberately
 * deferred a `tsvector`/GIN index until real search UI and query
 * patterns existed to design its field weights against; this is that
 * "good enough for now" v1, upgradeable later without changing this
 * function's signature or callers.
 */
export async function searchPublishedArticles(
  locale: Locale,
  query: string,
  limit = 20,
): Promise<ArticleSummary[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  // Escape `%`/`_` (SQL LIKE wildcards) so a literal search for one of
  // those characters doesn't behave like a wildcard, then wrap the whole
  // value in double quotes — PostgREST's `.or()` filter syntax uses `,`
  // and `()` as structural characters, and quoting the value is its own
  // documented way to pass through a value that might contain them
  // safely, rather than trying to escape every structural character by
  // hand.
  const escaped = trimmed.replace(/[%_]/g, (char) => `\\${char}`).replace(/"/g, '\\"');
  const pattern = `%${escaped}%`;

  const { data } = await supabase
    .from("insights_articles")
    .select(SUMMARY_COLUMNS)
    .eq("locale", locale)
    .or(`title.ilike."${pattern}",excerpt.ilike."${pattern}"`)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (!data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => mapArticleSummary(row)).filter((a): a is ArticleSummary => a !== null);
}

