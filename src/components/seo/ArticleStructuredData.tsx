import { JsonLd } from "./JsonLd";
import { articleSchema, articleBreadcrumbs } from "@/lib/seo/structuredData";
import type { Locale } from "@/lib/routes";
import type { Article } from "@/features/insights/types/article";

/**
 * `BlogPosting` + `BreadcrumbList` structured data for one Insights
 * article — the dynamic-route sibling of `ProjectStructuredData`
 * (articles aren't `RouteKey` entries, so they build their schemas from
 * the article record + `articlePath` instead of a `routes[key]` lookup).
 */
export function ArticleStructuredData({ article, locale }: { article: Article; locale: Locale }) {
	return <JsonLd data={[articleSchema({ article, locale }), articleBreadcrumbs({ article, locale })]} />;
}
