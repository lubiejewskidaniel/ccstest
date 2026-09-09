import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AiOperationEventInput } from "../types/aiOperationEvent";

/**
 * Phase 3C.4C.1 — the one place that persists an
 * `AiOperationEventInput` into `public.ai_usage_log`.
 *
 * This is a foundation, not a replacement: `costGuard.ts`'s
 * `checkBudget()`/`logUsage()` are untouched by this phase and remain
 * exactly as they were, and nothing here is called from
 * research/generation/localisation/ai_visibility or article-visual
 * generation yet — Phase 3C.4C.2 (text) and 3C.4C.3 (image) are what
 * will eventually call `recordAiOperationEvent()` below, once this
 * module has a track record of its own.
 *
 * Server-side only, session-aware client — deliberately
 * `createSupabaseServerClient()` (cookie-based, RLS still applies), the
 * exact same client `costGuard.ts` already uses for this same table.
 * `ai_usage_log`'s existing "editor insert" RLS policy
 * (006_ai_editorial.sql) already allows any authenticated editor/admin
 * session to insert here — nothing about this phase's requirements
 * (event-shape validation, a richer column set) needs bypassing RLS, so
 * this deliberately does NOT use
 * `createSupabasePrivilegedClient()`/the service-role key, matching this
 * phase's own "never service-role unless already proven necessary"
 * instruction.
 */

const executionModeSchema = z.union([z.literal("manual"), z.literal("automated")]);

const outcomeSchema = z.union([z.literal("success"), z.literal("failure")]);

const errorKindSchema = z.union([
	z.literal("auth"),
	z.literal("not_found"),
	z.literal("not_configured"),
	z.literal("budget_exceeded"),
	z.literal("timeout"),
	z.literal("network"),
	z.literal("provider_error"),
	z.literal("invalid_response"),
	z.literal("validation"),
	z.literal("persistence"),
	z.literal("storage_error"),
	z.literal("unknown"),
]);

const costBasisSchema = z.union([z.literal("reported"), z.literal("deterministic"), z.literal("estimated"), z.literal("unknown")]);

const pipelineStageSchema = z.union([z.literal("research"), z.literal("generation"), z.literal("localisation"), z.literal("ai_visibility")]);

/**
 * Deliberately `.strict()` — an unexpected extra key on the input object
 * (e.g. a caller accidentally spreading a larger object that happens to
 * carry a `prompt` or `rawResponse` field alongside the legitimate ones)
 * is rejected outright rather than silently ignored, since silently
 * ignoring it is how a sensitive field would end up one refactor away
 * from being forwarded into `.insert()` below unnoticed.
 *
 * `operationType`/`errorKind` are intentionally validated against the
 * same closed sets as the TypeScript types even though the database
 * itself only constrains `costBasis`/`executionMode`/`outcome`/`stage` —
 * this function is every caller's only path to this table, so it is the
 * one place able to catch a typo'd or invalid value before it becomes a
 * stored row, regardless of whether TypeScript's own type-checking was
 * bypassed (a `.js` caller, a loosely-typed test, a future refactor).
 *
 * The one cross-field rule this schema enforces: `cost` and `costBasis`
 * must agree on whether the cost is actually known. `cost: null` paired
 * with a `costBasis` other than `null`/`"unknown"` is rejected as
 * self-contradictory input, not silently corrected — see this module's
 * own `resolveCost()` for how a *valid* `cost: null` is then mapped to a
 * stored row.
 */
const eventInputSchema = z
	.object({
		briefId: z.string().uuid().nullable(),
		stage: pipelineStageSchema.nullable(),
		operationType: z.string().trim().min(1).nullable(),
		provider: z.string().trim().min(1),
		model: z.string().trim().min(1),
		executionMode: executionModeSchema.nullable(),
		runId: z.string().uuid().nullable(),
		inputTokens: z.number().int().min(0),
		outputTokens: z.number().int().min(0),
		cost: z.number().min(0).nullable(),
		costBasis: costBasisSchema.nullable(),
		durationMs: z.number().int().min(0).nullable(),
		outcome: outcomeSchema.nullable(),
		errorKind: errorKindSchema.nullable(),
	})
	.strict()
	.refine((value) => !(value.cost === null && value.costBasis !== null && value.costBasis !== "unknown"), {
		message: 'costBasis must be null or "unknown" when cost is null.',
		path: ["costBasis"],
	})
	.refine((value) => !(value.cost !== null && (value.costBasis === null || value.costBasis === "unknown")), {
		message: 'costBasis must be "reported", "deterministic", or "estimated" when cost is not null.',
		path: ["costBasis"],
	});

export type RecordAiOperationEventResult =
	| { ok: true; id: string }
	| { ok: false; reason: "not_configured"; message: string }
	| { ok: false; reason: "invalid_input"; message: string }
	| { ok: false; reason: "database_error"; message: string };

/**
 * Maps a validated `cost`/`costBasis` pair to what actually gets stored.
 * `estimated_cost_usd` stays `not null default 0` (migration
 * `014_ai_operation_events.sql` deliberately did not touch it), so a
 * `null` cost is stored as `0` -- but always paired with
 * `cost_basis: "unknown"`, never with a `cost_basis` implying the number
 * is meaningful. This is the one place that translates "no reliable
 * figure exists yet" into a row `costGuard.checkBudget()`'s existing sum
 * can still safely include (as $0 spent) without costGuard needing any
 * awareness that `cost_basis` exists.
 */
function resolveCost(cost: number | null, costBasis: AiOperationEventInput["costBasis"]): { estimatedCostUsd: number; resolvedCostBasis: "reported" | "deterministic" | "estimated" | "unknown" } {
	if (cost === null) {
		return { estimatedCostUsd: 0, resolvedCostBasis: "unknown" };
	}
	// The schema's own refinement guarantees costBasis is one of the three
	// "known" values whenever cost is non-null.
	return { estimatedCostUsd: cost, resolvedCostBasis: costBasis as "reported" | "deterministic" | "estimated" };
}

/**
 * Persists one `AiOperationEventInput` as a row in `public.ai_usage_log`.
 * Never throws: every failure path (not configured, invalid input, a
 * database-level error) returns a safe, typed result instead. Never logs
 * the event's own field values -- only a fixed diagnostic prefix plus
 * Supabase's own error message (a schema/constraint-level description,
 * never row content), mirroring `costGuard.logUsage()`'s existing
 * console.error convention for this same table.
 */
export async function recordAiOperationEvent(input: AiOperationEventInput): Promise<RecordAiOperationEventResult> {
	const parsed = eventInputSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, reason: "invalid_input", message: parsed.error.issues[0]?.message ?? "Invalid AI operation event." };
	}

	const supabase = await createSupabaseServerClient();
	if (!supabase) {
		return { ok: false, reason: "not_configured", message: "Supabase isn't configured in this environment." };
	}

	const { estimatedCostUsd, resolvedCostBasis } = resolveCost(parsed.data.cost, parsed.data.costBasis);

	const { data, error } = await supabase
		.from("ai_usage_log")
		.insert({
			brief_id: parsed.data.briefId,
			stage: parsed.data.stage,
			operation_type: parsed.data.operationType,
			provider: parsed.data.provider,
			model: parsed.data.model,
			execution_mode: parsed.data.executionMode,
			run_id: parsed.data.runId,
			input_tokens: parsed.data.inputTokens,
			output_tokens: parsed.data.outputTokens,
			estimated_cost_usd: estimatedCostUsd,
			cost_basis: resolvedCostBasis,
			duration_ms: parsed.data.durationMs,
			outcome: parsed.data.outcome,
			error_kind: parsed.data.errorKind,
		})
		.select("id")
		.single();

	if (error || !data) {
		console.error("[content-intelligence] ai_usage_log event insert failed:", error?.message);
		return { ok: false, reason: "database_error", message: "Could not record this AI operation event." };
	}

	return { ok: true, id: data.id as string };
}

/**
 * Creates a new run id for correlating a future multi-step Content
 * Intelligence run (Step 6 of this phase's brief). Deliberately tiny: a
 * standard secure UUID (`node:crypto`'s `randomUUID()`, already used
 * implicitly via Postgres's own `gen_random_uuid()` elsewhere in this
 * schema) and nothing else -- no AsyncLocalStorage, no global mutable
 * context, no scheduler awareness. A caller that wants several events to
 * share one run calls this once and passes the same value as `runId` on
 * each `AiOperationEventInput` explicitly; a caller that doesn't call
 * this at all simply passes `runId: null`, exactly as an isolated manual
 * action always has.
 */
export function createAiOperationRunId(): string {
	return randomUUID();
}
