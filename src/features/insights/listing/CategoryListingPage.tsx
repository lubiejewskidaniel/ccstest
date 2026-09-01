import { PageHero } from "@/components/PageHero";
import type { Locale } from "@/lib/routes";
import type { ArticleSummary, Category } from "../types/article";
import { ArticleCard } from "../components/ArticleCard";
import { CategoryViewTracker } from "../components/CategoryViewTracker";
import styles from "./TopicListing.module.css";

const EMPTY: Record<Locale, string> = {
	en: "No articles in this category yet.",
	pl: "Brak jeszcze artykułów w tej kategorii.",
};

const EYEBROW: Record<Locale, string> = { en: "Insights", pl: "Wiedza" };

export function CategoryListingPage({
	category,
	articles,
	locale,
}: {
	category: Category;
	articles: ArticleSummary[];
	locale: Locale;
}) {
	return (
		<main className={styles.page}>
			<CategoryViewTracker slug={category.slug} />
			<PageHero eyebrow={EYEBROW[locale]} title={category.name} lede={category.description ?? undefined} />
			<section className="tight">
				<div className="wrap">
					{articles.length === 0 ? (
						<p className={styles.empty}>{EMPTY[locale]}</p>
					) : (
						<div className={`${styles.grid} reveal-stagger`}>
							{articles.map((article) => (
								<ArticleCard key={article.id} article={article} locale={locale} />
							))}
						</div>
					)}
				</div>
			</section>
		</main>
	);
}
