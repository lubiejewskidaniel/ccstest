import type { AiOperationEventRecord } from "./aiOperationEventQueries";

export type AiOperationTypeSummary = {
	operationType: string;
	count: number;
	totalCostUsd: number;
	successCount: number;
	failureCount: number;
};

const UNKNOWN_OPERATION_TYPE = "unknown";

/**
 * Groups already-fetched AI operation events by `operationType` for the
 * admin AI Operations page. Deliberately application-code aggregation,
 * not a new database query -- at this pipeline's current call volume (a
 * handful of manually-triggered stages, no automated scheduler running
 * yet) the lookback window's row count is small enough that a second SQL
 * aggregation would be premature.
 *
 * An event with no `operationType` (only possible on a historical row
 * from before migration 014) is grouped under "unknown" rather than
 * dropped, so its cost still contributes to the total.
 */
export function summariseAiOperationEventsByType(events: AiOperationEventRecord[]): AiOperationTypeSummary[] {
	const byType = new Map<string, AiOperationTypeSummary>();

	for (const event of events) {
		const key = event.operationType ?? UNKNOWN_OPERATION_TYPE;
		const existing = byType.get(key) ?? { operationType: key, count: 0, totalCostUsd: 0, successCount: 0, failureCount: 0 };

		existing.count += 1;
		existing.totalCostUsd += event.estimatedCostUsd;
		if (event.outcome === "success") existing.successCount += 1;
		if (event.outcome === "failure") existing.failureCount += 1;

		byType.set(key, existing);
	}

	return Array.from(byType.values()).sort((a, b) => b.totalCostUsd - a.totalCostUsd);
}
