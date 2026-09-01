import type { Metadata } from "next";
import Link from "next/link";
import { getArticleConversions } from "@/features/content-intelligence/conversion/conversionIntelligence";

export const metadata: Metadata = { title: "Conversions" };

export default async function ConversionsPage() {
	const result = await getArticleConversions();

	return (
		<div>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
				<h1 style={{ fontSize: "1.6rem", fontWeight: 600 }}>Conversion intelligence</h1>
				<Link href="/admin/insights" className="btn btn-ghost">
					Back to articles
				</Link>
			</div>
			<p style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 28 }}>
				Leads (last 90 days) whose first-touch landing page was an Insights article — traffic alone doesn&apos;t
				determine success (Decision 12), this is the conversion half. Admin-only: lead data spans all three
				business lines, same boundary as <code>/admin/leads</code>.
			</p>

			{!result.ok ? (
				<div className="admin-empty">{result.message}</div>
			) : result.rows.length === 0 ? (
				<div className="admin-empty">No leads attributed to an Insights article yet.</div>
			) : (
				<div style={{ overflowX: "auto" }}>
					<table className="admin-table">
						<thead>
							<tr>
								<th>Article slug</th>
								<th>Locale</th>
								<th>Leads</th>
							</tr>
						</thead>
						<tbody>
							{result.rows.map((row) => (
								<tr key={`${row.locale}-${row.slug}`}>
									<td>{row.slug}</td>
									<td>{row.locale.toUpperCase()}</td>
									<td>{row.conversions}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
