import type { Metadata } from "next";
import { ArticleEditorForm } from "@/features/insights/cms/ArticleEditorForm";
import { createArticleAction } from "@/lib/actions/insightsCms";
import { listCategories, listTags } from "@/features/insights/data/queries";
import { listArticlesForAdmin } from "@/features/insights/cms/queries";

export const metadata: Metadata = { title: "New article" };

export default async function NewArticlePage() {
	// Category/tag names are locale-dependent display strings, but an
	// editor picks the article's locale in the form itself — English is
	// shown here as a reasonable default list; the ids submitted are
	// locale-independent (docs/INSIGHTS_DATABASE.md §2.1/§2.2).
	const [categories, tags, allArticles] = await Promise.all([listCategories("en"), listTags("en"), listArticlesForAdmin()]);
	const translationCandidates = allArticles.map((a) => ({ id: a.id, title: a.title, slug: a.slug, locale: a.locale }));

	return (
		<div>
			<h1 style={{ fontSize: "1.6rem", fontWeight: 600, marginBottom: 24 }}>New article</h1>
			<ArticleEditorForm
				mode={{ kind: "create", action: createArticleAction }}
				categories={categories}
				tags={tags}
				translationCandidates={translationCandidates}
			/>
		</div>
	);
}
