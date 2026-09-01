import type { Metadata } from "next";
import { searchPublishedArticles } from "@/features/insights/data/queries";
import { SearchResultsPage } from "@/features/insights/search/SearchResultsPage";

const locale = "pl" as const;

export const metadata: Metadata = {
	title: "Szukaj",
	robots: { index: false, follow: true },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
	const { q } = await searchParams;
	const query = q ?? "";
	const results = query.trim().length >= 2 ? await searchPublishedArticles(locale, query) : [];

	return <SearchResultsPage locale={locale} query={query} results={results} />;
}
