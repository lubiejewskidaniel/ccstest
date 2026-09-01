import type { Locale } from "@/lib/routes";
import type { ContentBlock } from "./blocks";

export type ArticleStatus = "draft" | "in_review" | "scheduled" | "published" | "archived";
export type ArticleSource = "human" | "ai_assisted" | "ai_generated";
export type CategoryKey = "build" | "grow" | "learn" | "studio";

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
