import type { Locale } from "@/lib/routes";
import { parseArticleBody } from "../types/blocks";
import type { Article, ArticleSummary, Category, Tag } from "../types/article";

/**
 * The only place that knows the `insights_*` table column names. Every
 * query function in `queries.ts` maps its Supabase result through these
 * before returning, so components never see a raw database row.
 */

type RawCategory = {
  id: string;
  key: string;
  slug_en: string;
  slug_pl: string;
  name_en: string;
  name_pl: string;
  description_en: string | null;
  description_pl: string | null;
  sort_order: number;
};

type RawTag = {
  id: string;
  slug_en: string;
  slug_pl: string;
  name_en: string;
  name_pl: string;
};

type RawArticle = {
  id: string;
  locale: string;
  slug: string;
  translation_of: string | null;
  category: RawCategory | RawCategory[] | null;
  insights_article_tags?: { tag: RawTag | RawTag[] | null }[] | null;
  title: string;
  excerpt: string;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  body: unknown;
  reading_minutes: number | null;
  author_name: string;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  source: string;
  featured: boolean;
  created_at: string;
  updated_at: string;
};

/** Supabase's nested-select typings sometimes describe a to-one relation
 * as an array; this normalizes either shape to a single object. */
function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function mapCategory(raw: RawCategory, locale: Locale): Category {
  return {
    id: raw.id,
    key: raw.key as Category["key"],
    slug: locale === "pl" ? raw.slug_pl : raw.slug_en,
    name: locale === "pl" ? raw.name_pl : raw.name_en,
    description: (locale === "pl" ? raw.description_pl : raw.description_en) ?? null,
    sortOrder: raw.sort_order,
  };
}

export function mapTag(raw: RawTag, locale: Locale): Tag {
  return {
    id: raw.id,
    slug: locale === "pl" ? raw.slug_pl : raw.slug_en,
    name: locale === "pl" ? raw.name_pl : raw.name_en,
  };
}

/** Maps a raw row with `body` included — for a single article page. */
export function mapArticle(raw: RawArticle): Article | null {
  const category = one(raw.category);
  if (!category) return null; // a category is required by the schema; a missing join means bad data, skip rather than render broken

  const locale = raw.locale as Locale;
  const tags = (raw.insights_article_tags ?? [])
    .map((join) => one(join.tag))
    .filter((tag): tag is RawTag => tag !== null)
    .map((tag) => mapTag(tag, locale));

  return {
    id: raw.id,
    locale,
    slug: raw.slug,
    translationOf: raw.translation_of,
    category: mapCategory(category, locale),
    tags,
    title: raw.title,
    excerpt: raw.excerpt,
    coverImageUrl: raw.cover_image_url,
    coverImageAlt: raw.cover_image_alt,
    body: parseArticleBody(raw.body),
    readingMinutes: raw.reading_minutes,
    authorName: raw.author_name,
    status: raw.status as Article["status"],
    scheduledAt: raw.scheduled_at,
    publishedAt: raw.published_at,
    seoTitle: raw.seo_title,
    seoDescription: raw.seo_description,
    source: raw.source as Article["source"],
    featured: raw.featured,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

/** Maps a raw row without `body` — for listing/card grids. */
export function mapArticleSummary(raw: Omit<RawArticle, "body">): ArticleSummary | null {
  const full = mapArticle({ ...raw, body: [] } as RawArticle);
  if (!full) return null;
  const { body: _body, ...summary } = full;
  void _body;
  return summary;
}
