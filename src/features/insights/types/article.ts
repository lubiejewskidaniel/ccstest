import type { Locale } from "@/lib/routes";
import type { ContentBlock } from "./blocks";

export type ArticleStatus = "draft" | "in_review" | "scheduled" | "published" | "archived";
export type ArticleSource = "human" | "ai_assisted" | "ai_generated";
export type CategoryKey = "build" | "grow" | "learn" | "studio";

/** Phase 3C.4A — the gate-facing state for the universal "every
 * published article needs its own reviewed, approved cover visual"
 * invariant (supabase/migrations/010_article_visual_gate.sql). This is
 * deliberately independent of whether `coverImageUrl`/`coverImageAlt`
 * are populated: a URL/alt existing does not by itself mean a human has
 * approved the image for publication (that's exactly the gap this type
 * exists to close). Only "approved" satisfies the publish-time gate in
 * `cms/service.ts`'s `transitionArticleStatus`.
 *
 * "generated" vs. "uploaded" provenance, and any provider/asset
 * metadata, belong to a later sub-phase (3C.4B's `article_visuals`
 * table) — this type intentionally carries none of that yet. */
export type ArticleCoverImageStatus = "missing" | "pending_review" | "approved";

export type Category = {
  id: string;
  key: CategoryKey;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
};

export type Tag = {
  id: string;
  slug: string;
  name: string;
};

/** An article, already resolved to a single locale's display strings —
 * the shape every public Insights component renders from. Mapped from
 * the raw `insights_articles` row by `src/features/insights/data/mappers.ts`,
 * which is the only place that knows about the database column names. */
export type Article = {
  id: string;
  locale: Locale;
  slug: string;
  translationOf: string | null;

  category: Category;
  tags: Tag[];

  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  coverImageStatus: ArticleCoverImageStatus;

  body: ContentBlock[];

  readingMinutes: number | null;
  authorName: string;

  status: ArticleStatus;
  scheduledAt: string | null;
  publishedAt: string | null;

  seoTitle: string | null;
  seoDescription: string | null;

  source: ArticleSource;
  featured: boolean;

  createdAt: string;
  updatedAt: string;
};

/** The lighter shape listing/card components need — avoids passing the
 * full parsed `body` (which can be large) into every card in a grid. */
export type ArticleSummary = Omit<Article, "body">;

export type ArticleListPage = {
  items: ArticleSummary[];
  page: number;
  pageSize: number;
  totalCount: number;
};
