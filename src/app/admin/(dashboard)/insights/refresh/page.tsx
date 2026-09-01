import type { Metadata } from "next";
import Link from "next/link";
import { listRefreshCandidates } from "@/features/content-intelligence/refresh/staleness";

export const metadata: Metadata = { title: "Content refresh" };

export default async function ContentRefreshPage() {
	const candidates = await listRefreshCandidates();

	return (
		<div>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
				<h1 style={{ fontSize: "1.6rem", fontWeight: 600 }}>Content refresh</h1>
				<Link href="/admin/insights" className="btn btn-ghost">
					Back to articles
				</Link>
			</div>
			<p style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 28 }}>
				Published articles worth revisiting — flagged by age past the stale threshold (
				<code>CONTENT_REFRESH_STALE_DAYS</code>, default 180 days) and/or a worsening 30-day search position
				trend. Content refresh matters as much as new content (Decision 13) — this doesn&apos;t touch anything,
				it only surfaces candidates for a human to act on.
			</p>

			{candidates.length === 0 ? (
				<div className="admin-empty">Nothing flagged right now.</div>
			) : (
				<div style={{ overflowX: "auto" }}>
					<table className="admin-table">
						<thead>
							<tr>
								<th>Title</th>
								<th>Locale</th>
								<th>Age (days)</th>
								<th>Reasons</th>
							</tr>
						</thead>
						<tbody>
							{candidates.map((candidate) => (
								<tr key={candidate.articleId}>
									<td>
										<Link href={`/admin/insights/${candidate.articleId}/edit`} style={{ color: "var(--ink-1)", fontWeight: 500 }}>
											{candidate.title}
										</Link>
									</td>
									<td>{candidate.locale.toUpperCase()}</td>
									<td>{candidate.ageDays}</td>
									<td>
										<ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--ink-2)" }}>
											{candidate.reasons.map((reason) => (
												<li key={reason}>{reason}</li>
											))}
										</ul>
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
