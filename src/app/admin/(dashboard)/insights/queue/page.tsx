import type { Metadata } from "next";
import Link from "next/link";
import { listArticlesForAdmin } from "@/features/insights/cms/queries";

export const metadata: Metadata = { title: "Publication queue" };

export default async function PublicationQueuePage() {
	// Reuses the existing admin read (Checkpoint 3) — the "queue" is just
	// every scheduled article, ordered by when it's due.
	const scheduled = await listArticlesForAdmin({ status: "scheduled" });
	const ordered = [...scheduled].sort((a, b) => {
		const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Infinity;
		const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Infinity;
		return aTime - bTime;
	});

	return (
		<div>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
				<h1 style={{ fontSize: "1.6rem", fontWeight: 600 }}>Publication queue</h1>
				<Link href="/admin/insights" className="btn btn-ghost">
					Back to articles
				</Link>
			</div>
			<p style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 28 }}>
				Articles waiting for their scheduled time. A cron-triggered job (
				<code>/api/v1/scheduler/publish</code>) publishes whatever is due once a day at{" "}
				{process.env.CONTENT_PUBLISH_HOUR_UTC ?? "18"}:00 UTC — see the README/env setup for configuring the
				trigger itself, this page only shows what&apos;s queued.
			</p>

			{ordered.length === 0 ? (
				<div className="admin-empty">Nothing scheduled right now.</div>
			) : (
				<div style={{ overflowX: "auto" }}>
					<table className="admin-table">
						<thead>
							<tr>
								<th>Title</th>
								<th>Locale</th>
								<th>Scheduled for</th>
							</tr>
						</thead>
						<tbody>
							{ordered.map((article) => (
								<tr key={article.id}>
									<td>
										<Link href={`/admin/insights/${article.id}/edit`} style={{ color: "var(--ink-1)", fontWeight: 500 }}>
											{article.title}
										</Link>
									</td>
									<td>{article.locale.toUpperCase()}</td>
									<td>{article.scheduledAt ? new Date(article.scheduledAt).toLocaleString() : "-"}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
