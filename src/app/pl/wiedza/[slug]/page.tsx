import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedArticleBySlug } from "@/features/insights/data/queries";
import { resolveArticleAlternatePath } from "@/features/insights/seo/articleLocale";
import { ArticlePage } from "@/features/insights/article/ArticlePage";
import { buildArticleMetadata } from "@/lib/seo/metadata";
import { ArticleStructuredData } from "@/components/seo/ArticleStructuredData";
import { routes } from "@/lib/routes";

type Params = { slug: string };

const locale = "pl" as const;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
	const { slug } = await params;
	const article = await getPublishedArticleBySlug(locale, slug);
	if (!article) return {};

	const alternatePath = await resolveArticleAlternatePath(article);
	const translatedPath = alternatePath === routes.insights.en ? undefined : alternatePath;
	return buildArticleMetadata({ article, locale, translatedPath });
}

export const revalidate = 300;

export default async function Page({ params }: { params: Promise<Params> }) {
	const { slug } = await params;
	const article = await getPublishedArticleBySlug(locale, slug);
	if (!article) notFound();

	const alternatePath = await resolveArticleAlternatePath(article);
	const alternateHref = alternatePath === routes.insights.en ? null : alternatePath;

	return (
		<>
			<ArticleStructuredData article={article} locale={locale} />
			<ArticlePage article={article} locale={locale} alternateHref={alternateHref} />
		</>
	);
}
