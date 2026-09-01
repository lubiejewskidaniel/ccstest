import type { Article } from "../types/article";
import type { Locale } from "@/lib/routes";
import { routes } from "@/lib/routes";
import { extractHeadings } from "../types/blocks";
import { ArticleHero } from "../components/ArticleHero";
import { ArticleToc } from "../components/ArticleToc";
import { TagList } from "../components/TagList";
import { ArticleViewTracker } from "../components/ArticleViewTracker";
import { ReadProgressTracker } from "../components/ReadProgressTracker";
import { ArticleCtaLink } from "../components/ArticleCtaLink";
import { BlockRenderer } from "../blocks/BlockRenderer";
import styles from "./ArticlePage.module.css";

const CTA_COPY: Record<Locale, { heading: string; body: string; label: string }> = {
	en: {
		heading: "Have a similar problem to solve?",
		body: "This is the kind of work we do for clients — from a first working session to a shipped product.",
		label: "Talk to the studio",
	},
	pl: {
		heading: "Masz podobny problem do rozwiązania?",
		body: "Tym właśnie zajmujemy się dla klientów — od pierwszej roboczej sesji po wdrożony produkt.",
		label: "Porozmawiaj ze studiem",
	},
};

export function ArticlePage({
	article,
	locale,
	alternateHref,
}: {
	article: Article;
	locale: Locale;
	alternateHref: string | null;
}) {
	const headings = extractHeadings(article.body);
	const cta = CTA_COPY[locale];

	return (
		<main className={styles.page}>
			<ArticleViewTracker slug={article.slug} category={article.category.key} />
			<ReadProgressTracker slug={article.slug} />
			<ArticleHero article={article} locale={locale} alternateHref={alternateHref} />

			<div className={styles.body}>
				<div className={styles.grid}>
					{headings.length >= 2 ? (
						<aside className={styles.sidebar}>
							<div className={styles.sidebarSticky}>
								<ArticleToc headings={headings} locale={locale} />
							</div>
						</aside>
					) : null}

					<article className={styles.content}>
						<BlockRenderer blocks={article.body} />

						<footer className={styles.footer}>
							<TagList tags={article.tags} locale={locale} />
						</footer>
					</article>
				</div>

				<section className={styles.cta}>
					<div className={styles.ctaInner}>
						<h2 className={styles.ctaHeading}>{cta.heading}</h2>
						<p className={styles.ctaBody}>{cta.body}</p>
						<ArticleCtaLink
							href={routes.contact[locale]}
							slug={article.slug}
							ctaLocation="article_bottom"
							className="btn btn-primary"
						>
							{cta.label}
						</ArticleCtaLink>
					</div>
				</section>
			</div>
		</main>
	);
}
