import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getArticleForAdmin } from "@/features/insights/cms/queries";
import { listCategories, listTags } from "@/features/insights/data/queries";
import { ArticleEditorForm } from "@/features/insights/cms/ArticleEditorForm";
import { ArticleStatusActions } from "@/features/insights/cms/ArticleStatusActions";
import { updateArticleAction } from "@/lib/actions/insightsCms";

type Params = { id: string };

export const metadata: Metadata = { title: "Edit article" };

export default async function EditArticlePage({ params }: { params: Promise<Params> }) {
	const { id } = await params;
	const article = await getArticleForAdmin(id);
	if (!article) notFound();

	const [categories, tags] = await Promise.all([listCategories(article.locale), listTags(article.locale)]);
	const boundUpdateAction = updateArticleAction.bind(null, id);

	return (
		<div>
			<h1 style={{ fontSize: "1.6rem", fontWeight: 600, marginBottom: 8 }}>{article.title}</h1>
			<p style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 24 }}>
				/{article.locale}/{article.slug}
			</p>

			<ArticleStatusActions article={article} locale={article.locale} />

			<ArticleEditorForm
				mode={{ kind: "edit", article, action: boundUpdateAction }}
				categories={categories}
				tags={tags}
			/>
		</div>
	);
}
