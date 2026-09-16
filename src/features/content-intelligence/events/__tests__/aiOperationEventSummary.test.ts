import { describe, expect, it } from "vitest";
import { summariseAiOperationEventsByType } from "../aiOperationEventSummary";
import type { AiOperationEventRecord } from "../aiOperationEventQueries";

function event(overrides: Partial<AiOperationEventRecord> = {}): AiOperationEventRecord {
	return {
		id: "33333333-3333-4333-8333-333333333333",
		briefId: null,
		stage: "generation",
		operationType: "generation",
		provider: "anthropic",
		model: "claude-sonnet-5",
		executionMode: "manual",
		runId: null,
		inputTokens: 100,
		outputTokens: 200,
		estimatedCostUsd: 0.01,
		costBasis: "estimated",
		durationMs: 1000,
		outcome: "success",
		errorKind: null,
		createdAt: "2026-09-01T00:00:00.000Z",
		...overrides,
	};
}

describe("summariseAiOperationEventsByType", () => {
	it("returns an empty list for no events", () => {
		expect(summariseAiOperationEventsByType([])).toEqual([]);
	});

	it("summarises a single operation type", () => {
		const result = summariseAiOperationEventsByType([event(), event({ estimatedCostUsd: 0.02 })]);

		expect(result).toEqual([{ operationType: "generation", count: 2, totalCostUsd: 0.03, successCount: 2, failureCount: 0 }]);
	});

	it("groups multiple operation types separately", () => {
		const result = summariseAiOperationEventsByType([
			event({ operationType: "generation", estimatedCostUsd: 0.01 }),
			event({ operationType: "localisation", estimatedCostUsd: 0.05 }),
			event({ operationType: "localisation", estimatedCostUsd: 0.02 }),
		]);

		expect(result).toEqual([
			{ operationType: "localisation", count: 2, totalCostUsd: 0.07, successCount: 2, failureCount: 0 },
			{ operationType: "generation", count: 1, totalCostUsd: 0.01, successCount: 1, failureCount: 0 },
		]);
	});

	it("sorts groups by total estimated cost, highest first", () => {
		const result = summariseAiOperationEventsByType([
			event({ operationType: "research", estimatedCostUsd: 0.001 }),
			event({ operationType: "ai_visibility", estimatedCostUsd: 0.5 }),
		]);

		expect(result.map((row) => row.operationType)).toEqual(["ai_visibility", "research"]);
	});

	it("counts successes and failures separately", () => {
		const result = summariseAiOperationEventsByType([
			event({ outcome: "success" }),
			event({ outcome: "failure", errorKind: "timeout" }),
			event({ outcome: "failure", errorKind: "provider_error" }),
			event({ outcome: null }),
		]);

		expect(result).toEqual([{ operationType: "generation", count: 4, totalCostUsd: 0.04, successCount: 1, failureCount: 2 }]);
	});

	it("groups events with no operationType under 'unknown'", () => {
		const result = summariseAiOperationEventsByType([event({ operationType: null })]);

		expect(result).toEqual([{ operationType: "unknown", count: 1, totalCostUsd: 0.01, successCount: 1, failureCount: 0 }]);
	});
});
