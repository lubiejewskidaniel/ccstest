import Link from "next/link";
import type { ArticleSummary } from "../types/article";
import type { Locale } from "@/lib/routes";
import { articlePath, categoryPath } from "../seo/paths";
import { formatArticleDate, formatReadingTime } from "../lib/format";
import styles from "./ArticleCard.module.css";

export function ArticleCard({
	article,
	locale,
	eager = false,
}: {
	article: ArticleSummary;
	locale: Locale;
	/** Set for above-the-fold cards (e.g. the featured slot) to skip lazy loading. */
	eager?: boolean;
}) {
	const meta = [formatArticleDate(locale, article.publishedAt), formatReadingTime(locale, article.readingMinutes)]
		.filter(Boolean)
		.join(" · ");

	return (
		<article className={styles.card}>
			<Link href={articlePath(article.slug, locale)} className={styles.coverLink} tabIndex={-1} aria-hidden="true">
				{article.coverImageUrl ? (
					// Plain <img>, not next/image: cover images come from
					// editor-supplied URLs (CMS/Content Engine), and
					// next.config.mjs has no remotePatterns configured for an
					// unknown, per-article host — see docs/INSIGHTS_ARCHITECTURE.md.
					// eslint-disable-next-line @next/next/no-img-element
					<img
						src={article.coverImageUrl}
						alt={article.coverImageAlt ?? ""}
						loading={eager ? "eager" : "lazy"}
						className={styles.coverImage}
					/>
				) : (
					<div className={styles.coverFallback} data-category={article.category.key} />
				)}
			</Link>

			<div className={styles.body}>
				<Link href={categoryPath(article.category.slug, locale)} className={styles.categoryTag}>
					{article.category.name}
				</Link>

				<h3 className={styles.title}>
					<Link href={articlePath(article.slug, locale)}>{article.title}</Link>
				</h3>

				<p className={styles.excerpt}>{article.excerpt}</p>

				{meta ? <span className={styles.meta}>{meta}</span> : null}
			</div>
		</article>
	);
}
