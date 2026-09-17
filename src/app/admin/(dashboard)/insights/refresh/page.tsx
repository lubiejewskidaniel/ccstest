import type { Metadata } from "next";
import Link from "next/link";
import { listRefreshCandidates } from "@/features/content-intelligence/refresh/staleness";
import { listRefreshHistory, hasPendingRefresh, isEligibleForEvaluation, daysUntilEvaluable } from "@/features/content-intelligence/refresh/refreshLog";
import { EvaluateRefreshButton } from "@/features/content-intelligence/refresh/EvaluateRefreshButton";

export const metadata: Metadata = { title: "Content refresh" };

const STATUS_LABEL: Record<string, string> = {
	pending: "Measuring…",
	improved: "Improved",
	neutral: "Neutral",
	declined: "Declined",
	insufficient_data: "Insufficient data",
};

export default async function ContentRefreshPage() {
	const [candidates, history] = await Promise.all([listRefreshCandidates(), listRefreshHistory()]);
	const pendingByArticle = new Map(
		await Promise.all(candidates.map(async (c) => [c.articleId, await hasPendingRefresh(c.articleId)] as const)),
	);

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
				trend. Refreshing existing content matters as much as publishing new content — this doesn&apos;t touch
				anything, it only surfaces candidates for a human to act on.
			</p>

			{candidates.length === 0 ? (
				<div className="admin-empty" style={{ marginBottom: 40 }}>
					Nothing flagged right now.
				</div>
			) : (
				<div style={{ overflowX: "auto", marginBottom: 40 }}>
					<table className="admin-table">
						<thead>
							<tr>
								<th>Title</th>
								<th>Locale</th>
								<th>Age (days)</th>
								<th>Reasons</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{candidates.map((candidate) => {
								const measuring = pendingByArticle.get(candidate.articleId);
								return (
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
										<td>
											{measuring ? (
												<span style={{ fontSize: 12, color: "var(--ink-3)" }}>Active measurement in progress</span>
											) : (
												<Link
													href={`/admin/insights/${candidate.articleId}/edit?refreshCandidate=1`}
													className="btn btn-ghost"
													style={{ fontSize: 12 }}
												>
													Review / edit
												</Link>
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}

			<b style={{ display: "block", fontSize: 13.5, marginBottom: 12 }}>Refresh history</b>
			{history.length === 0 ? (
				<div className="admin-empty">No refreshes recorded yet.</div>
			) : (
				<div style={{ overflowX: "auto" }}>
					<table className="admin-table">
						<thead>
							<tr>
								<th>Article</th>
								<th>Refreshed</th>
								<th>Reason snapshot</th>
								<th>Baseline</th>
								<th>Status</th>
								<th>After</th>
							</tr>
						</thead>
						<tbody>
							{history.map((entry) => (
								<tr key={entry.id}>
									<td>
										<Link href={`/admin/insights/${entry.articleId}/edit`} style={{ color: "var(--ink-1)" }}>
											{entry.locale.toUpperCase()}
										</Link>
									</td>
									<td style={{ fontSize: 12 }}>{new Date(entry.triggeredAt).toLocaleDateString()}</td>
									<td>
										<ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--ink-2)" }}>
											{entry.reasons.map((reason) => (
												<li key={reason}>{reason}</li>
											))}
										</ul>
									</td>
									<td style={{ fontSize: 12 }}>
										{entry.baselineWindowDays}d: {entry.baselineViews} views, {entry.baselineCtaClicks} CTA
										{entry.baselineAvgPosition !== null ? `, pos ${entry.baselineAvgPosition.toFixed(1)}` : ""}
									</td>
									<td style={{ fontSize: 12 }}>
										{STATUS_LABEL[entry.evaluationStatus] ?? entry.evaluationStatus}
										{entry.evaluationStatus === "pending" && !isEligibleForEvaluation(entry) ? (
											<div style={{ color: "var(--ink-3)" }}>Evaluable in {daysUntilEvaluable(entry)}d</div>
										) : null}
									</td>
									<td style={{ fontSize: 12 }}>
										{entry.evaluationStatus === "pending" ? (
											isEligibleForEvaluation(entry) ? (
												<EvaluateRefreshButton id={entry.id} />
											) : (
												"—"
											)
										) : entry.evaluationStatus === "insufficient_data" && entry.evaluatedAt === null ? (
											"—"
										) : (
											<>
												{entry.afterViews} views, {entry.afterCtaClicks} CTA
												{entry.afterAvgPosition !== null ? `, pos ${entry.afterAvgPosition.toFixed(1)}` : ""}
											</>
										)}
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
