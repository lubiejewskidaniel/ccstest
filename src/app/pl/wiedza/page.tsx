import { InsightsHub } from "@/features/insights/listing/InsightsHub";
import { listFeaturedArticles, listPublishedArticles, listCategories } from "@/features/insights/data/queries";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";
import { feedPath } from "@/features/insights/seo/paths";
import type { Tag } from "@/features/insights/types/article";

const title = "Wiedza";
const description = "Notatki o inżynierii, growth i mentoringu od zespołu Code Consulting Studio.";

const baseMetadata = buildPageMetadata({ routeKey: "insights", locale: "pl", title, description });
export const metadata = {
	...baseMetadata,
	alternates: {
		...baseMetadata.alternates,
		types: { "application/rss+xml": feedPath("pl") },
	},
};

export const revalidate = 300;

function derivePopularTags(articles: { tags: Tag[] }[], limit = 8): Tag[] {
	const seen = new Map<string, Tag>();
	for (const article of articles) {
		for (const tag of article.tags) {
			if (!seen.has(tag.id)) seen.set(tag.id, tag);
			if (seen.size >= limit) return Array.from(seen.values());
		}
	}
	return Array.from(seen.values());
}

export default async function Page() {
	const locale = "pl" as const;
	const [featuredList, latestPage, categories] = await Promise.all([
		listFeaturedArticles(locale, 1),
		listPublishedArticles(locale, { pageSize: 9 }),
		listCategories(locale),
	]);

	const featured = featuredList[0] ?? null;
	const latest = featured ? latestPage.items.filter((article) => article.id !== featured.id) : latestPage.items;
	const popularTags = derivePopularTags(latestPage.items);

	return (
		<>
			<PageStructuredData routeKey="insights" locale={locale} title={title} description={description} />
			<InsightsHub locale={locale} featured={featured} latest={latest} categories={categories} popularTags={popularTags} />
		</>
	);
}
