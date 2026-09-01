import { PageHero } from "@/components/PageHero";
import type { Locale } from "@/lib/routes";
import type { ArticleSummary, Tag } from "../types/article";
import { ArticleCard } from "../components/ArticleCard";
import { TagViewTracker } from "../components/TagViewTracker";
import styles from "./TopicListing.module.css";

const EMPTY: Record<Locale, string> = {
	en: "No articles with this tag yet.",
	pl: "Brak jeszcze artykułów z tym tagiem.",
};

const EYEBROW: Record<Locale, string> = { en: "Tag", pl: "Tag" };

export function TagListingPage({ tag, articles, locale }: { tag: Tag; articles: ArticleSummary[]; locale: Locale }) {
	return (
		<main className={styles.page}>
			<TagViewTracker slug={tag.slug} />
			<PageHero eyebrow={EYEBROW[locale]} title={`#${tag.name}`} />
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
