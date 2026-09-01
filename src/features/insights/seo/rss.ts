import { siteUrl, siteName } from "@/lib/seo/metadata";
import type { Locale } from "@/lib/routes";
import { routes } from "@/lib/routes";
import { articlePath, feedPath } from "./paths";

type FeedArticle = { slug: string; title: string; excerpt: string; authorName: string; publishedAt: string };

const CHANNEL_TITLE: Record<Locale, string> = {
	en: `${siteName} — Insights`,
	pl: `${siteName} — Wiedza`,
};

const CHANNEL_DESCRIPTION: Record<Locale, string> = {
	en: "Notes on engineering, growth and mentoring from the Code Consulting Studio team.",
	pl: "Notatki o inżynierii, growth i mentoringu od zespołu Code Consulting Studio.",
};

/** Escapes the five XML-significant characters — RSS item titles/
 * descriptions come from editor-supplied content, so this can't assume
 * it's already safe the way a hardcoded string literal would be. */
function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function toRfc822(iso: string): string {
	return new Date(iso).toUTCString();
}

/**
 * Builds the RSS 2.0 XML body for one locale's Insights feed. Used by
 * both `src/app/insights/feed.xml/route.ts` and
 * `src/app/pl/wiedza/feed.xml/route.ts` — same content shape, only the
 * locale and its already-localized article list differ.
 */
export function buildRssFeed(locale: Locale, articles: FeedArticle[]): string {
	const channelLink = new URL(routes.insights[locale], siteUrl).toString();
	const selfLink = new URL(feedPath(locale), siteUrl).toString();

	const items = articles
		.map((article) => {
			const link = new URL(articlePath(article.slug, locale), siteUrl).toString();
			return `
    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${toRfc822(article.publishedAt)}</pubDate>
      <author>${escapeXml(article.authorName)}</author>
      <description>${escapeXml(article.excerpt)}</description>
    </item>`;
		})
		.join("");

	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(CHANNEL_TITLE[locale])}</title>
    <link>${channelLink}</link>
    <description>${escapeXml(CHANNEL_DESCRIPTION[locale])}</description>
    <language>${locale === "pl" ? "pl-PL" : "en-GB"}</language>
    <atom:link href="${selfLink}" rel="self" type="application/rss+xml" />${items}
  </channel>
</rss>
`;
}
