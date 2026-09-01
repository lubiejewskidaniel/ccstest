-- Code Consulting Studio — Search intelligence
--
-- Stores search performance data from Google Search Console and Bing,
-- then turns that data into editorial opportunities for the Insights CMS.
--
-- These tables contain internal business data, so they are never exposed
-- publicly. Only active editors/admins can work with them.


-- ============================================================
-- 1. Search performance metrics
-- ============================================================
--
-- Stores raw search-performance rows from Google Search Console
-- and Bing Webmaster.
--
-- A row is unique per source, query, page and day.

create table if not exists public.search_performance_metrics (
  id uuid primary key default gen_random_uuid(),

  source text not null
    check (source in ('google', 'bing')),

  locale text
    check (
      locale is null
      or locale in ('en', 'pl')
    ),

  query text not null,

  -- Bing may return query-level data without a page URL.
  -- An empty string is used instead of NULL so the unique constraint
  -- remains reliable during repeated imports.

  page_url text not null default '',

  metric_date date not null,

  clicks int not null default 0,
  impressions int not null default 0,

  ctr numeric(6, 4) not null default 0,

  avg_position numeric(6, 2),

  ingested_at timestamptz not null default now(),

  unique (
    source,
    query,
    page_url,
    metric_date
  )
);


-- Helps planner/search queries find matching keywords quickly.

create index if not exists search_performance_metrics_query_idx
  on public.search_performance_metrics (query);


-- ============================================================
-- Search performance RLS
-- ============================================================

alter table public.search_performance_metrics
  enable row level security;


-- Active editors/admins can read imported search data.

create policy "search_performance_metrics: editor select"
  on public.search_performance_metrics
  for select
  to authenticated
  using (public.is_active_editor_or_admin());


-- Active editors/admins can import new metrics.

create policy "search_performance_metrics: editor insert"
  on public.search_performance_metrics
  for insert
  to authenticated
  with check (public.is_active_editor_or_admin());


-- Active editors/admins can update previously imported rows.

create policy "search_performance_metrics: editor update"
  on public.search_performance_metrics
  for update
  to authenticated
  using (public.is_active_editor_or_admin())
  with check (public.is_active_editor_or_admin());


-- ============================================================
-- 2. Content opportunities
-- ============================================================
--
-- Stores the latest editorial opportunities calculated from search data.
--
-- Unlike search_performance_metrics, this is not a historical log.
-- Each recomputation updates the current opportunity state.

create table if not exists public.content_opportunities (
  id uuid primary key default gen_random_uuid(),

  query text not null unique,

  locale text
    check (
      locale is null
      or locale in ('en', 'pl')
    ),

  total_clicks int not null default 0,
  total_impressions int not null default 0,

  avg_position numeric(6, 2),

  opportunity_score numeric(8, 2) not null default 0,

  status text not null default 'new'
    check (
      status in (
        'new',
        'reviewing',
        'briefed',
        'dismissed'
      )
    ),

  -- Links the opportunity to an existing article when the planner
  -- believes that article may already cover the query.

  matched_article_id uuid
    references public.insights_articles (id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- Keeps the highest-value opportunities fast to retrieve.

create index if not exists content_opportunities_score_idx
  on public.content_opportunities (opportunity_score desc);


-- ============================================================
-- updated_at trigger
-- ============================================================

drop trigger if exists content_opportunities_set_updated_at
  on public.content_opportunities;

create trigger content_opportunities_set_updated_at
  before update
  on public.content_opportunities
  for each row
  execute function public.set_updated_at();


-- ============================================================
-- Content opportunities RLS
-- ============================================================

alter table public.content_opportunities
  enable row level security;


create policy "content_opportunities: editor select"
  on public.content_opportunities
  for select
  to authenticated
  using (public.is_active_editor_or_admin());


create policy "content_opportunities: editor write"
  on public.content_opportunities
  for all
  to authenticated
  using (public.is_active_editor_or_admin())
  with check (public.is_active_editor_or_admin());


-- ============================================================
-- 3. Data API privileges
-- ============================================================
--
-- Automatic table exposure is disabled in this Supabase project,
-- so access is granted explicitly.
--
-- RLS still decides which rows authenticated users can read or change.


-- ------------------------------------------------------------
-- Search performance metrics
-- ------------------------------------------------------------

grant select, insert, update
  on table public.search_performance_metrics
  to authenticated;

grant all
  on table public.search_performance_metrics
  to service_role;


-- ------------------------------------------------------------
-- Content opportunities
-- ------------------------------------------------------------

grant select, insert, update, delete
  on table public.content_opportunities
  to authenticated;

grant all
  on table public.content_opportunities
  to service_role;