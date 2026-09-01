import type { Metadata } from "next";
import Link from "next/link";
import { detectCannibalisation } from "@/features/content-intelligence/opportunities/cannibalisation";

export const metadata: Metadata = { title: "Cannibalisation" };

export default async function CannibalisationPage() {
	const rows = await detectCannibalisation();

	return (
		<div>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
				<h1 style={{ fontSize: "1.6rem", fontWeight: 600 }}>Keyword cannibalisation</h1>
				<Link href="/admin/insights" className="btn btn-ghost">
					Back to articles
				</Link>
			</div>
			<p style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 28 }}>
				Search queries where two or more published articles both received impressions in the last 30 days — a
				sign the site is competing with itself instead of one article clearly owning the term.
			</p>

			{rows.length === 0 ? (
				<div className="admin-empty">No cannibalisation detected right now.</div>
			) : (
				<div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
					{rows.map((row) => (
						<div key={row.query} style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: 16 }}>
							<b style={{ display: "block", marginBottom: 10 }}>{row.query}</b>
							<table className="admin-table">
								<thead>
									<tr>
										<th>Article</th>
										<th>Locale</th>
										<th>Impressions</th>
										<th>Clicks</th>
										<th>Avg position</th>
									</tr>
								</thead>
								<tbody>
									{row.pages.map((page) => (
										<tr key={`${page.locale}-${page.slug}`}>
											<td>{page.slug}</td>
											<td>{page.locale.toUpperCase()}</td>
											<td>{page.impressions}</td>
											<td>{page.clicks}</td>
											<td>{page.avgPosition?.toFixed(1) ?? "-"}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
