-- Code Consulting Studio — Market keyword intelligence (Phase 3B.1)
--
-- Stores EXTERNAL market-wide keyword demand data (e.g. Bing Webmaster's
-- GetKeywordStats), conceptually separate from search_performance_metrics
-- (which is OUR OWN site's search performance, from GetQueryStats and
-- Google Search Console). This migration does not touch
-- search_performance_metrics, content_opportunities, opportunity_score_history
-- or migration 008 in any way -- purely additive.
--
-- No automatic keyword discovery, scheduling or recommendation logic is
-- introduced here -- this is storage + a read layer for keywords supplied
-- explicitly by a caller (see market/fetchMarketKeywordStats.ts).


-- ============================================================
-- 1. Market keywords (identity)
-- ============================================================
--
-- One row per (provider, keyword, country, language) -- the "we track
-- this keyword in this market via this provider" registration. Upserted
-- by its natural key (INSERT ... ON CONFLICT DO UPDATE, since re-fetching
-- an already-known keyword is expected and should not fail); the RLS
-- policies and grants below include UPDATE for exactly this reason --
-- Postgres requires UPDATE privilege for the ON CONFLICT DO UPDATE path
-- unconditionally, not only when a row actually conflicts.
--
-- provider is deliberately an UNCONSTRAINED text column -- not
-- `check (provider in ('bing'))`. The purpose of this layer is to
-- support future market-intelligence providers (e.g. Google Trends)
-- without a schema migration merely to recognise a new provider name.
-- Provider identifiers are validated/controlled in the TypeScript
-- provider layer instead (see market/types.ts's MarketIntelligenceProviderId).
--
-- country/language ARE constrained, but not independently: this phase
-- explicitly supports only two (country, language) PAIRS -- UK
-- (gb, en-GB) and Poland (pl, pl-PL) -- via the single cross-field
-- check constraint below, not two separate per-column check
-- constraints (which would still permit a mismatched pairing; see that
-- constraint's own comment). country/language are explicit inputs the
-- caller must supply, never inferred from the keyword text. Adding a
-- market later is a small additive migration widening that one
-- constraint, not schema surgery.

create table if not exists public.market_keywords (
  id uuid primary key default gen_random_uuid(),

  provider text not null,

  keyword text not null,

  country text not null,

  language text not null,

  created_at timestamptz not null default now(),

  unique (provider, keyword, country, language),

  -- One cross-field constraint representing every supported
  -- (country, language) pair, rather than two independent
  -- `check (country in (...))` / `check (language in (...))`
  -- constraints -- independent constraints would still let
  -- ('gb', 'pl-PL') or ('pl', 'en-GB') through, since each column
  -- would individually satisfy its own list. This mirrors the
  -- TypeScript side's MarketCode discriminated union (market/types.ts),
  -- which makes the same mismatched pairing unrepresentable at the
  -- type level. Adding a market later means adding a row to this OR
  -- list here and a member to that union there -- both small,
  -- deliberate changes, never automatic inference.
  check (
    (country = 'gb' and language = 'en-GB')
    or (country = 'pl' and language = 'pl-PL')
  )
);


-- ============================================================
-- 2. Market keyword observations (append-only history)
-- ============================================================
--
-- One row per fetch outcome for a market_keywords row: either a real
-- weekly (or, for a future provider, whatever period it reports)
-- observation, or an explicit no_data marker.
--
-- status = 'no_data' means the provider was queried successfully and
-- reported nothing for this keyword/market (Bing's own documented
-- example: {"d": []}) -- it is NEVER used to represent a real
-- zero-impression observation, and a provider REQUEST FAILURE (bad HTTP
-- status, malformed response, unparseable date) is not represented here
-- at all -- that is surfaced by fetchMarketKeywordStats.ts as a
-- provider_error and nothing is written from that call.
--
-- period_start/impressions/broad_impressions are all nullable at the
-- column level, but the compound check constraint below pins their
-- nullability to `status` in both directions: an 'observed' row MUST
-- have period_start and impressions set (never null), and a 'no_data'
-- row MUST have all three columns null. Neither state can drift into
-- the other's shape.
--
-- broad_impressions is an explicit, nullable, Bing-specific column --
-- not a jsonb blob -- matching content_opportunities' own
-- google_impressions/bing_impressions precedent (008's comment: "matches
-- every other table in this schema ... needs no runtime shape-parsing").
-- A future provider without an equivalent concept simply always has
-- broad_impressions = null.
--
-- 'observed' rows upsert idempotently on (market_keyword_id,
-- period_start) -- re-fetching an already-seen period refreshes it
-- rather than duplicating (hence this table also needs UPDATE in its
-- policies/grants, same reasoning as market_keywords above). 'no_data'
-- rows are always a plain INSERT, never upserted: period_start is NULL
-- for every no_data row, and Postgres never treats two NULLs as
-- conflicting in a unique index, so repeated no_data fetches for the
-- same keyword legitimately append multiple rows. Phase 3B.1
-- deliberately keeps this simple -- see the architecture report: no
-- deduplication complexity yet for no_data rows.

create table if not exists public.market_keyword_observations (
  id uuid primary key default gen_random_uuid(),

  market_keyword_id uuid not null
    references public.market_keywords (id)
    on delete cascade,

  status text not null
    check (status in ('observed', 'no_data')),

  period_start date,

  impressions int,

  broad_impressions int,

  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  -- Ties every nullable column's presence/absence to `status`, in both
  -- directions -- not just "observed requires period_start" (the
  -- original, weaker version of this constraint) but also "no_data
  -- requires every data column to actually be null". This is the same
  -- invariant TypeScript's MarketKeywordObservation discriminated union
  -- enforces at compile time (market/types.ts): an 'observed' row
  -- cannot be missing its period/impressions, and a 'no_data' row
  -- cannot smuggle in a stray data value.
  check (
    (status = 'observed' and period_start is not null and impressions is not null)
    or (status = 'no_data' and period_start is null and impressions is null and broad_impressions is null)
  ),

  -- A real observed row with impressions = 0 must remain valid (0 is
  -- not "no data" -- see the module-level comment above); only
  -- genuinely negative values are rejected.
  check (impressions is null or impressions >= 0),
  check (broad_impressions is null or broad_impressions >= 0)
);


-- Idempotent-upsert target for real weekly/period data. Relies on
-- Postgres's NULL-is-never-equal-to-NULL unique-index semantics to let
-- an unlimited number of no_data rows (period_start = null) coexist
-- without needing a partial index.

create unique index if not exists market_keyword_observations_period_uidx
  on public.market_keyword_observations (market_keyword_id, period_start);


-- Supports "full history for this keyword, newest fetch first" reads.

create index if not exists market_keyword_observations_lookup_idx
  on public.market_keyword_observations (market_keyword_id, fetched_at desc);


-- ============================================================
-- Market intelligence RLS
-- ============================================================
--
-- Both tables are upserted (see the comments above on why UPDATE is
-- required, not just INSERT), so unlike opportunity_score_history's
-- select+insert-only policy set, both tables here get select + insert +
-- update policies. Neither gets a delete policy -- nothing in this
-- phase ever deletes a row; deletion is not part of this design.

alter table public.market_keywords
  enable row level security;

create policy "market_keywords: editor select"
  on public.market_keywords
  for select
  to authenticated
  using (public.is_active_editor_or_admin());

create policy "market_keywords: editor insert"
  on public.market_keywords
  for insert
  to authenticated
  with check (public.is_active_editor_or_admin());

create policy "market_keywords: editor update"
  on public.market_keywords
  for update
  to authenticated
  using (public.is_active_editor_or_admin())
  with check (public.is_active_editor_or_admin());

alter table public.market_keyword_observations
  enable row level security;

create policy "market_keyword_observations: editor select"
  on public.market_keyword_observations
  for select
  to authenticated
  using (public.is_active_editor_or_admin());

create policy "market_keyword_observations: editor insert"
  on public.market_keyword_observations
  for insert
  to authenticated
  with check (public.is_active_editor_or_admin());

create policy "market_keyword_observations: editor update"
  on public.market_keyword_observations
  for update
  to authenticated
  using (public.is_active_editor_or_admin())
  with check (public.is_active_editor_or_admin());


-- ============================================================
-- Data API privileges
-- ============================================================
--
-- Automatic table exposure is disabled in this Supabase project, so
-- privileges are granted explicitly. UPDATE is included for both tables
-- for the same upsert reason as the RLS policies above -- this is wider
-- than 008's select+insert-only opportunity_score_history grant because
-- these tables are genuinely upserted, not purely append-only. No
-- privileges for anon users, and no delete privilege for either table.

grant select, insert, update
  on table public.market_keywords
  to authenticated;

grant all
  on table public.market_keywords
  to service_role;

grant select, insert, update
  on table public.market_keyword_observations
  to authenticated;

grant all
  on table public.market_keyword_observations
  to service_role;
