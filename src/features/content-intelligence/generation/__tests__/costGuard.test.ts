import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `getMonthlyBudgetUsage()` is the read-only calculation `checkBudget()`
 * now delegates to -- these tests cover both, to confirm the extraction
 * changed nothing about `checkBudget()`'s existing fail-closed behaviour.
 */

const mockCreateSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: () => mockCreateSupabaseServerClient(),
}));

const { checkBudget, getMonthlyBudgetUsage } = await import("../costGuard");

function fakeBudgetSupabase(rows: { estimated_cost_usd: number }[] = []) {
	const gte = vi.fn(async () => ({ data: rows }));
	const select = vi.fn(() => ({ gte }));
	const from = vi.fn((table: string) => {
		if (table === "ai_usage_log") return { select };
		throw new Error(`unexpected table "${table}"`);
	});
	return { from, spies: { select, gte } };
}

const originalBudgetEnv = process.env.CONTENT_AI_MONTHLY_BUDGET_USD;

beforeEach(() => {
	mockCreateSupabaseServerClient.mockReset();
});

afterEach(() => {
	if (originalBudgetEnv === undefined) delete process.env.CONTENT_AI_MONTHLY_BUDGET_USD;
	else process.env.CONTENT_AI_MONTHLY_BUDGET_USD = originalBudgetEnv;
});

describe("getMonthlyBudgetUsage", () => {
	it("sums estimated_cost_usd for the current month", async () => {
		process.env.CONTENT_AI_MONTHLY_BUDGET_USD = "10";
		mockCreateSupabaseServerClient.mockResolvedValue(fakeBudgetSupabase([{ estimated_cost_usd: 1.5 }, { estimated_cost_usd: 2.25 }]));

		const usage = await getMonthlyBudgetUsage();

		expect(usage).toEqual({ spentUsd: 3.75, budgetUsd: 10, configured: true });
	});

	it("reports configured: false and spentUsd: 0 when Supabase isn't configured", async () => {
		process.env.CONTENT_AI_MONTHLY_BUDGET_USD = "10";
		mockCreateSupabaseServerClient.mockResolvedValue(null);

		const usage = await getMonthlyBudgetUsage();

		expect(usage).toEqual({ spentUsd: 0, budgetUsd: 10, configured: false });
	});

	it("defaults budgetUsd to 0 when the env var isn't set", async () => {
		delete process.env.CONTENT_AI_MONTHLY_BUDGET_USD;
		mockCreateSupabaseServerClient.mockResolvedValue(fakeBudgetSupabase([]));

		const usage = await getMonthlyBudgetUsage();

		expect(usage.budgetUsd).toBe(0);
	});
});

describe("checkBudget", () => {
	it("allows a call when spend is below the configured budget", async () => {
		process.env.CONTENT_AI_MONTHLY_BUDGET_USD = "10";
		mockCreateSupabaseServerClient.mockResolvedValue(fakeBudgetSupabase([{ estimated_cost_usd: 4 }]));

		const status = await checkBudget();

		expect(status).toEqual({ allowed: true, spentUsd: 4, budgetUsd: 10 });
	});

	it("blocks a call once spend reaches the configured budget", async () => {
		process.env.CONTENT_AI_MONTHLY_BUDGET_USD = "10";
		mockCreateSupabaseServerClient.mockResolvedValue(fakeBudgetSupabase([{ estimated_cost_usd: 10 }]));

		const status = await checkBudget();

		expect(status.allowed).toBe(false);
	});

	it("blocks every call when no budget is configured, even with zero spend", async () => {
		delete process.env.CONTENT_AI_MONTHLY_BUDGET_USD;
		mockCreateSupabaseServerClient.mockResolvedValue(fakeBudgetSupabase([]));

		const status = await checkBudget();

		expect(status).toEqual({ allowed: false, spentUsd: 0, budgetUsd: 0 });
	});

	it("fails closed when Supabase isn't configured, regardless of the configured budget", async () => {
		process.env.CONTENT_AI_MONTHLY_BUDGET_USD = "10";
		mockCreateSupabaseServerClient.mockResolvedValue(null);

		const status = await checkBudget();

		expect(status).toEqual({ allowed: false, spentUsd: 0, budgetUsd: 10 });
	});
});
