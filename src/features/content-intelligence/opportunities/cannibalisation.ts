import { createSupabaseServerClient } from "@/lib/supabase/server";
import { matchArticleUrl } from "../monitoring/matchArticleUrl";
import type { Locale } from "@/lib/routes";

export type CannibalisationPage = { locale: Locale; slug: string; impressions: number; clicks: number; avgPosition: number | null };
export type CannibalisationRow = { query: string; pages: CannibalisationPage[]; totalImpressions: number };

type ArticleIdentity = { id: string; translationOf: string | null };

// translation_of is one-directional (only one side of a pair points at
// the other), so a pair is only recognised by checking both ways — same
// rule as cms/translationLink.ts's hasLinkedTranslation.
function isTranslationPair(a: ArticleIdentity, b: ArticleIdentity): boolean {
	return a.translationOf === b.id || b.translationOf === a.id;
}

// An article has at most one translation_of partner, so a single
// pairwise pass is enough to collapse pairs — no clustering needed.
function countDistinctArticles(pages: string[], articlesByKey: Map<string, ArticleIdentity>): number {
	const counted = new Set<string>();
	let count = 0;

	for (const key of pages) {
		const article = articlesByKey.get(key);
		if (!article) {
			count++; // unresolved page: never merged with anything
			continue;
		}
		if (counted.has(article.id)) continue;
		counted.add(article.id);
		count++;

		for (const otherKey of pages) {
			const other = articlesByKey.get(otherKey);
			if (other && !counted.has(other.id) && isTranslationPair(article, other)) counted.add(other.id);
		}
	}

	return count;
}

/**
 * Flags queries where two or more distinct, real Insights articles both
 * received search impressions in the same window — a direct signal that
 * the site is competing with itself for a term instead of one article
 * clearly owning it (master instruction Checkpoint 9 "cannibalisation").
 * Uses the same `matchArticleUrl` join as `monitoring/performanceAnalysis.ts`
 * so a page URL that doesn't resolve to a real article can't be
 * miscounted as a second competing page.
 *
 * A confirmed EN/PL translation pair sharing a query is excluded — that's
 * intentional bilingual coverage, not the site competing with itself.
 */
export async function detectCannibalisation(daysBack = 30, limit = 25): Promise<CannibalisationRow[]> {
	const supabase = await createSupabaseServerClient();
	if (!supabase) return [];

	const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

	const { data } = await supabase
		.from("search_performance_metrics")
		.select("query, page_url, impressions, clicks, avg_position")
		.gte("metric_date", cutoff)
		.neq("page_url", "");

	const byQuery = new Map<string, Map<string, CannibalisationPage>>();

	for (const row of data ?? []) {
		const match = matchArticleUrl(row.page_url);
		if (!match) continue;

		const pages = byQuery.get(row.query) ?? new Map<string, CannibalisationPage>();
		const pageKey = `${match.locale}:${match.slug}`;
		const existing = pages.get(pageKey) ?? { locale: match.locale, slug: match.slug, impressions: 0, clicks: 0, avgPosition: null };

		existing.impressions += row.impressions ?? 0;
		existing.clicks += row.clicks ?? 0;
		if (row.avg_position !== null) {
			existing.avgPosition = existing.avgPosition === null ? Number(row.avg_position) : (existing.avgPosition + Number(row.avg_position)) / 2;
		}

		pages.set(pageKey, existing);
		byQuery.set(row.query, pages);
	}

	// Only the articles behind pages that actually matched a metric row
	// are needed -- one bounded `.in()` lookup per locale present (at
	// most two, run together), rather than the whole table.
	const slugsByLocale = new Map<Locale, Set<string>>();
	for (const pages of byQuery.values()) {
		for (const page of pages.values()) {
			const slugs = slugsByLocale.get(page.locale) ?? new Set<string>();
			slugs.add(page.slug);
			slugsByLocale.set(page.locale, slugs);
		}
	}

	const articleLookups = await Promise.all(
		Array.from(slugsByLocale.entries()).map(([locale, slugs]) =>
			supabase.from("insights_articles").select("id, locale, slug, translation_of").eq("locale", locale).in("slug", Array.from(slugs)),
		),
	);
	const articlesByKey = new Map<string, ArticleIdentity>();
	for (const { data: articleRows } of articleLookups) {
		for (const article of articleRows ?? []) {
			articlesByKey.set(`${article.locale}:${article.slug}`, { id: article.id, translationOf: article.translation_of });
		}
	}

	const rows: CannibalisationRow[] = [];
	for (const [query, pages] of byQuery) {
		if (countDistinctArticles(Array.from(pages.keys()), articlesByKey) < 2) continue;
		const pageList = Array.from(pages.values());
		rows.push({
			query,
			pages: pageList.sort((a, b) => b.impressions - a.impressions),
			totalImpressions: pageList.reduce((sum, page) => sum + page.impressions, 0),
		});
	}

	return rows.sort((a, b) => b.totalImpressions - a.totalImpressions).slice(0, limit);
}
