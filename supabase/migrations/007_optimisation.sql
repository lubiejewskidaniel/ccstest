-- Code Consulting Studio — Content Intelligence optimisation
--
-- Closes the feedback loop between search opportunities, published
-- articles and their later performance.
--
-- It also stores AI visibility checks and scoring calibration history.
-- All data in this migration is internal and is never exposed publicly.


-- ============================================================
-- 1. Opportunity → article feedback loop
-- ============================================================
--
-- resulting_article_id records which real Insights article was created
-- from an opportunity.
--
-- score_at_promotion keeps the score that existed at the moment the
-- opportunity was promoted, so later calibration can compare the original
-- prediction with the article's actual performance.

alter table public.content_opportunities
  add column if not exists resulting_article_id uuid
    references public.insights_articles (id)
    on delete set null,

  add column if not exists score_at_promotion numeric(8, 2);


-- ============================================================
-- 2. AI visibility checks
-- ============================================================
--
-- Stores results of controlled checks asking the configured AI provider
-- a representative query and recording whether CCS was mentioned.
--
-- This is an internal monitoring signal, not proof of visibility across
-- every AI search or assistant product.

create table if not exists public.ai_visibility_checks (
  id uuid primary key default gen_random_uuid(),

  query text not null,

  locale text
    check (
      locale is null
      or locale in ('en', 'pl')
    ),

  provider text not null,
  model text not null,

  mentioned boolean not null,

  snippet text,

  checked_at timestamptz not null default now()
);


create index if not exists ai_visibility_checks_checked_at_idx
  on public.ai_visibility_checks (checked_at desc);


-- ============================================================
-- AI visibility RLS
-- ============================================================

alter table public.ai_visibility_checks
  enable row level security;


-- Active editors/admins can inspect visibility checks.

create policy "ai_visibility_checks: editor select"
  on public.ai_visibility_checks
  for select
  to authenticated
  using (public.is_active_editor_or_admin());


-- Active editors/admins can record new checks.

create policy "ai_visibility_checks: editor insert"
  on public.ai_visibility_checks
  for insert
  to authenticated
  with check (public.is_active_editor_or_admin());


-- ============================================================
-- 3. Extend AI usage tracking
-- ============================================================
--
-- AI visibility checks use the same cost log as research, generation
-- and localisation so all AI spending remains in one place.

alter table public.ai_usage_log
  drop constraint if exists ai_usage_log_stage_check;

alter table public.ai_usage_log
  add constraint ai_usage_log_stage_check
  check (
    stage in (
      'research',
      'generation',
      'localisation',
      'ai_visibility'
    )
  );


-- ============================================================
-- 4. Scoring calibration
-- ============================================================
--
-- Each row records one calibration calculation.
--
-- History is append-only so changes in the scoring model remain
-- traceable instead of overwriting the previous result.

create table if not exists public.scoring_calibration (
  id uuid primary key default gen_random_uuid(),

  multiplier numeric(6, 3) not null default 1
    check (multiplier > 0),

  sample_size int not null default 0
    check (sample_size >= 0),

  computed_at timestamptz not null default now()
);


-- ============================================================
-- Scoring calibration RLS
-- ============================================================

alter table public.scoring_calibration
  enable row level security;


create policy "scoring_calibration: editor select"
  on public.scoring_calibration
  for select
  to authenticated
  using (public.is_active_editor_or_admin());


create policy "scoring_calibration: editor insert"
  on public.scoring_calibration
  for insert
  to authenticated
  with check (public.is_active_editor_or_admin());


-- ============================================================
-- 5. Data API privileges
-- ============================================================
--
-- Automatic table exposure is disabled for this Supabase project,
-- so access is granted explicitly.
--
-- No privileges are granted to anon users.


-- ------------------------------------------------------------
-- AI visibility checks
-- ------------------------------------------------------------

grant select, insert
  on table public.ai_visibility_checks
  to authenticated;

grant all
  on table public.ai_visibility_checks
  to service_role;


-- ------------------------------------------------------------
-- Scoring calibration
-- ------------------------------------------------------------

grant select, insert
  on table public.scoring_calibration
  to authenticated;

grant all
  on table public.scoring_calibration
  to service_role;