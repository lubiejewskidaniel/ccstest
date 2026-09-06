import type { Metadata } from "next";
import Link from "next/link";
import { getTopArticles, getCtaClickCounts } from "@/features/insights/cms/queries";
import { getArticlePerformance } from "@/features/content-intelligence/monitoring/performanceAnalysis";

export const metadata: Metadata = { title: "Performance" };

const DAYS_BACK = 30;

export default async function InsightsPerformancePage() {
	const [topArticles, ctaClicks, articlePerformance] = await Promise.all([
		getTopArticles(DAYS_BACK, 15),
		getCtaClickCounts(DAYS_BACK),
		getArticlePerformance(DAYS_BACK),
	]);
	const bySearchImpressions = [...articlePerformance].sort((a, b) => b.searchImpressions - a.searchImpressions).slice(0, 15);

	return (
		<div>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
				<h1 style={{ fontSize: "1.6rem", fontWeight: 600 }}>Performance</h1>
				<div style={{ display: "flex", gap: 10 }}>
					<Link href="/admin/insights/refresh" className="btn btn-ghost">
						Refresh
					</Link>
					<Link href="/admin/insights/cannibalisation" className="btn btn-ghost">
						Cannibalisation
					</Link>
					<Link href="/admin/insights/conversions" className="btn btn-ghost">
						Conversions
					</Link>
					<Link href="/admin/insights/ai-visibility" className="btn btn-ghost">
						AI visibility
					</Link>
					<Link href="/admin/insights" className="btn btn-ghost">
						Back to articles
					</Link>
				</div>
			</div>
			<p style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 28 }}>
				Last {DAYS_BACK} days, from the first-party event log (
				<code>analytics_events</code>). Requires analytics consent from
				visitors and a configured Supabase project — counts read zero
				until both are in place.
			</p>

			<b style={{ display: "block", fontSize: 13.5, marginBottom: 12 }}>Top articles by views</b>
			{topArticles.length === 0 ? (
				<div className="admin-empty" style={{ marginBottom: 40 }}>
					No article views recorded yet.
				</div>
			) : (
				<div style={{ overflowX: "auto", marginBottom: 40 }}>
					<table className="admin-table">
						<thead>
							<tr>
								<th>Slug</th>
								<th>Locale</th>
								<th>Views</th>
							</tr>
						</thead>
						<tbody>
							{topArticles.map((row) => (
								<tr key={`${row.locale}-${row.slug}`}>
									<td>{row.slug}</td>
									<td>{row.locale.toUpperCase()}</td>
									<td>{row.viewCount}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<b style={{ display: "block", fontSize: 13.5, marginBottom: 12 }}>CTA clicks by location</b>
			{ctaClicks.length === 0 ? (
				<div className="admin-empty">No CTA clicks recorded yet.</div>
			) : (
				<div style={{ overflowX: "auto" }}>
					<table className="admin-table">
						<thead>
							<tr>
								<th>Slug</th>
								<th>CTA location</th>
								<th>Clicks</th>
							</tr>
						</thead>
						<tbody>
							{ctaClicks.map((row) => (
								<tr key={`${row.slug}-${row.ctaLocation}`}>
									<td>{row.slug}</td>
									<td>{row.ctaLocation}</td>
									<td>{row.clickCount}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<b style={{ display: "block", fontSize: 13.5, margin: "40px 0 12px" }}>Search performance by article</b>
			<p style={{ color: "var(--ink-3)", fontSize: 12.5, marginBottom: 12 }}>
				Joins each published article to its Google Search Console rows (page URL matched to the article&apos;s
				canonical path) — needs Search Console ingested via{" "}
				<Link href="/admin/insights/opportunities" style={{ color: "var(--spark)" }}>
					Opportunities
				</Link>
				.
			</p>
			{bySearchImpressions.every((row) => row.searchImpressions === 0) ? (
				<div className="admin-empty">No search-console data matched to a published article yet.</div>
			) : (
				<div style={{ overflowX: "auto" }}>
					<table className="admin-table">
						<thead>
							<tr>
								<th>Title</th>
								<th>Locale</th>
								<th>Impressions</th>
								<th>Clicks</th>
								<th>Avg position</th>
								<th>Views</th>
							</tr>
						</thead>
						<tbody>
							{bySearchImpressions.map((row) => (
								<tr key={row.articleId}>
									<td>{row.title}</td>
									<td>{row.locale.toUpperCase()}</td>
									<td>{row.searchImpressions}</td>
									<td>{row.searchClicks}</td>
									<td>{row.avgPosition?.toFixed(1) ?? "-"}</td>
									<td>{row.views}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
