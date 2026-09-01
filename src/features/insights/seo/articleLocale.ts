import { routes, type Locale } from "@/lib/routes";
import type { Article } from "../types/article";
import { getArticleTranslation } from "../data/queries";
import { articlePath } from "./paths";

/**
 * Resolves where the language switch should send a visitor reading a
 * specific article (docs/INSIGHTS_ARCHITECTURE.md §2). The shared
 * `LanguageSwitch` component stays generic — it calls this for article
 * pages instead of `alternatePath()`, which only knows about hub-level
 * 1:1 routes and has no concept of a per-article translation pairing.
 *
 * Falls back to the Insights hub in the other locale when no translation
 * exists yet, rather than a 404.
 */
export async function resolveArticleAlternatePath(article: Article): Promise<string> {
  const otherLocale: Locale = article.locale === "en" ? "pl" : "en";
  const translation = await getArticleTranslation(article);
  if (translation) return articlePath(translation.slug, otherLocale);
  return routes.insights[otherLocale];
}
