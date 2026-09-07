-- Code Consulting Studio — Opportunity source attribution + history
--
-- Phase 1: lets a content opportunity retain how much of its impressions
-- and clicks came from Google vs. Bing, instead of losing that
-- distinction at aggregation (recompute.ts used to sum every source's
-- rows into one number with no way to tell them apart afterwards).
--
-- Phase 2: adds an append-only log of how an opportunity's score and
-- underlying metrics changed over time. content_opportunities itself
-- stays a current-state table (unchanged in that respect) -- this is
-- purely additive, non-destructive, and does not touch
-- search_performance_metrics, content_briefs or any existing column.


-- ============================================================
-- 1. Source attribution
-- ============================================================
--
-- google_impressions/google_clicks and bing_impressions/bing_clicks are
-- explicit typed columns rather than a jsonb blob -- this matches every
-- other table in this schema (fixed, known set of numeric fields), keeps
-- Supabase/PostgREST filtering and sorting (e.g. "Bing-only
-- opportunities") a plain WHERE clause instead of jsonb ->> casts, and
-- needs no runtime shape-parsing on the TypeScript side. Whether an
-- opportunity is Google-only / Bing-only / both is derived from these
-- four columns in the application layer (google_impressions > 0,
-- bing_impressions > 0), not persisted, so
-- there is no redundant "primary_source" column that could drift from
-- the real numbers. CTR is likewise derived (clicks / impressions), not
-- stored.

alter table public.content_opportunities
  add column if not exists google_impressions int not null default 0,
  add column if not exists google_clicks int not null default 0,
  add column if not exists bing_impressions int not null default 0,
  add column if not exists bing_clicks int not null default 0;


-- ============================================================
-- 2. Opportunity score history
-- ============================================================
--
-- Append-only snapshot log. A row is inserted only when an opportunity
-- is brand new, or when its score/metrics actually changed since the
-- last recompute -- content_opportunities.updated_at (already
-- maintained by its own set_updated_at trigger on every upsert,
-- regardless of whether values changed) already answers "when was this
-- last recomputed", so history does not need to double as that log and
-- is free to record only real changes rather than one row per no-op
-- recompute.
--
-- recommended_action is deliberately NOT included yet -- the
-- recommendation engine this would come from does not exist in this
-- phase (a later phase's job).

create table if not exists public.opportunity_score_history (
  id uuid primary key default gen_random_uuid(),

  opportunity_id uuid not null
    references public.content_opportunities (id)
    on delete cascade,

  opportunity_score numeric(8, 2) not null,

  total_impressions int not null default 0,
  total_clicks int not null default 0,
  avg_position numeric(6, 2),

  google_impressions int not null default 0,
  google_clicks int not null default 0,
  bing_impressions int not null default 0,
  bing_clicks int not null default 0,

  computed_at timestamptz not null default now()
);


-- Supports "latest N snapshots for this opportunity" reads.

create index if not exists opportunity_score_history_opportunity_id_idx
  on public.opportunity_score_history (opportunity_id, computed_at desc);


-- ============================================================
-- Opportunity score history RLS
-- ============================================================
--
-- Append-only by design -- mirrors scoring_calibration's policy set
-- exactly (the closest existing precedent: another per-computation-run,
-- insert-only history table). No update/delete policy is added.

alter table public.opportunity_score_history
  enable row level security;

create policy "opportunity_score_history: editor select"
  on public.opportunity_score_history
  for select
  to authenticated
  using (public.is_active_editor_or_admin());

create policy "opportunity_score_history: editor insert"
  on public.opportunity_score_history
  for insert
  to authenticated
  with check (public.is_active_editor_or_admin());


-- ============================================================
-- 3. Data API privileges
-- ============================================================
--
-- Automatic table exposure is disabled in this Supabase project, so
-- privileges are granted explicitly. No privileges for anon users.

grant select, insert
  on table public.opportunity_score_history
  to authenticated;

grant all
  on table public.opportunity_score_history
  to service_role;
