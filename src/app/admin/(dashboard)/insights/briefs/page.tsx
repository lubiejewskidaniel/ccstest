import type { Metadata } from "next";
import Link from "next/link";
import { listBriefs } from "@/features/content-intelligence/briefs/service";

export const metadata: Metadata = { title: "AI briefs" };

export default async function BriefsListPage() {
	const briefs = await listBriefs();

	return (
		<div>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
				<h1 style={{ fontSize: "1.6rem", fontWeight: 600 }}>AI editorial briefs</h1>
				<div style={{ display: "flex", gap: 10 }}>
					<Link href="/admin/insights" className="btn btn-ghost">
						Back to articles
					</Link>
					<Link href="/admin/insights/briefs/new" className="btn btn-primary">
						New brief
					</Link>
				</div>
			</div>
			<p style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 28 }}>
				Brief → research → generation → localisation (EN/PL) → quality gate → draft article(s) awaiting your
				review. Nothing here ever publishes anything — every promoted draft lands in{" "}
				<Link href="/admin/insights" style={{ color: "var(--spark)" }}>
					Insights
				</Link>{" "}
				as <code>in_review</code>, exactly like a human-authored draft.
			</p>

			{briefs.length === 0 ? (
				<div className="admin-empty">
					No briefs yet.{" "}
					<Link href="/admin/insights/briefs/new" style={{ color: "var(--spark)" }}>
						Create the first one
					</Link>
					, or start from a{" "}
					<Link href="/admin/insights/opportunities" style={{ color: "var(--spark)" }}>
						content opportunity
					</Link>
					.
				</div>
			) : (
				<div style={{ overflowX: "auto" }}>
					<table className="admin-table">
						<thead>
							<tr>
								<th>Topic</th>
								<th>Locale</th>
								<th>Status</th>
								<th>Updated</th>
							</tr>
						</thead>
						<tbody>
							{briefs.map((brief) => (
								<tr key={brief.id}>
									<td>
										<Link href={`/admin/insights/briefs/${brief.id}`} style={{ color: "var(--ink-1)", fontWeight: 500 }}>
											{brief.topic}
										</Link>
									</td>
									<td>{brief.primaryLocale.toUpperCase()}</td>
									<td>{brief.status.replace(/_/g, " ")}</td>
									<td>{new Date(brief.updatedAt).toLocaleDateString()}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
