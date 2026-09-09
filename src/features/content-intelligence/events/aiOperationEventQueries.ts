import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AiOperationCostBasis, AiOperationErrorKind, AiOperationExecutionMode, AiOperationOutcome } from "../types/aiOperationEvent";
import type { PipelineStage } from "../types/contentAi";

/**
 * Phase 3C.4C.1 — the smallest read foundation this phase's brief (Step
 * 5) asks for: events within a date range, and events sharing a
 * `run_id`. Deliberately not an analytics service: no aggregation, no
 * grouping, no SQL/RPC function — `costGuard.checkBudget()`'s own
 * monthly-sum query is left completely untouched by this phase and
 * remains the only place that computes a spend total today.
 *
 * Same session-aware `createSupabaseServerClient()` client as
 * `aiOperationEventWriter.ts` and `costGuard.ts` — no service-role
 * client, so results are already scoped by `ai_usage_log`'s existing
 * "editor select" RLS policy exactly as every other read of this table
 * already is.
 */

export type AiOperationEventRecord = {
	id: string;
	briefId: string | null;
	stage: PipelineStage | null;
	operationType: string | null;
	provider: string;
	model: string;
	executionMode: AiOperationExecutionMode | null;
	runId: string | null;
	inputTokens: number;
	outputTokens: number;
	estimatedCostUsd: number;
	costBasis: AiOperationCostBasis | null;
	durationMs: number | null;
	outcome: AiOperationOutcome | null;
	errorKind: AiOperationErrorKind | null;
	createdAt: string;
};

export type GetAiOperationEventsResult =
	| { ok: true; events: AiOperationEventRecord[] }
	| { ok: false; reason: "not_configured"; message: string }
	| { ok: false; reason: "invalid_input"; message: string }
	| { ok: false; reason: "database_error"; message: string };

const SELECT_COLUMNS =
	"id, brief_id, stage, operation_type, provider, model, execution_mode, run_id, input_tokens, output_tokens, estimated_cost_usd, cost_basis, duration_ms, outcome, error_kind, created_at";

/** Raw shape read back from Supabase, before mapping to
 * `AiOperationEventRecord`'s camelCase field names. */
type AiUsageLogRow = {
	id: string;
	brief_id: string | null;
	stage: string | null;
	operation_type: string | null;
	provider: string;
	model: string;
	execution_mode: string | null;
	run_id: string | null;
	input_tokens: number;
	output_tokens: number;
	estimated_cost_usd: number | string;
	cost_basis: string | null;
	duration_ms: number | null;
	outcome: string | null;
	error_kind: string | null;
	created_at: string;
};

function toRecord(row: AiUsageLogRow): AiOperationEventRecord {
	return {
		id: row.id,
		briefId: row.brief_id,
		stage: row.stage as PipelineStage | null,
		operationType: row.operation_type,
		provider: row.provider,
		model: row.model,
		executionMode: row.execution_mode as AiOperationExecutionMode | null,
		runId: row.run_id,
		inputTokens: row.input_tokens,
		outputTokens: row.output_tokens,
		estimatedCostUsd: Number(row.estimated_cost_usd),
		costBasis: row.cost_basis as AiOperationCostBasis | null,
		durationMs: row.duration_ms,
		outcome: row.outcome as AiOperationOutcome | null,
		errorKind: row.error_kind as AiOperationErrorKind | null,
		createdAt: row.created_at,
	};
}

/** Every event with `created_at` in `[from, to)`. Mirrors
 * `costGuard.checkBudget()`'s own `.gte("created_at", ...)` query shape,
 * extended with an upper bound so a caller can ask for a bounded window
 * rather than only "since a start date". */
export async function getAiOperationEventsInRange(range: { from: Date; to: Date }): Promise<GetAiOperationEventsResult> {
	if (!(range.from instanceof Date) || Number.isNaN(range.from.getTime()) || !(range.to instanceof Date) || Number.isNaN(range.to.getTime()) || range.from > range.to) {
		return { ok: false, reason: "invalid_input", message: "A valid `from`/`to` date range is required." };
	}

	const supabase = await createSupabaseServerClient();
	if (!supabase) {
		return { ok: false, reason: "not_configured", message: "Supabase isn't configured in this environment." };
	}

	const { data, error } = await supabase
		.from("ai_usage_log")
		.select(SELECT_COLUMNS)
		.gte("created_at", range.from.toISOString())
		.lt("created_at", range.to.toISOString())
		.order("created_at", { ascending: false });

	if (error || !data) {
		console.error("[content-intelligence] ai_usage_log range query failed:", error?.message);
		return { ok: false, reason: "database_error", message: "Could not load AI operation events." };
	}

	return { ok: true, events: (data as AiUsageLogRow[]).map(toRecord) };
}

const runIdSchema = z.string().uuid();

/** Every event sharing one `run_id` — the correlation this phase's Step
 * 6 (run_id design) exists to make queryable, once a future scheduler or
 * multi-step manual workflow actually starts setting it. */
export async function getAiOperationEventsByRunId(runId: string): Promise<GetAiOperationEventsResult> {
	const parsed = runIdSchema.safeParse(runId);
	if (!parsed.success) {
		return { ok: false, reason: "invalid_input", message: "A valid run id is required." };
	}

	const supabase = await createSupabaseServerClient();
	if (!supabase) {
		return { ok: false, reason: "not_configured", message: "Supabase isn't configured in this environment." };
	}

	const { data, error } = await supabase.from("ai_usage_log").select(SELECT_COLUMNS).eq("run_id", parsed.data).order("created_at", { ascending: true });

	if (error || !data) {
		console.error("[content-intelligence] ai_usage_log run_id query failed:", error?.message);
		return { ok: false, reason: "database_error", message: "Could not load AI operation events for this run." };
	}

	return { ok: true, events: (data as AiUsageLogRow[]).map(toRecord) };
}
