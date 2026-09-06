import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getAdminSession } from "@/lib/supabase/adminAuth";
import { getArticleForAdmin } from "@/features/insights/cms/queries";
import { ArticlePage } from "@/features/insights/article/ArticlePage";
import { PreviewBanner } from "@/features/insights/article/PreviewBanner";

type Params = { id: string };

export const metadata: Metadata = {
	title: "Preview",
	robots: { index: false, follow: false },
};

/**
 * Deliberately NOT under `admin/(dashboard)/` — that layout's sidebar
 * shell (`.admin-main`, max-width 1100px) would misrepresent the
 * article's real published width/layout. This route sits directly under
 * `/admin` instead, so it needs its own session check (it doesn't
 * inherit the dashboard layout's), same redirect the dashboard layout
 * itself uses.
 *
 * Renders the exact same `ArticlePage` component the public route uses
 * (`src/app/insights/[slug]/page.tsx`) — no second renderer, no
 * duplicated block-rendering logic. `getArticleForAdmin` returns an
 * article regardless of status (RLS's "editor select all" policy), so
 * draft/in_review/scheduled/archived all preview identically to how
 * they'll look once published — the only difference from the live page
 * is the banner above it and `trackAnalytics={false}` so a preview visit
 * never counts as a real page view.
 */
export default async function AdminArticlePreviewPage({ params }: { params: Promise<Params> }) {
	const session = await getAdminSession();
	if (!session?.isEditor) redirect("/admin/login");

	const { id } = await params;
	const article = await getArticleForAdmin(id);
	if (!article) notFound();

	return (
		<>
			<PreviewBanner articleId={article.id} status={article.status} />
			<ArticlePage article={article} locale={article.locale} alternateHref={null} trackAnalytics={false} />
		</>
	);
}
