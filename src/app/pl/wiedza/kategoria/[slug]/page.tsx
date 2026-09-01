import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategoryBySlug, listPublishedArticles } from "@/features/insights/data/queries";
import { CategoryListingPage } from "@/features/insights/listing/CategoryListingPage";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

type Params = { slug: string };

const locale = "pl" as const;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
	const { slug } = await params;
	const category = await getCategoryBySlug(locale, slug);
	if (!category) return {};
	return {
		title: category.name,
		description: category.description ?? `Artykuły z kategorii ${category.name}.`,
	};
}

export const revalidate = 300;

export default async function Page({ params }: { params: Promise<Params> }) {
	const { slug } = await params;
	const category = await getCategoryBySlug(locale, slug);
	if (!category) notFound();

	const { items } = await listPublishedArticles(locale, { categorySlug: slug, pageSize: 24 });

	return (
		<>
			<PageStructuredData routeKey="insights" locale={locale} title={category.name} description={category.description ?? category.name} />
			<CategoryListingPage category={category} articles={items} locale={locale} />
		</>
	);
}
