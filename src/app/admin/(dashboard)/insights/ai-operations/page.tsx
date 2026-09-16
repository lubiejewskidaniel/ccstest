import type { Metadata } from "next";
import Link from "next/link";
import { getMonthlyBudgetUsage } from "@/features/content-intelligence/generation/costGuard";
import { getAiOperationEventsInRange } from "@/features/content-intelligence/events/aiOperationEventQueries";
import { summariseAiOperationEventsByType } from "@/features/content-intelligence/events/aiOperationEventSummary";

export const metadata: Metadata = { title: "AI operations" };

const DAYS_BACK = 30;

function formatUsd(amount: number): string {
	return `$${amount.toFixed(4)}`;
}

/**
 * Read-only admin surface over `ai_usage_log`, the same table
 * `costGuard.ts` enforces the monthly spend guard against. Budget figures
 * come from `getMonthlyBudgetUsage()` (the read-only half of that guard)
 * rather than `checkBudget()` itself, so this page never depends on a
 * function whose contract is "may this AI call proceed".
 *
 * Auth boundary is the shared `(dashboard)` layout, same as every other
 * Insights admin page -- it already redirects any signed-out visitor to
 * `/admin/login`, and any session it lets through is guaranteed
 * editor-or-admin (`getAdminSession()` returns null otherwise).
 */
export default async function AiOperationsPage() {
	const to = new Date();
	const from = new Date(to.getTime() - DAYS_BACK * 24 * 60 * 60 * 1000);

	const [budget, eventsResult] = await Promise.all([getMonthlyBudgetUsage(), getAiOperationEventsInRange({ from, to })]);

	const events = eventsResult.ok ? eventsResult.events : [];
	const byOperationType = summariseAiOperationEventsByType(events);
	const remainingUsd = Math.max(budget.budgetUsd - budget.spentUsd, 0);
	const percentUsed = budget.budgetUsd > 0 ? (budget.spentUsd / budget.budgetUsd) * 100 : null;

	return (
		<div>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
				<h1 style={{ fontSize: "1.6rem", fontWeight: 600 }}>AI operations</h1>
				<div style={{ display: "flex", gap: 10 }}>
					<Link href="/admin/insights/performance" className="btn btn-ghost">
						Performance
					</Link>
					<Link href="/admin/insights" className="btn btn-ghost">
						Back to articles
					</Link>
				</div>
			</div>
			<p style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 28 }}>
				Estimated cost and call activity for the Content Intelligence AI pipeline (research, generation, localisation, AI visibility), read from{" "}
				<code>ai_usage_log</code>. Figures are estimated from configured token-cost rates, not provider billing or exact invoice cost. Article Visual
				(image) generation is not yet recorded here, so this page does not reflect every AI-related cost in Code Consulting Studio.
			</p>

			<b style={{ display: "block", fontSize: 13.5, marginBottom: 12 }}>Monthly budget</b>
			{!budget.configured ? (
				<div className="admin-empty" style={{ marginBottom: 40 }}>
					Supabase isn&apos;t configured in this environment, so monthly spend can&apos;t be measured.
				</div>
			) : (
				<div style={{ overflowX: "auto", marginBottom: 40 }}>
					<table className="admin-table">
						<thead>
							<tr>
								<th>Spent this month (estimated)</th>
								<th>Configured budget</th>
								<th>Remaining</th>
								<th>Percent used</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td>{formatUsd(budget.spentUsd)}</td>
								<td>{budget.budgetUsd > 0 ? formatUsd(budget.budgetUsd) : "Not configured"}</td>
								<td>{budget.budgetUsd > 0 ? formatUsd(remainingUsd) : "-"}</td>
								<td>{percentUsed === null ? "-" : `${percentUsed.toFixed(0)}%`}</td>
							</tr>
						</tbody>
					</table>
				</div>
			)}

			<b style={{ display: "block", fontSize: 13.5, marginBottom: 12 }}>By operation type (last {DAYS_BACK} days)</b>
			{byOperationType.length === 0 ? (
				<div className="admin-empty" style={{ marginBottom: 40 }}>
					No AI operations recorded in the last {DAYS_BACK} days.
				</div>
			) : (
				<div style={{ overflowX: "auto", marginBottom: 40 }}>
					<table className="admin-table">
						<thead>
							<tr>
								<th>Operation type</th>
								<th>Calls</th>
								<th>Succeeded</th>
								<th>Failed</th>
								<th>Estimated cost</th>
							</tr>
						</thead>
						<tbody>
							{byOperationType.map((row) => (
								<tr key={row.operationType}>
									<td>{row.operationType}</td>
									<td>{row.count}</td>
									<td>{row.successCount}</td>
									<td>{row.failureCount}</td>
									<td>{formatUsd(row.totalCostUsd)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<b style={{ display: "block", fontSize: 13.5, marginBottom: 12 }}>Recent operations (last {DAYS_BACK} days)</b>
			{!eventsResult.ok ? (
				<div className="admin-empty">Could not load AI operation events.</div>
			) : events.length === 0 ? (
				<div className="admin-empty">No AI operations recorded in the last {DAYS_BACK} days.</div>
			) : (
				<div style={{ overflowX: "auto" }}>
					<table className="admin-table">
						<thead>
							<tr>
								<th>Stage</th>
								<th>Provider / model</th>
								<th>Mode</th>
								<th>Input tokens</th>
								<th>Output tokens</th>
								<th>Estimated cost</th>
								<th>Cost basis</th>
								<th>Duration</th>
								<th>Outcome</th>
								<th>When</th>
							</tr>
						</thead>
						<tbody>
							{events.map((event) => (
								<tr key={event.id}>
									<td>{event.operationType ?? event.stage ?? "-"}</td>
									<td>{`${event.provider} / ${event.model}`}</td>
									<td>{event.executionMode ?? "-"}</td>
									<td>{event.inputTokens}</td>
									<td>{event.outputTokens}</td>
									<td>{formatUsd(event.estimatedCostUsd)}</td>
									<td>{event.costBasis ?? "-"}</td>
									<td>{event.durationMs !== null ? `${event.durationMs} ms` : "-"}</td>
									<td>{event.outcome === "failure" && event.errorKind ? `failure (${event.errorKind})` : (event.outcome ?? "-")}</td>
									<td>{new Date(event.createdAt).toLocaleString()}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
