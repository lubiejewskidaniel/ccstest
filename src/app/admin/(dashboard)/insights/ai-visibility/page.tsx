import type { Metadata } from "next";
import Link from "next/link";
import { listAiVisibilityChecks } from "@/features/content-intelligence/monitoring/aiVisibility";
import { AiVisibilityCheckForm } from "@/features/content-intelligence/monitoring/AiVisibilityCheckForm";

export const metadata: Metadata = { title: "AI visibility" };

export default async function AiVisibilityPage() {
	const checks = await listAiVisibilityChecks();

	return (
		<div>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
				<h1 style={{ fontSize: "1.6rem", fontWeight: 600 }}>AI visibility</h1>
				<Link href="/admin/insights" className="btn btn-ghost">
					Back to articles
				</Link>
			</div>
			<p style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 24, maxWidth: 720 }}>
				Asks the configured AI provider a representative question and checks whether it mentions the studio.
				This is a proxy signal for one specific provider, not a measurement of Google AI Overviews, ChatGPT
				search, or any other real-world AI product — treat a &quot;mentioned&quot; result as encouraging, not as
				proof of visibility elsewhere. Uses the same AI provider and monthly budget as the Checkpoint 7
				editorial pipeline.
			</p>

			<AiVisibilityCheckForm />

			{checks.length === 0 ? (
				<div className="admin-empty">No checks run yet.</div>
			) : (
				<div style={{ overflowX: "auto" }}>
					<table className="admin-table">
						<thead>
							<tr>
								<th>Query</th>
								<th>Locale</th>
								<th>Mentioned</th>
								<th>Snippet</th>
								<th>Checked</th>
							</tr>
						</thead>
						<tbody>
							{checks.map((check) => (
								<tr key={check.id}>
									<td>{check.query}</td>
									<td>{check.locale?.toUpperCase() ?? "-"}</td>
									<td>{check.mentioned ? "Yes" : "No"}</td>
									<td style={{ maxWidth: 320, fontSize: 12 }}>{check.snippet ?? "-"}</td>
									<td>{new Date(check.checkedAt).toLocaleString()}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
