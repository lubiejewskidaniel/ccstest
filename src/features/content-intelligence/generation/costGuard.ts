import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PipelineStage } from "../types/contentAi";

/**
 * Cost control for every AI provider call this pipeline makes. Two
 * independent guards, both fail closed (block the call) rather than fail
 * open:
 *
 * 1. A monthly USD budget (`CONTENT_AI_MONTHLY_BUDGET_USD`), checked
 *    against the sum of `ai_usage_log.estimated_cost_usd` for the
 *    current calendar month before every call.
 * 2. A per-call max-output-tokens cap, enforced inside each provider
 *    itself (`AnthropicProvider.ts`) rather than here — this module only
 *    owns the *spend* guard, not the *token* guard.
 *
 * Deliberately defaults the budget to $0 (blocking every call) when
 * `CONTENT_AI_MONTHLY_BUDGET_USD` isn't set, rather than defaulting to
 * "unlimited" — the same "safe by default, opt-in" shape as every other
 * optional external integration in this app (CRM, GSC, Bing all default
 * to a no-op, not a best-effort attempt).
 */

const inputCostPer1k = Number(process.env.CONTENT_AI_INPUT_COST_PER_1K) || 0.003;
const outputCostPer1k = Number(process.env.CONTENT_AI_OUTPUT_COST_PER_1K) || 0.015;

export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
	return (inputTokens / 1000) * inputCostPer1k + (outputTokens / 1000) * outputCostPer1k;
}

export type BudgetStatus = { allowed: boolean; spentUsd: number; budgetUsd: number };

/**
 * NOTE ON RATES: `inputCostPer1k`/`outputCostPer1k` above are
 * placeholder defaults, not a live pricing feed — publicly listed model
 * prices change over time and vary by plan/contract. Set
 * `CONTENT_AI_INPUT_COST_PER_1K` / `CONTENT_AI_OUTPUT_COST_PER_1K` to
 * your actual negotiated rates before relying on this for real budget
 * enforcement; treat the defaults as "some non-zero number so the guard
 * still functions", not as accurate accounting.
 */
export async function checkBudget(): Promise<BudgetStatus> {
	const budgetUsd = Number(process.env.CONTENT_AI_MONTHLY_BUDGET_USD) || 0;

	const supabase = await createSupabaseServerClient();
	if (!supabase) return { allowed: false, spentUsd: 0, budgetUsd };

	const monthStart = new Date();
	monthStart.setUTCDate(1);
	monthStart.setUTCHours(0, 0, 0, 0);

	const { data } = await supabase
		.from("ai_usage_log")
		.select("estimated_cost_usd")
		.gte("created_at", monthStart.toISOString());

	const spentUsd = (data ?? []).reduce((sum, row) => sum + Number(row.estimated_cost_usd ?? 0), 0);

	return { allowed: budgetUsd > 0 && spentUsd < budgetUsd, spentUsd, budgetUsd };
}

/** Records one provider call's token usage and estimated cost. Never
 * throws — a logging failure must not fail the generation call it's
 * logging (the pipeline stage that calls this has already gotten its
 * real result back by the time this runs). `briefId` is nullable —
 * widened for Checkpoint 9's AI-visibility checks, which reuse this same
 * cost-guard/usage-log rather than a second tracking mechanism, but
 * aren't tied to any one brief. */
export async function logUsage(params: {
	briefId: string | null;
	stage: PipelineStage;
	provider: string;
	model: string;
	inputTokens: number;
	outputTokens: number;
}) {
	const supabase = await createSupabaseServerClient();
	if (!supabase) return;

	const estimatedCostUsd = estimateCostUsd(params.inputTokens, params.outputTokens);

	const { error } = await supabase.from("ai_usage_log").insert({
		brief_id: params.briefId,
		stage: params.stage,
		provider: params.provider,
		model: params.model,
		input_tokens: params.inputTokens,
		output_tokens: params.outputTokens,
		estimated_cost_usd: estimatedCostUsd,
	});

	if (error) console.error("[content-intelligence] ai_usage_log insert failed:", error.message);
}
