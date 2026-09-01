# CCS Web Platform — Build Log addendum (Insights Analytics, round 6 continued)

*(Same read-only-project-file situation — append after the Checkpoint 4
addendum.)*

## Status: Insights subsystem — Checkpoint 5 (Analytics foundation) complete

Continuing directly from Checkpoint 4 (SEO/discovery) in the same round.
Verified the same way: `ts.transpileModule` syntax pass across the full
`src/` tree (0 errors across 200 files) and a project-wide import-
resolution script (0 unresolved imports across the same 200 files).

### What this covered
- **Durable event log**: `supabase/migrations/004_analytics_events.sql`
  — an `analytics_events` table with zero RLS policies for anon/
  authenticated (writes via service-role only, reads via two new
  `SECURITY DEFINER` RPCs that check `is_active_editor_or_admin()`
  themselves). `src/app/api/v1/analytics/route.ts` now inserts into it
  instead of only `console.log`-ing — the "contained change inside this
  one file" its own prior-round comment anticipated.
- **Two events that existed in the taxonomy since Checkpoint 2 but were
  never actually fired are now wired up**: `article_read_progress`
  (`ReadProgressTracker`, scroll-depth based) and `article_cta_click`
  (`ArticleCtaLink`, wraps the article's bottom CTA). `category_view`/
  `tag_view` fire too, on their respective listing pages.
- **Admin performance view**: `/admin/insights/performance` — top
  articles by 30-day view count, CTA clicks by location, read through two
  new RPC wrapper functions in `cms/queries.ts`.
- **"Service transitions" and "lead attribution foundations"** (two of
  the five Checkpoint 5 checklist items) needed no new code — see
  `INSIGHTS_ARCHITECTURE.md` §12 for why: the former is reconstructable
  from existing events without a bespoke funnel table, the latter was
  already covered by the site-wide `AttributionCapture` component, which
  runs identically on every route.

### Explicitly deferred (documented, not overlooked)
Real charts/visualizations on the performance page (two plain tables for
now — the checkpoint's bar is "the data exists and is readable"). A
bespoke article→service referral/funnel table (reconstructable from the
existing event log by query, not worth building speculatively). Any
dashboard auto-refresh or date-range picker beyond a fixed 30-day window.

## Next session should
Read `docs/INSIGHTS_ARCHITECTURE.md` §12, then **Checkpoint 6 (Search
intelligence)** if continuing: Google Search Console / Bing ingestion,
keyword metrics, opportunity scoring, planner. This is the first
checkpoint that starts touching
`src/features/content-intelligence/**`, which has been deliberately
unscaffolded until now (`INSIGHTS_ARCHITECTURE.md` §7) — expect it to
need its own audit-style pass (what does GSC/Bing API access actually
look like, what credentials are needed) before implementation, not a
straight continuation of the CMS pattern.
