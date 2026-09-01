import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTagBySlug, listPublishedArticles } from "@/features/insights/data/queries";
import { TagListingPage } from "@/features/insights/listing/TagListingPage";

type Params = { slug: string };

const locale = "pl" as const;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
	const { slug } = await params;
	const tag = await getTagBySlug(locale, slug);
	if (!tag) return {};
	return { title: `#${tag.name}`, description: `Artykuły otagowane ${tag.name}.` };
}

export const revalidate = 300;

export default async function Page({ params }: { params: Promise<Params> }) {
	const { slug } = await params;
	const tag = await getTagBySlug(locale, slug);
	if (!tag) notFound();

	// listPublishedArticles filters by tag in-memory after the page query
	// (see the note in queries.ts) — fetch a generous page so a tag with a
	// handful of matches isn't hidden by pagination happening first.
	const { items } = await listPublishedArticles(locale, { tagSlug: slug, pageSize: 100 });

	return <TagListingPage tag={tag} articles={items} locale={locale} />;
}
