import type { PipelineStage } from "./contentAi";

/**
 * Phase 3C.4C.1 — provider-neutral AI operation event foundation.
 *
 * This type models one AI operation event as it will eventually be
 * persisted into `public.ai_usage_log` (migration
 * `014_ai_operation_events.sql`). It is deliberately provider-neutral:
 * today's only real callers are the Anthropic text pipeline
 * (research/generation/localisation/ai_visibility) and, from Phase
 * 3C.4C.3 onward, OpenAI image generation, but nothing here names either
 * provider or hardcodes a text-shaped or image-shaped set of required
 * fields. An operation that has no tokens (e.g. image generation) simply
 * supplies `inputTokens: 0, outputTokens: 0` rather than omitting them —
 * see `AiOperationEventInput`'s own field comments for why zero and
 * "unknown" must stay distinguishable.
 *
 * Nothing in this file is wired into any existing call site yet. Phase
 * 3C.4C.2 (text-provider instrumentation) and 3C.4C.3 (image-provider
 * instrumentation) are what will eventually construct values of this
 * shape and pass them to the event writer
 * (`../events/aiOperationEventWriter.ts`).
 *
 * Operational metadata only — this type, and everything downstream of
 * it, must never carry a prompt, article body, research payload,
 * generated text, generated image bytes/base64, a raw provider response,
 * an API key/credential, or raw exception/stack-trace text. See this
 * phase's own security/privacy boundary (Phase 3C.4C audit, §7) for why.
 */

/** Whether an operation was triggered by a human (`manual`) or a future
 * automated scheduler/orchestrator (`automated`). Always supplied
 * explicitly by the caller that knows which one it is — never inferred
 * here or anywhere downstream from a route name, session presence, time
 * of day, provider, or article status (Step 7 of this phase's brief). */
export type AiOperationExecutionMode = "manual" | "automated";

/** Whether the operation this event describes ultimately succeeded or
 * failed. `null` is a legitimate value for an event whose outcome isn't
 * (yet) known to the caller — it is not the writer's job to guess. */
export type AiOperationOutcome = "success" | "failure";

/**
 * Safe, machine-readable failure classification only — never a raw
 * exception message, HTTP body, or stack trace. Deliberately a plain
 * TypeScript union (enforced at this layer), not a database CHECK
 * constraint — mirrors `operation_type`'s own reasoning in migration
 * `014_ai_operation_events.sql`: a new failure kind should be addable
 * without a migration. The values below are a superset of every failure
 * vocabulary already in this codebase (`StageResult`'s kinds in
 * `contentAi.ts`, `GenerateArticleVisualResult`'s kinds in
 * `ArticleVisualProvider.ts`, plus `timeout`/`network`, which neither
 * existing vocabulary distinguishes from the others today).
 */
export type AiOperationErrorKind =
	| "auth"
	| "not_found"
	| "not_configured"
	| "budget_exceeded"
	| "timeout"
	| "network"
	| "provider_error"
	| "invalid_response"
	| "validation"
	| "persistence"
	| "storage_error"
	| "unknown";

/**
 * How `cost` (below) was determined. This is the disambiguator between a
 * genuine $0.00 and a cost nobody has computed yet — see
 * `AiOperationEventInput.cost`'s own comment and migration
 * `014_ai_operation_events.sql`'s `cost_basis` column comment for the
 * full reasoning. Kept as a small, closed, DB-checked enum (unlike
 * `operation_type`/`error_kind`) because — like `PipelineStage` — it
 * describes a stable, small concept unlikely to grow.
 */
export type AiOperationCostBasis = "reported" | "deterministic" | "estimated" | "unknown";

/**
 * The input to the event writer — everything needed to persist one row,
 * before any database-specific mapping (e.g. `cost: null` → a stored
 * `estimated_cost_usd` of `0` plus `costBasis: "unknown"`) is applied.
 *
 * Every field is either required because `ai_usage_log` already requires
 * it (`provider`, `model`, `inputTokens`, `outputTokens`), or explicitly
 * nullable because it genuinely may not be known or applicable to every
 * operation (everything else). Nothing is optional-and-omittable: a
 * caller must make an explicit choice (including an explicit `null`) for
 * every field, so a future operation can never silently end up with an
 * accidentally-omitted value it should have set.
 */
export type AiOperationEventInput = {
	/** Existing FK to `content_briefs`. `null` for operations with no
	 * associated brief (e.g. an isolated AI-visibility check today, or a
	 * future operation that never has one). */
	briefId: string | null;

	/** The existing, closed 4-value `PipelineStage` column. `null` for any
	 * operation outside that closed set (e.g. image generation) — see
	 * migration `014_ai_operation_events.sql`'s note on relaxing this
	 * column's `not null` constraint for exactly this reason. A text-
	 * pipeline caller should keep supplying its real stage here, exactly
	 * as `costGuard.logUsage()` does today. */
	stage: PipelineStage | null;

	/** Provider-neutral logical operation name — e.g. `"research"`,
	 * `"generation"`, `"localisation"`, `"ai_visibility"`,
	 * `"article_visual_generation"`, or any future operation. Deliberately
	 * a plain string, not a closed union, matching the corresponding
	 * database column's own reasoning (no migration required to add a new
	 * operation). `null` is accepted but discouraged for any real,
	 * instrumented operation — future call sites (3C.4C.2/.3) are expected
	 * to always supply one. */
	operationType: string | null;

	/** e.g. `"anthropic"`, `"openai"` — matches `ContentAiProvider.id` /
	 * `ArticleVisualProvider.id`'s existing plain-string convention (never
	 * a closed enum — see `ArticleVisualProvider.ts`'s own doc comment). */
	provider: string;

	/** e.g. `"claude-sonnet-4-6"`, `"gpt-image-2"`. */
	model: string;

	executionMode: AiOperationExecutionMode | null;

	/** Correlates this event with other events in the same logical run.
	 * `null` for an isolated operation that doesn't belong to a larger
	 * run — never fabricated just to have a value. See
	 * `createAiOperationRunId()` in `../events/aiOperationEventWriter.ts`
	 * for how a caller that does want one obtains it. */
	runId: string | null;

	/** Real, provider-reported token counts when the operation is
	 * token-priced (e.g. Anthropic's `usage.input_tokens`). `0` for an
	 * operation with no token concept at all (e.g. image generation) —
	 * `0` here means "not applicable", not "unknown"; `cost`/`costBasis`
	 * are the fields that carry the actual estimated/unknown-ness. */
	inputTokens: number;
	outputTokens: number;

	/** The cost figure to store, in USD, or `null` when no reliable figure
	 * exists yet. `null` is not silently written as a stored `0` without
	 * comment: the writer maps a `null` cost to a stored `0` (the
	 * database column stays `not null default 0` — see migration
	 * `014_ai_operation_events.sql`) but always pairs it with
	 * `costBasis: "unknown"` in that case, so a future reader can tell
	 * "genuinely free" apart from "not priced yet" by checking
	 * `costBasis`, never by checking whether the number is zero. */
	cost: number | null;

	/** Required whenever `cost` is non-null; the writer also requires it
	 * (or defaults it to `"unknown"`) whenever `cost` is `null`, per the
	 * `cost` field's own comment above. */
	costBasis: AiOperationCostBasis | null;

	/** Wall-clock duration of the underlying provider call, in
	 * milliseconds, when measured. `null` when not measured. Must be
	 * non-negative when present — enforced both by the database check
	 * constraint and, redundantly, by the writer itself (see
	 * `../events/aiOperationEventWriter.ts`), so a caller gets a safe
	 * failure result rather than a raw database constraint-violation
	 * error. */
	durationMs: number | null;

	outcome: AiOperationOutcome | null;

	/** Should be `null` whenever `outcome` is `"success"` or `null`, and
	 * should be set whenever `outcome` is `"failure"` — the writer does
	 * not enforce this pairing (a caller may legitimately know an
	 * operation failed without yet having classified why), but a future
	 * reader should treat `outcome: "failure", errorKind: null` as "failed,
	 * reason not classified" rather than as invalid data. */
	errorKind: AiOperationErrorKind | null;
};
