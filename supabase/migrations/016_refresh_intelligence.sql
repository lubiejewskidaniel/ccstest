-- Code Consulting Studio — Refresh intelligence feedback loop, Phase 1
--
-- Lets a refresh of an existing article be measured: a bounded baseline
-- window before the refresh, and later the same-length window after it.
-- Reproducible regardless of when the "after" measurement is taken, which
-- the existing insights_top_articles/insights_cta_click_counts RPCs
-- can't do on their own (they only ever measure "the last N days from
-- now"). Both RPCs are extended with an optional explicit start/end
-- bound rather than duplicated, so every existing caller (the
-- performance page, staleness detection, calibration) keeps its current
-- trailing-window behaviour unchanged when it doesn't pass one.
--
-- This does not touch scoring_calibration, content_opportunities or
-- recomputeOpportunities() — refresh outcomes are measurement/evidence
-- only in this phase.


-- ============================================================
-- 1. Bounded windows for the existing analytics RPCs
-- ============================================================
--
-- Adding parameters to a PostgreSQL function does not replace the old
-- signature -- (days_back, result_limit) and (days_back, result_limit,
-- start_at, end_at) are two distinct, independently-grantable overloads.
-- Left alone, that's exactly the "ambiguous/unnecessary overload" state
-- we don't want: the original 004 functions would keep existing, keep
-- their own grants, and be independently callable. The old signatures
-- are dropped explicitly first so there is one callable version of each
-- function afterwards, not two.

drop function if exists public.insights_top_articles(int, int);
drop function if exists public.insights_cta_click_counts(int);

create or replace function public.insights_top_articles(
  days_back int default 30,
  result_limit int default 10,
  start_at timestamptz default null,
  end_at timestamptz default null
)
returns table (
  slug text,
  locale text,
  view_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  safe_days_back int;
  safe_result_limit int;
begin

  if not public.is_active_editor_or_admin() then
    raise exception 'not authorized';
  end if;

  safe_days_back := greatest(1, least(days_back, 3650));
  safe_result_limit := greatest(1, least(result_limit, 100));

  -- start_at/end_at null (the default) reproduces migration 004's
  -- original query exactly -- same lower bound, no upper bound at all.
  return query
    select
      ae.properties->>'slug' as slug,
      ae.properties->>'locale' as locale,
      count(*) as view_count
    from public.analytics_events ae
    where ae.name = 'article_view'
      and ae.properties->>'slug' is not null
      and ae.occurred_at >= coalesce(start_at, now() - make_interval(days => safe_days_back))
      and (end_at is null or ae.occurred_at < end_at)
    group by
      ae.properties->>'slug',
      ae.properties->>'locale'
    order by view_count desc
    limit safe_result_limit;

end;
$$;

revoke all
  on function public.insights_top_articles(int, int, timestamptz, timestamptz)
  from public;

grant execute
  on function public.insights_top_articles(int, int, timestamptz, timestamptz)
  to authenticated;

grant execute
  on function public.insights_top_articles(int, int, timestamptz, timestamptz)
  to service_role;


create or replace function public.insights_cta_click_counts(
  days_back int default 30,
  start_at timestamptz default null,
  end_at timestamptz default null
)
returns table (
  slug text,
  cta_location text,
  click_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  safe_days_back int;
begin

  if not public.is_active_editor_or_admin() then
    raise exception 'not authorized';
  end if;

  safe_days_back := greatest(1, least(days_back, 3650));

  return query
    select
      ae.properties->>'slug' as slug,
      ae.properties->>'cta_location' as cta_location,
      count(*) as click_count
    from public.analytics_events ae
    where ae.name = 'article_cta_click'
      and ae.properties->>'slug' is not null
      and ae.occurred_at >= coalesce(start_at, now() - make_interval(days => safe_days_back))
      and (end_at is null or ae.occurred_at < end_at)
    group by
      ae.properties->>'slug',
      ae.properties->>'cta_location'
    order by click_count desc;

end;
$$;

revoke all
  on function public.insights_cta_click_counts(int, timestamptz, timestamptz)
  from public;

grant execute
  on function public.insights_cta_click_counts(int, timestamptz, timestamptz)
  to authenticated;

grant execute
  on function public.insights_cta_click_counts(int, timestamptz, timestamptz)
  to service_role;


-- ============================================================
-- 2. Refresh event log
-- ============================================================
--
-- One row per refresh episode. Inserted once, at the moment a human
-- saves an article from the refresh workflow, with a snapshotted
-- baseline. Updated exactly once later, when the episode is evaluated,
-- to fill in the after-window evidence and final status. No trigger
-- enforces that transition in Phase 1 -- the application is the only
-- writer and only ever performs that one update.

create table if not exists public.article_refresh_log (
  id uuid primary key default gen_random_uuid(),

  article_id uuid not null
    references public.insights_articles (id)
    on delete cascade,

  locale text not null
    check (locale in ('en', 'pl')),

  triggered_at timestamptz not null default now(),

  -- Server-derived staleness reasons at the moment of refresh -- never
  -- client-supplied text.
  reasons jsonb not null,

  article_updated_at_before timestamptz not null,

  baseline_window_days int not null
    check (baseline_window_days > 0),

  baseline_views int not null default 0,
  baseline_cta_clicks int not null default 0,
  baseline_search_impressions int not null default 0,
  baseline_search_clicks int not null default 0,
  baseline_avg_position numeric(6, 2),

  evaluation_window_days int,

  evaluation_status text not null default 'pending'
    check (
      evaluation_status in (
        'pending',
        'improved',
        'neutral',
        'declined',
        'insufficient_data'
      )
    ),

  evaluated_at timestamptz,

  after_views int,
  after_cta_clicks int,
  after_search_impressions int,
  after_search_clicks int,
  after_avg_position numeric(6, 2),

  created_by uuid
    references auth.users (id)
    on delete set null
);


create index if not exists article_refresh_log_article_id_idx
  on public.article_refresh_log (article_id, triggered_at desc);

-- At most one pending episode per article, enforced by the database, not
-- just the application's pre-check (which only closes the common case,
-- not a genuine race between two concurrent refresh-originated saves for
-- the same article). Also serves as the lookup index for that pre-check.
create unique index if not exists article_refresh_log_one_pending_idx
  on public.article_refresh_log (article_id)
  where evaluation_status = 'pending';


-- ============================================================
-- Refresh log RLS
-- ============================================================

alter table public.article_refresh_log
  enable row level security;

create policy "article_refresh_log: editor select"
  on public.article_refresh_log
  for select
  to authenticated
  using (public.is_active_editor_or_admin());

create policy "article_refresh_log: editor insert"
  on public.article_refresh_log
  for insert
  to authenticated
  with check (public.is_active_editor_or_admin());

-- Only for the one pending -> terminal evaluation transition.
create policy "article_refresh_log: editor update"
  on public.article_refresh_log
  for update
  to authenticated
  using (public.is_active_editor_or_admin())
  with check (public.is_active_editor_or_admin());


-- ============================================================
-- 3. Data API privileges
-- ============================================================

grant select, insert, update
  on table public.article_refresh_log
  to authenticated;

grant all
  on table public.article_refresh_log
  to service_role;
