import { listPublishedArticlesForFeed } from "@/features/insights/data/queries";
import { buildRssFeed } from "@/features/insights/seo/rss";

export const revalidate = 900;

export async function GET() {
	const articles = await listPublishedArticlesForFeed("pl");
	const xml = buildRssFeed("pl", articles);

	return new Response(xml, {
		headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
	});
}
