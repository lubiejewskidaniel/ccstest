import { PageHero } from "@/components/PageHero";
import type { Locale } from "@/lib/routes";
import type { ArticleSummary } from "../types/article";
import { ArticleCard } from "../components/ArticleCard";
import { SearchForm } from "./SearchForm";
import { SearchViewTracker } from "./SearchViewTracker";
import styles from "./SearchResultsPage.module.css";

const COPY: Record<Locale, { eyebrow: string; heading: (q: string) => string; empty: (q: string) => string; prompt: string }> = {
	en: {
		eyebrow: "Insights",
		heading: (q) => `Results for “${q}”`,
		empty: (q) => `No articles matched “${q}”.`,
		prompt: "Type at least two characters to search.",
	},
	pl: {
		eyebrow: "Wiedza",
		heading: (q) => `Wyniki dla „${q}”`,
		empty: (q) => `Brak artykułów pasujących do „${q}”.`,
		prompt: "Wpisz co najmniej dwa znaki, aby wyszukać.",
	},
};

export function SearchResultsPage({ locale, query, results }: { locale: Locale; query: string; results: ArticleSummary[] }) {
	const t = COPY[locale];
	const hasQuery = query.trim().length >= 2;

	return (
		<main className={styles.page}>
			{hasQuery ? <SearchViewTracker query={query} resultCount={results.length} /> : null}
			<PageHero eyebrow={t.eyebrow} title={hasQuery ? t.heading(query) : t.prompt} />

			<section className="tight">
				<div className="wrap">
					<div className={styles.formRow}>
						<SearchForm locale={locale} defaultValue={query} />
					</div>

					{hasQuery && results.length === 0 ? (
						<p className={styles.empty}>{t.empty(query)}</p>
					) : (
						<div className={`${styles.grid} reveal-stagger`}>
							{results.map((article) => (
								<ArticleCard key={article.id} article={article} locale={locale} />
							))}
						</div>
					)}
				</div>
			</section>
		</main>
	);
}
