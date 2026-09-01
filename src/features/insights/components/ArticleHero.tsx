import Link from "next/link";
import type { Article } from "../types/article";
import type { Locale } from "@/lib/routes";
import { categoryPath } from "../seo/paths";
import { formatArticleDate, formatReadingTime } from "../lib/format";
import styles from "./ArticleHero.module.css";

const READ_IN_OTHER_LOCALE: Record<Locale, string> = {
	en: "Czytaj po polsku",
	pl: "Read in English",
};

export function ArticleHero({
	article,
	locale,
	alternateHref,
}: {
	article: Article;
	locale: Locale;
	/** Resolved server-side by the article page — see
	 * src/features/insights/seo/articleLocale.ts. Points at the real
	 * translation when one exists, otherwise the Insights hub. */
	alternateHref: string | null;
}) {
	const meta = [formatArticleDate(locale, article.publishedAt), formatReadingTime(locale, article.readingMinutes)]
		.filter(Boolean)
		.join(" · ");

	return (
		<header className={styles.hero}>
			<div className={styles.wrap}>
				<Link href={categoryPath(article.category.slug, locale)} className={styles.category}>
					{article.category.name}
				</Link>

				<h1 className={styles.title}>{article.title}</h1>
				<p className={styles.excerpt}>{article.excerpt}</p>

				<div className={styles.byline}>
					<span className={styles.author}>{article.authorName}</span>
					{meta ? <span className={styles.metaDot}>·</span> : null}
					<span className={styles.meta}>{meta}</span>

					{alternateHref ? (
						<Link href={alternateHref} className={styles.altLocale}>
							{READ_IN_OTHER_LOCALE[locale]}
						</Link>
					) : null}
				</div>

				{article.coverImageUrl ? (
					<div className={styles.coverWrap}>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src={article.coverImageUrl} alt={article.coverImageAlt ?? ""} className={styles.cover} />
					</div>
				) : null}
			</div>
		</header>
	);
}
