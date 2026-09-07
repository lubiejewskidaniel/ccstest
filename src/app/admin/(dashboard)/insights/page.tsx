import type { Metadata } from "next";
import Link from "next/link";
import { listArticlesForAdmin } from "@/features/insights/cms/queries";
import { getAdminSession } from "@/lib/supabase/adminAuth";
import { StatusBadge } from "@/features/insights/cms/StatusBadge";
import { ArticleRowActions } from "@/features/insights/cms/ArticleRowActions";

export const metadata: Metadata = { title: "Insights" };

export default async function AdminInsightsListPage() {
	const [articles, session] = await Promise.all([listArticlesForAdmin(), getAdminSession()]);
	const isAdmin = session?.isAdmin ?? false;

	return (
		<div>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
				<h1 style={{ fontSize: "1.6rem", fontWeight: 600 }}>Insights</h1>
				<div style={{ display: "flex", gap: 10 }}>
					<Link href="/admin/insights/queue" className="btn btn-ghost">
						Queue
					</Link>
					<Link href="/admin/insights/opportunities" className="btn btn-ghost">
						Opportunities
					</Link>
					<Link href="/admin/insights/market-opportunities" className="btn btn-ghost">
						Market opportunities
					</Link>
					<Link href="/admin/insights/briefs" className="btn btn-ghost">
						AI briefs
					</Link>
					<Link href="/admin/insights/performance" className="btn btn-ghost">
						Performance
					</Link>
					<Link href="/admin/insights/new" className="btn btn-primary">
						New article
					</Link>
				</div>
			</div>

			{articles.length === 0 ? (
				<div className="admin-empty">
					No articles yet.{" "}
					<Link href="/admin/insights/new" style={{ color: "var(--spark)" }}>
						Create the first one
					</Link>
					.
				</div>
			) : (
				<div style={{ overflowX: "auto" }}>
					<table className="admin-table">
						<thead>
							<tr>
								<th>Title</th>
								<th>Locale</th>
								<th>Category</th>
								<th>Status</th>
								<th>Updated</th>
								<th style={{ textAlign: "right" }}>Actions</th>
							</tr>
						</thead>
						<tbody>
							{articles.map((article) => (
								<tr key={article.id}>
									<td>
										<Link href={`/admin/insights/${article.id}/edit`}>{article.title}</Link>
									</td>
									<td>{article.locale.toUpperCase()}</td>
									<td>{article.category.name}</td>
									<td>
										<StatusBadge status={article.status} />
									</td>
									<td>{new Date(article.updatedAt).toLocaleDateString()}</td>
									<td style={{ textAlign: "right" }}>
										<ArticleRowActions
											id={article.id}
											locale={article.locale}
											slug={article.slug}
											status={article.status}
											isAdmin={isAdmin}
										/>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
