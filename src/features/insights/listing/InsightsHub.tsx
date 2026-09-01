import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { FireViewEvent } from "@/components/analytics/FireViewEvent";
import type { Locale } from "@/lib/routes";
import { routes } from "@/lib/routes";
import type { ArticleSummary, Category } from "../types/article";
import { ArticleCard } from "../components/ArticleCard";
import { PillarCard } from "../components/PillarCard";
import { tagPath } from "../seo/paths";
import { SearchForm } from "../search/SearchForm";
import styles from "./InsightsHub.module.css";

const COPY: Record<
	Locale,
	{
		eyebrow: string;
		title: string;
		lede: string;
		featuredLabel: string;
		latestLabel: string;
		pillarsLabel: string;
		pillarsLede: string;
		topicsLabel: string;
		ctaHeading: string;
		ctaBody: string;
		ctaLabel: string;
		empty: string;
	}
> = {
	en: {
		eyebrow: "Insights",
		title: "Knowledge that builds better products.",
		lede: "Notes from the studio floor — engineering, growth and mentoring, written the way we'd explain it to a client.",
		featuredLabel: "Featured",
		latestLabel: "Latest",
		pillarsLabel: "Explore by pillar",
		pillarsLede: "Everything here sits under one of the studio's three working disciplines.",
		topicsLabel: "Explore by topic",
		ctaHeading: "Want this thinking applied to your project?",
		ctaBody: "We write about the exact problems we solve for clients — that's not a coincidence.",
		ctaLabel: "Start a conversation",
		empty: "More articles are on the way — this index grows alongside the studio.",
	},
	pl: {
		eyebrow: "Wiedza",
		title: "Wiedza, która buduje lepsze produkty.",
		lede: "Notatki z pracy studia — inżynieria, growth i mentoring, napisane tak, jak wyjaśnilibyśmy to klientowi.",
		featuredLabel: "Wyróżnione",
		latestLabel: "Najnowsze",
		pillarsLabel: "Przeglądaj według filaru",
		pillarsLede: "Wszystko tutaj mieści się w jednej z trzech dyscyplin pracy studia.",
		topicsLabel: "Przeglądaj według tematu",
		ctaHeading: "Chcesz zastosować to podejście w swoim projekcie?",
		ctaBody: "Piszemy o dokładnie tych problemach, które rozwiązujemy dla klientów — to nie przypadek.",
		ctaLabel: "Rozpocznij rozmowę",
		empty: "Kolejne artykuły w drodze — ten spis rośnie razem ze studiem.",
	},
};

export function InsightsHub({
	locale,
	featured,
	latest,
	categories,
	popularTags,
}: {
	locale: Locale;
	featured: ArticleSummary | null;
	latest: ArticleSummary[];
	categories: Category[];
	popularTags: { id: string; slug: string; name: string }[];
}) {
	const t = COPY[locale];
	const hasContent = Boolean(featured) || latest.length > 0;

	return (
		<main className={styles.page}>
			<FireViewEvent event="insightsView" />
			<PageHero eyebrow={t.eyebrow} title={t.title} lede={t.lede} />

			<section className="tight">
				<div className="wrap">
					<SearchForm locale={locale} />
				</div>
			</section>

			{!hasContent ? (
				<section className="tight">
					<div className="wrap">
						<p className={styles.empty}>{t.empty}</p>
					</div>
				</section>
			) : (
				<>
					{featured ? (
						<section className="tight">
							<div className="wrap">
								<span className={styles.sectionLabel}>{t.featuredLabel}</span>
								<div className={styles.featuredGrid}>
									<ArticleCard article={featured} locale={locale} eager />
								</div>
							</div>
						</section>
					) : null}

					{latest.length > 0 ? (
						<section className="tight">
							<div className="wrap">
								<span className={styles.sectionLabel}>{t.latestLabel}</span>
								<div className={`${styles.latestGrid} reveal-stagger`}>
									{latest.map((article) => (
										<ArticleCard key={article.id} article={article} locale={locale} />
									))}
								</div>
							</div>
						</section>
					) : null}
				</>
			)}

			<section className="tight">
				<div className="wrap">
					<span className={styles.sectionLabel}>{t.pillarsLabel}</span>
					<p className={styles.pillarsLede}>{t.pillarsLede}</p>
					<div className={styles.pillarsGrid}>
						{categories.map((category) => (
							<PillarCard key={category.id} category={category} locale={locale} />
						))}
					</div>
				</div>
			</section>

			{popularTags.length > 0 ? (
				<section className="tight">
					<div className="wrap">
						<span className={styles.sectionLabel}>{t.topicsLabel}</span>
						<div className={styles.topicChips}>
							{popularTags.map((tag) => (
								<Link key={tag.id} href={tagPath(tag.slug, locale)} className={styles.topicChip}>
									#{tag.name}
								</Link>
							))}
						</div>
					</div>
				</section>
			) : null}

			<section className={styles.ctaSection}>
				<div className="wrap">
					<div className={styles.ctaInner}>
						<h2 className={styles.ctaHeading}>{t.ctaHeading}</h2>
						<p className={styles.ctaBody}>{t.ctaBody}</p>
						<Link href={routes.contact[locale]} className="btn btn-primary">
							{t.ctaLabel}
						</Link>
					</div>
				</div>
			</section>
		</main>
	);
}
