import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase 3C.4C.1 — coverage for the minimal read foundation
 * (`getAiOperationEventsInRange` / `getAiOperationEventsByRunId`). Same
 * mocking shape as `aiOperationEventWriter.test.ts`.
 */

const mockCreateSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: () => mockCreateSupabaseServerClient(),
}));

const { getAiOperationEventsInRange, getAiOperationEventsByRunId } = await import("../aiOperationEventQueries");

const ROW = {
	id: "33333333-3333-4333-8333-333333333333",
	brief_id: null,
	stage: null,
	operation_type: "article_visual_generation",
	provider: "openai",
	model: "gpt-image-2",
	execution_mode: "manual",
	run_id: "44444444-4444-4444-8444-444444444444",
	input_tokens: 0,
	output_tokens: 0,
	estimated_cost_usd: 0,
	cost_basis: "unknown",
	duration_ms: 4200,
	outcome: "success",
	error_kind: null,
	created_at: "2026-09-01T00:00:00.000Z",
};

function fakeRangeSupabase(opts: { rows?: unknown[]; error?: { message: string } | null } = {}) {
	const { rows = [ROW], error = null } = opts;
	const order = vi.fn(async () => ({ data: error ? null : rows, error }));
	const lt = vi.fn(() => ({ order }));
	const gte = vi.fn(() => ({ lt }));
	const select = vi.fn(() => ({ gte }));
	const from = vi.fn((table: string) => {
		if (table === "ai_usage_log") return { select };
		throw new Error(`unexpected table "${table}"`);
	});
	return { from, spies: { select, gte, lt, order } };
}

function fakeRunIdSupabase(opts: { rows?: unknown[]; error?: { message: string } | null } = {}) {
	const { rows = [ROW], error = null } = opts;
	const order = vi.fn(async () => ({ data: error ? null : rows, error }));
	const eq = vi.fn(() => ({ order }));
	const select = vi.fn(() => ({ eq }));
	const from = vi.fn((table: string) => {
		if (table === "ai_usage_log") return { select };
		throw new Error(`unexpected table "${table}"`);
	});
	return { from, spies: { select, eq, order } };
}

beforeEach(() => {
	mockCreateSupabaseServerClient.mockReset();
});

describe("getAiOperationEventsInRange", () => {
	it("returns mapped events for a valid range", async () => {
		const supabase = fakeRangeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await getAiOperationEventsInRange({ from: new Date("2026-09-01T00:00:00Z"), to: new Date("2026-10-01T00:00:00Z") });

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.events).toHaveLength(1);
			expect(result.events[0]?.operationType).toBe("article_visual_generation");
			expect(result.events[0]?.estimatedCostUsd).toBe(0);
			expect(result.events[0]?.costBasis).toBe("unknown");
		}
	});

	it("rejects an inverted date range", async () => {
		const supabase = fakeRangeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await getAiOperationEventsInRange({ from: new Date("2026-10-01T00:00:00Z"), to: new Date("2026-09-01T00:00:00Z") });

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe("invalid_input");
		expect(supabase.spies.select).not.toHaveBeenCalled();
	});

	it("returns a safe database_error result without leaking the raw error", async () => {
		const supabase = fakeRangeSupabase({ error: { message: "relation \"ai_usage_log\" does not exist" } });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const result = await getAiOperationEventsInRange({ from: new Date("2026-09-01T00:00:00Z"), to: new Date("2026-10-01T00:00:00Z") });

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe("database_error");
			expect(result.message).not.toContain("relation");
		}
		consoleSpy.mockRestore();
	});

	it("returns not_configured when Supabase isn't configured", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(null);

		const result = await getAiOperationEventsInRange({ from: new Date("2026-09-01T00:00:00Z"), to: new Date("2026-10-01T00:00:00Z") });

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe("not_configured");
	});
});

describe("getAiOperationEventsByRunId", () => {
	it("returns events sharing a run_id", async () => {
		const supabase = fakeRunIdSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await getAiOperationEventsByRunId("44444444-4444-4444-8444-444444444444");

		expect(result.ok).toBe(true);
		if (result.ok) expect(result.events[0]?.runId).toBe("44444444-4444-4444-8444-444444444444");
		expect(supabase.spies.eq).toHaveBeenCalledWith("run_id", "44444444-4444-4444-8444-444444444444");
	});

	it("rejects a non-UUID run id", async () => {
		const supabase = fakeRunIdSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await getAiOperationEventsByRunId("not-a-uuid");

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe("invalid_input");
		expect(supabase.spies.select).not.toHaveBeenCalled();
	});
});
