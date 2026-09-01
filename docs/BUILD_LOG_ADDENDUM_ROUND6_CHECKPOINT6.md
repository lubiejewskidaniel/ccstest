# CCS Web Platform — Build Log addendum (Search intelligence, round 6 continued)

*(Same read-only-project-file situation — append after the Checkpoint 5
addendum.)*

## Status: Insights subsystem — Checkpoint 6 (Search intelligence) complete

Continuing directly from Checkpoint 5 (Analytics foundation) in the same
round. This is the first checkpoint to touch `src/features/content-
intelligence/**`, which had been deliberately left unscaffolded since
`INSIGHTS_ARCHITECTURE.md` was written. Verified the same way as every
prior checkpoint this round: `ts.transpileModule` syntax pass across the
full `src/` tree (0 errors across 212 files) and a project-wide
import-resolution script (0 unresolved imports across the same 212
files).

### What this covered
- **New migration**: `supabase/migrations/005_search_intelligence.sql` —
  `search_performance_metrics` (raw ingested rows) and
  `content_opportunities` (aggregated, scored, one row per query),
  admin/editor-only RLS (no public policy at all — this is internal
  business data).
- **Two real provider integrations**: `content-intelligence/google/
  GoogleSearchConsoleProvider.ts` (service-account JWT, raw fetch) and
  `content-intelligence/bing/BingWebmasterProvider.ts` (API-key auth,
  `GetQueryStats`, verified against Bing's actual documented response
  shape rather than assumed). Both silent no-ops until their env vars
  are set — added to `.env.example`.
- **Opportunity scoring**: `opportunities/score.ts` (pure function) +
  `opportunities/recompute.ts` (aggregation, "already covered" article
  matching, persistence).
- **Planner**: `planner/queries.ts` (`listTopOpportunities`) +
  `opportunities/actions.ts` (status transitions) + the admin UI at
  `/admin/insights/opportunities` with manual "Refresh from Google/Bing"
  and "Recompute scores" buttons (no scheduler yet — Checkpoint 8).

### A real bug caught before packaging
The first draft of `search_performance_metrics.page_url` was nullable.
Postgres treats two `NULL`s as distinct for uniqueness purposes, so the
ingestion upsert's `ON CONFLICT (source, query, page_url, metric_date)`
would have silently inserted duplicate rows on every Bing re-ingestion
(Bing's API has no page dimension, so its rows always report
`page_url = null`) instead of updating existing ones. Fixed with an
empty-string sentinel (`not null default ''`) before packaging — a
concrete example of the "verify assumptions" behavior the master
instruction asks for, not something that would have been caught by the
syntax/import checks alone.

### Explicitly deferred (documented, not overlooked)
Content brief generation from a selected opportunity (Checkpoint 7's
"briefs" item — marking an opportunity "briefed" here is just a planning
bookmark, it creates nothing in `insights_articles`). A precise
page-URL-to-article ranking join for "already covered" detection (a
title/excerpt substring heuristic today). Any scheduled/automatic
ingestion (manual buttons only).

## Next session should
Read `docs/INSIGHTS_ARCHITECTURE.md` §13, then **Checkpoint 7 (AI
editorial)** if continuing — briefs, research, generation, localisation,
quality gate, draft preview, with human approval still required
(Decision 10/11). This is where an actual AI provider (Anthropic/OpenAI/
etc.) gets called for the first time in this subsystem; expect it to need
its own scoped design pass for prompt/response handling and cost controls
before implementation, same as Checkpoint 6 needed one for external API
auth.
