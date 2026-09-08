import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getArticleForAdmin, listArticlesForAdmin } from "@/features/insights/cms/queries";
import { listCategories, listTags } from "@/features/insights/data/queries";
import { getAdminSession } from "@/lib/supabase/adminAuth";
import { ArticleEditorForm } from "@/features/insights/cms/ArticleEditorForm";
import { ArticleStatusActions } from "@/features/insights/cms/ArticleStatusActions";
import { ArticleVisualReviewPanel } from "@/features/content-intelligence/visuals/ArticleVisualReviewPanel";
import { updateArticleAction } from "@/lib/actions/insightsCms";

type Params = { id: string };

export const metadata: Metadata = { title: "Edit article" };

export default async function EditArticlePage({ params }: { params: Promise<Params> }) {
	const { id } = await params;
	const [article, session] = await Promise.all([getArticleForAdmin(id), getAdminSession()]);
	if (!article) notFound();

	const [categories, tags, allArticles] = await Promise.all([
		listCategories(article.locale),
		listTags(article.locale),
		listArticlesForAdmin(),
	]);
	const translationCandidates = allArticles.map((a) => ({ id: a.id, title: a.title, slug: a.slug, locale: a.locale }));
	const boundUpdateAction = updateArticleAction.bind(null, id);

	return (
		<div>
			<h1 style={{ fontSize: "1.6rem", fontWeight: 600, marginBottom: 8 }}>{article.title}</h1>
			<p style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 24 }}>
				/{article.locale}/{article.slug}
			</p>

			<ArticleStatusActions article={article} locale={article.locale} isAdmin={session?.isAdmin ?? false} />

			<ArticleVisualReviewPanel
				articleId={article.id}
				locale={article.locale}
				slug={article.slug}
				coverImageUrl={article.coverImageUrl}
				coverImageStatus={article.coverImageStatus}
			/>

			<p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 12 }}>
				Content
			</p>
			<ArticleEditorForm
				mode={{ kind: "edit", article, action: boundUpdateAction }}
				categories={categories}
				tags={tags}
				translationCandidates={translationCandidates}
			/>
		</div>
	);
}
