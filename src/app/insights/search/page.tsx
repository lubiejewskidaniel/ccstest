import type { Metadata } from "next";
import { searchPublishedArticles } from "@/features/insights/data/queries";
import { SearchResultsPage } from "@/features/insights/search/SearchResultsPage";

const locale = "en" as const;

// Query-driven results page — not something search engines should index
// as its own destination (the underlying articles are already indexed at
// their real URLs).
export const metadata: Metadata = {
	title: "Search",
	robots: { index: false, follow: true },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
	const { q } = await searchParams;
	const query = q ?? "";
	const results = query.trim().length >= 2 ? await searchPublishedArticles(locale, query) : [];

	return <SearchResultsPage locale={locale} query={query} results={results} />;
}
