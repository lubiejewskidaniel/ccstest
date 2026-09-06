import type { Metadata } from "next";
import Link from "next/link";
import { listAllOpportunities } from "@/features/content-intelligence/planner/queries";
import { anyProviderConfigured, configuredProviderIds } from "@/features/content-intelligence/keywords/ingest";
import { OpportunitiesToolbar } from "@/features/content-intelligence/planner/OpportunitiesToolbar";
import { OpportunityStatusSelect } from "@/features/content-intelligence/planner/OpportunityStatusSelect";

export const metadata: Metadata = { title: "Opportunities" };

export default async function OpportunitiesPage() {
	const [opportunities, configured] = await Promise.all([listAllOpportunities(), Promise.resolve(anyProviderConfigured())]);
	const providerIds = configuredProviderIds();

	return (
		<div>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
				<h1 style={{ fontSize: "1.6rem", fontWeight: 600 }}>Content opportunities</h1>
				<Link href="/admin/insights" className="btn btn-ghost">
					Back to articles
				</Link>
			</div>
			<p style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 20 }}>
				Search queries with unrealized potential — high demand relative to current position, scored by{" "}
				<code>scoreOpportunity()</code>. Not traffic alone: a query already ranking well or getting clicks in line with
				its position won&apos;t surface highly here.
			</p>

			{!configured ? (
				<div className="admin-empty" style={{ marginBottom: 24, textAlign: "left", padding: 20 }}>
					No search data provider is connected yet. Set{" "}
					<code>GOOGLE_SERVICE_ACCOUNT_EMAIL</code> / <code>GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code> /{" "}
					<code>GOOGLE_SEARCH_CONSOLE_SITE_URL</code> for Google Search Console, and/or{" "}
					<code>BING_WEBMASTER_API_KEY</code> / <code>BING_WEBMASTER_SITE_URL</code> for Bing Webmaster Tools, in
					your environment, then use &quot;Refresh from Google/Bing&quot; below.
				</div>
			) : (
				<p style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 16 }}>
					Connected: {providerIds.join(", ")}.
				</p>
			)}

			<OpportunitiesToolbar />

			{opportunities.length === 0 ? (
				<div className="admin-empty">No opportunities yet — ingest search data, then recompute scores.</div>
			) : (
				<div style={{ overflowX: "auto" }}>
					<table className="admin-table">
						<thead>
							<tr>
								<th>Query</th>
								<th>Impressions</th>
								<th>Clicks</th>
								<th>Avg position</th>
								<th>Score</th>
								<th>Already covered</th>
								<th>Status</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{opportunities.map((row) => (
								<tr key={row.id}>
									<td>{row.query}</td>
									<td>{row.totalImpressions}</td>
									<td>{row.totalClicks}</td>
									<td>{row.avgPosition?.toFixed(1) ?? "-"}</td>
									<td>{row.opportunityScore.toFixed(1)}</td>
									<td>{row.matchedArticleId ? "Yes" : "No"}</td>
									<td>
										<OpportunityStatusSelect id={row.id} status={row.status} />
									</td>
									<td>
										<Link
											href={`/admin/insights/briefs/new?opportunityId=${row.id}&topic=${encodeURIComponent(row.query)}&locale=${row.locale ?? "en"}`}
											className="btn btn-ghost"
											style={{ fontSize: 12 }}
										>
											Create brief
										</Link>
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
