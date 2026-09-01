-- Code Consulting Studio — AI editorial workflow
--
-- Stores the internal state of the AI-assisted editorial pipeline:
-- brief, research, generation, localisation and quality review.
--
-- Nothing in this migration publishes content automatically.
-- Final articles are created separately and remain subject to
-- human editorial review before publication.


-- ============================================================
-- 1. Content briefs
-- ============================================================
--
-- One brief represents one editorial pipeline run.
--
-- A brief can start from a search opportunity or be created
-- manually by an editor.

create table if not exists public.content_briefs (
  id uuid primary key default gen_random_uuid(),

  opportunity_id uuid
    references public.content_opportunities (id)
    on delete set null,

  primary_locale text not null
    check (primary_locale in ('en', 'pl')),

  category_id uuid not null
    references public.insights_categories (id),

  topic text not null
    check (char_length(topic) between 3 and 200),

  key_points text,

  -- Tracks the current stage of the editorial pipeline.

  status text not null default 'draft'
    check (
      status in (
        'draft',

        'researching',
        'researched',

        'generating',
        'generated',

        'localising',
        'localised',

        'quality_check',
        'quality_passed',
        'quality_failed',

        'promoted',

        'failed'
      )
    ),

  research_notes text,

  generated_title text,
  generated_excerpt text,
  generated_slug text,

  -- Structured article blocks produced by the generation stage.
  -- They remain here until the brief is promoted into real
  -- Insights articles.

  generated_body jsonb,

  localized_locale text
    check (
      localized_locale is null
      or localized_locale in ('en', 'pl')
    ),

  localized_title text,
  localized_excerpt text,
  localized_slug text,
  localized_body jsonb,

  -- Stores quality-gate issues.
  -- An empty array means no issues were reported.

  quality_issues jsonb not null default '[]'::jsonb,

  error_message text,

  -- Filled after successful promotion.
  -- These point to the actual Insights article records created
  -- from this brief.

  primary_article_id uuid
    references public.insights_articles (id)
    on delete set null,

  localized_article_id uuid
    references public.insights_articles (id)
    on delete set null,

  created_by uuid
    references public.profiles (id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- Helps the admin/editorial interface retrieve briefs by workflow state.

create index if not exists content_briefs_status_idx
  on public.content_briefs (status);


-- ============================================================
-- updated_at trigger
-- ============================================================

drop trigger if exists content_briefs_set_updated_at
  on public.content_briefs;

create trigger content_briefs_set_updated_at
  before update
  on public.content_briefs
  for each row
  execute function public.set_updated_at();


-- ============================================================
-- Content briefs RLS
-- ============================================================

alter table public.content_briefs
  enable row level security;


-- Only active editors/admins can view editorial pipeline data.

create policy "content_briefs: editor select"
  on public.content_briefs
  for select
  to authenticated
  using (public.is_active_editor_or_admin());


-- Only active editors/admins can create or modify briefs.

create policy "content_briefs: editor write"
  on public.content_briefs
  for all
  to authenticated
  using (public.is_active_editor_or_admin())
  with check (public.is_active_editor_or_admin());


-- ============================================================
-- 2. AI usage log
-- ============================================================
--
-- Records every billable AI operation used by the editorial pipeline.
--
-- This provides cost tracking and lets the application enforce
-- its configured monthly AI budget.

create table if not exists public.ai_usage_log (
  id uuid primary key default gen_random_uuid(),

  brief_id uuid
    references public.content_briefs (id)
    on delete set null,

  stage text not null
    check (
      stage in (
        'research',
        'generation',
        'localisation'
      )
    ),

  provider text not null,
  model text not null,

  input_tokens int not null default 0
    check (input_tokens >= 0),

  output_tokens int not null default 0
    check (output_tokens >= 0),

  estimated_cost_usd numeric(10, 4) not null default 0
    check (estimated_cost_usd >= 0),

  created_at timestamptz not null default now()
);


-- Monthly budget checks and admin reporting normally query
-- the most recent usage first.

create index if not exists ai_usage_log_created_at_idx
  on public.ai_usage_log (created_at desc);


-- ============================================================
-- AI usage RLS
-- ============================================================

alter table public.ai_usage_log
  enable row level security;


-- Editors/admins can inspect AI usage and cost information.

create policy "ai_usage_log: editor select"
  on public.ai_usage_log
  for select
  to authenticated
  using (public.is_active_editor_or_admin());


-- AI usage rows can be recorded through an authenticated
-- editor/admin workflow.

create policy "ai_usage_log: editor insert"
  on public.ai_usage_log
  for insert
  to authenticated
  with check (public.is_active_editor_or_admin());


-- ============================================================
-- 3. Data API privileges
-- ============================================================
--
-- Automatic table exposure is disabled in this Supabase project,
-- so privileges are granted explicitly.
--
-- There is intentionally no access for anon users.


-- ------------------------------------------------------------
-- Content briefs
-- ------------------------------------------------------------

grant select, insert, update, delete
  on table public.content_briefs
  to authenticated;

grant all
  on table public.content_briefs
  to service_role;


-- ------------------------------------------------------------
-- AI usage log
-- ------------------------------------------------------------

grant select, insert
  on table public.ai_usage_log
  to authenticated;

grant all
  on table public.ai_usage_log
  to service_role;