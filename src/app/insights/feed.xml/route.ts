import { listPublishedArticlesForFeed } from "@/features/insights/data/queries";
import { buildRssFeed } from "@/features/insights/seo/rss";

// Feed content changes only as often as articles publish — a longer
// revalidation window than the HTML pages' 300s is fine for a feed
// consumers poll periodically anyway.
export const revalidate = 900;

export async function GET() {
	const articles = await listPublishedArticlesForFeed("en");
	const xml = buildRssFeed("en", articles);

	return new Response(xml, {
		headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
	});
}
