-- Code Consulting Studio - AI operation event foundation (Phase 3C.4C.1)
--
-- Phase 3C.4C's read-only audit found that public.ai_usage_log already
-- tracks token-priced text operations (research/generation/localisation/
-- ai_visibility) but has no way to represent:
--
-- - which logical operation actually ran in a provider-neutral sense
-- - whether the request was triggered manually or by a future automated scheduler
-- - which events belong to one logical multi-step run
-- - whether the operation succeeded or failed
-- - how long it took
-- - a safe machine-readable failure classification
-- - whether the stored cost is reported, deterministic, estimated or unknown
--
-- This migration extends the existing usage log without dropping or
-- renaming any existing column.
--
-- The only existing-column constraint change is documented at the end
-- of this migration: stage is relaxed from NOT NULL to nullable so
-- non-text operations can be represented without false classification.
-- Its existing check constraint and current vocabulary remain unchanged.
--
-- estimated_cost_usd keeps its existing NOT NULL DEFAULT 0 contract, so
-- costGuard.ts's current checkBudget()/logUsage() continue to read and
-- write this table as before.
--
-- No historical row is backfilled or reclassified. Every new column is
-- nullable and remains NULL for rows that already exist because these
-- facts cannot be proven from the data currently stored on those rows.
--
-- No provider pricing, scheduler implementation, multi-tenancy or
-- costGuard concurrency fix is introduced in this phase.

-- ------------------------------------------------------------
-- operation_type
-- ------------------------------------------------------------
--
-- Provider-neutral logical operation name, for example:
--
-- research
-- generation
-- localisation
-- ai_visibility
-- article_visual_generation
--
-- Deliberately unconstrained at database level so future operation types
-- can be introduced without another schema migration.
--
-- Existing historical rows remain NULL.

alter table public.ai_usage_log
  add column if not exists operation_type text;

-- ------------------------------------------------------------
-- execution_mode
-- ------------------------------------------------------------
--
-- Identifies how the operation was triggered.
--
-- manual
-- automated
--
-- This value must be supplied explicitly by the caller. It must never be
-- inferred from the route, session, provider, article status or time.
--
-- Existing historical rows remain NULL.

alter table public.ai_usage_log
  add column if not exists execution_mode text
    check (
      execution_mode is null
      or execution_mode in ('manual', 'automated')
    );

-- ------------------------------------------------------------
-- run_id
-- ------------------------------------------------------------
--
-- Correlates several AI operation events that belong to one logical
-- Content Intelligence run.
--
-- Example future automated run:
--
-- research
-- generation
-- localisation
-- article_visual_generation
--
-- All may share the same run_id.
--
-- A single isolated manual action may leave run_id NULL.
-- No separate runs table is introduced in this phase.

alter table public.ai_usage_log
  add column if not exists run_id uuid;

-- ------------------------------------------------------------
-- outcome
-- ------------------------------------------------------------
--
-- Records whether the operation ultimately succeeded or failed.
--
-- Historical rows remain NULL because the outcome was not explicitly
-- stored on those rows.

alter table public.ai_usage_log
  add column if not exists outcome text
    check (
      outcome is null
      or outcome in ('success', 'failure')
    );

-- ------------------------------------------------------------
-- duration_ms
-- ------------------------------------------------------------
--
-- Wall-clock duration of the provider operation in milliseconds when it
-- is measured.
--
-- Historical rows remain NULL because existing code did not measure
-- provider duration.

alter table public.ai_usage_log
  add column if not exists duration_ms integer
    check (
      duration_ms is null
      or duration_ms >= 0
    );

-- ------------------------------------------------------------
-- error_kind
-- ------------------------------------------------------------
--
-- Safe machine-readable failure classification only.
--
-- Examples:
--
-- not_configured
-- timeout
-- network
-- provider_error
-- invalid_response
-- budget_exceeded
-- validation
-- persistence
-- storage_error
--
-- Never store a raw exception message or stack trace here.
--
-- Deliberately unconstrained at database level so new safe failure kinds
-- can be introduced without requiring a schema migration.
--
-- Historical rows remain NULL.

alter table public.ai_usage_log
  add column if not exists error_kind text;

-- ------------------------------------------------------------
-- cost_basis
-- ------------------------------------------------------------
--
-- Describes how estimated_cost_usd was determined.
--
-- reported
--   A provider returned an actual usable cost figure.
--
-- deterministic
--   The value can be calculated exactly from known fixed inputs.
--
-- estimated
--   A pricing estimate was applied, such as the current token-cost logic
--   used by costGuard.ts.
--
-- unknown
--   No reliable cost figure is currently available.
--
-- estimated_cost_usd itself remains unchanged:
--
--   NOT NULL DEFAULT 0
--
-- Therefore a future row may contain:
--
-- estimated_cost_usd = 0
-- cost_basis = 'unknown'
--
-- which means "cost not yet known", not "$0.00".
--
-- A genuine known zero-cost event may instead use:
--
-- estimated_cost_usd = 0
-- cost_basis = 'deterministic'
--
-- Historical rows remain NULL for cost_basis because the provenance of
-- their stored cost is not explicitly recorded in the existing rows.

alter table public.ai_usage_log
  add column if not exists cost_basis text
    check (
      cost_basis is null
      or cost_basis in (
        'reported',
        'deterministic',
        'estimated',
        'unknown'
      )
    );

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
--
-- The existing ai_usage_log_created_at_idx already supports time-window
-- queries.
--
-- operation_type supports future per-operation filtering/reporting.
--
-- run_id supports retrieving all events belonging to one logical
-- Content Intelligence run.
--
-- Partial indexes avoid indexing the historical NULL values.

create index if not exists ai_usage_log_operation_type_idx
  on public.ai_usage_log (operation_type)
  where operation_type is not null;

create index if not exists ai_usage_log_run_id_idx
  on public.ai_usage_log (run_id)
  where run_id is not null;

-- ------------------------------------------------------------
-- RLS / grants
-- ------------------------------------------------------------
--
-- No RLS policy or grant changes are required.
--
-- The existing policies and grants defined for ai_usage_log already
-- allow authenticated editors/admins to SELECT and INSERT rows and apply
-- equally to the new columns.
--
-- No anonymous write access is introduced.
-- No service-role-only application path is introduced.

-- ------------------------------------------------------------
-- stage - relax NOT NULL
-- ------------------------------------------------------------
--
-- Re-inspection of the original ai_usage_log schema showed that stage is
-- currently NOT NULL and constrained to the text-pipeline vocabulary:
--
-- research
-- generation
-- localisation
-- ai_visibility
--
-- That is correct for the existing text pipeline, but it cannot
-- represent genuinely different provider-neutral operations such as:
--
-- article_visual_generation
--
-- Assigning one of the existing stage values to such an event would
-- create false operational classification.
--
-- operation_type is now the provider-neutral event identity.
--
-- The smallest compatible change is therefore to allow stage to be NULL.
--
-- IMPORTANT:
--
-- - the existing stage CHECK constraint remains unchanged
-- - the existing four stage values remain unchanged
-- - every current costGuard.logUsage() caller still supplies a valid
--   non-null stage exactly as before
-- - no historical row is modified
-- - only future non-text events need to leave stage NULL

alter table public.ai_usage_log
  alter column stage drop not null;