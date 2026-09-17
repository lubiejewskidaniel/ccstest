# Insights Subsystem — Architecture

Status: written before implementation, per master instruction §5.
Builds directly on the findings in `docs/INSIGHTS_AUDIT.md` — read that
first; this document doesn't repeat the "why" for decisions already
justified there.

Scope discipline: this document only defines modules with a concrete,
near-term responsibility. Folders from the master instruction's §6
diagram that have no Checkpoint 2/3/4 job yet (most of
`features/content-intelligence/**`) are named here as **future,
unallocated** and are not created as empty directories — see §7.

---

## 1. Conceptual model (confirmed against the real app)

```text
CCS WEBSITE  (existing, unmodified)
    │
    ├── Header / Footer / SiteChrome / MobileMenu / LanguageSwitch   (reused)
    ├── ThemeProvider (dark/light via data-theme + CSS vars)         (reused)
    ├── routes.ts (RouteKey → EN/PL path)                            (extended, not replaced)
    ├── analytics/events.ts + consent.ts                             (extended, not replaced)
    └── fonts.ts (Bricolage / Hanken / IBM Plex Mono)                (reused)
            │
            ▼
       INSIGHTS SYSTEM   (new: src/app/insights, src/app/pl/insights,
                           src/app/admin/insights, src/features/insights,
                           src/styles/insights)
            │
            ▼
        CONTENT DATABASE  (new Supabase tables, RLS, see INSIGHTS_DATABASE.md)
            ▲
            │
       CONTENT ENGINE   (src/features/content-intelligence/**,
                          see §7 and §14-18)
```

**Hard requirement carried from the master instruction (§2):** every page
under `/insights/**` and `/pl/insights/**` renders entirely from the
content database. Nothing in the render path imports from, calls, or
awaits any `content-intelligence` module. If that subsystem is ever
disabled, published Insights pages are unaffected. The only integration
point the Content Engine gets is *write* access to the same tables an
editor's CMS Server Action would write to — it never has a special
read/render path of its own.

---

## 2. Routing

| Path | Renders | Notes |
|---|---|---|
| `/insights` | Hub (EN) | Replaces legacy `InsightsPage` at cutover (see migration strategy in audit) |
| `/pl/wiedza` | Hub (PL) | **New file**, doesn't exist today |
| `/insights/[slug]` | Article (EN) | New dynamic segment |
| `/pl/wiedza/[slug]` | Article (PL) | New dynamic segment |
| `/insights/category/[slug]` | Category listing (EN) | New |
| `/pl/wiedza/kategoria/[slug]` | Category listing (PL) | New |
| `/insights/tag/[slug]` | Tag listing (EN) | New |
| `/pl/wiedza/tag/[slug]` | Tag listing (PL) | New |
| `/admin/insights` | CMS article list | Sits inside the existing `/admin` auth gate |
| `/admin/insights/new`, `/admin/insights/[id]/edit` | CMS editor | Same gate |

`routes.ts` is extended with one new `RouteKey`, `"insightsCategory"` and
`"insightsTag"` are **not** added there — those are per-slug dynamic
segments under the `insights` hub, not fixed hub-level pages, so they're
built the same way `caseStudyPath()` builds case-study URLs: a small
`articlePath(slug, locale)` / `categoryPath(slug, locale)` /
`tagPath(slug, locale)` helper in `src/features/insights/seo/paths.ts`
that appends to `routes.insights[locale]`. This keeps `routes.ts` itself
about *hubs*, consistent with what it already is.

**EN/PL article parity fallback** (flagged as an open risk in the audit):
the language switch calls `alternatePath()`, which assumes every path has
a same-key equivalent. For an individual article without a translation
yet, the article record's own `translation_of` / paired-slug field (see
`INSIGHTS_DATABASE.md` §2) is consulted first; only if no counterpart
exists does the switch fall back to the Insights **hub** in the other
locale, rather than a 404. This logic lives in
`src/features/insights/seo/articleLocale.ts`, not inside the shared
`LanguageSwitch` component — that component stays generic and unaware of
per-content-type parity rules, and calls out to per-section resolvers.

---

## 3. Source layout (only what has a job right now)

```text
src/app/insights/
  page.tsx                     # hub, Server Component
  [slug]/page.tsx               # article
  category/[slug]/page.tsx
  tag/[slug]/page.tsx

src/app/pl/insights/            # mirror of the above, PL copy
  page.tsx
  [slug]/page.tsx
  category/[slug]/page.tsx
  tag/[slug]/page.tsx

src/app/admin/insights/
  page.tsx                      # list + status filters
  new/page.tsx
  [id]/edit/page.tsx

src/features/insights/
  types/                        # Article, Category, Tag, ContentBlock types
  data/                         # query functions (getArticleBySlug, listPublished, ...)
  seo/                          # buildArticleMetadata, paths.ts, articleLocale.ts, structuredData
  blocks/                       # content block renderers (see §5)
  components/                   # ArticleHero, ArticleCard, ArticleToc, ArticleCallout, ...
  listing/                      # hub/category/tag listing composition
  article/                      # single-article page composition
  categories/                   # category listing helpers
  cms/                          # admin editor form, schema, Server Actions
  __tests__/

src/styles/insights/
  globals.css      # subsystem-wide resets/behaviour only
  tokens.css       # scoped --insights-* variables layered on core tokens
  typography.css   # prose rhythm for long-form content
  layout.css       # hub/listing grid, article shell, sidebar/TOC layout
  article.css      # article-specific chrome (byline, cover, share)
  utilities.css    # small, named helpers actually used more than once
  responsive.css   # breakpoints specific to reading layout

src/lib/analytics/events.ts   # extended, not a new file (see §6)
```

Every component gets a co-located `ComponentName.module.css`
(Decision 5) — e.g. `ArticleCard.tsx` + `ArticleCard.module.css`. The
`src/styles/insights/*.css` files above are for genuinely shared,
cross-component rules (reading measure, heading rhythm, the listing
grid's breakpoints) — not a place to accumulate component-specific rules
that belong in a module file.

**Not created in this pass:** `features/insights/search/`,
`features/insights/recommendations/`. Search (Checkpoint 4) and
recommendations are real, scoped features but have no implementation yet;
adding empty folders for them now would be exactly the "architectural
theatre" the master instruction warns against. They're added when their
checkpoint starts.

`src/features/content-intelligence/` did not exist at this point (see §7)
and is not detailed here; its modules are described by responsibility in
§14-18, once they exist.

---

## 4. Content model shape (detail in `INSIGHTS_DATABASE.md`)

An article is: metadata (slug, title, excerpt, cover image, category,
tags, author, locale, translation pairing) + an ordered list of
**structured content blocks**, not a single HTML/Markdown blob. This is
Decision 7 in the master instruction ("AI output uses controlled
structured content blocks") and it also solves a normal editorial need:
rich components (callouts, code blocks, pull quotes) need to render
consistently regardless of whether a human or the future Content Engine
authored them.

Block types for v1 (kept deliberately small — grow this list only when a
real article needs a block type it doesn't have):

```text
paragraph
heading
image
code
callout       (info / warning / tip)
quote
list          (ordered / unordered)
```

Each block is validated by a discriminated-union Zod schema
(`src/features/insights/types/blocks.ts`), following the exact "server
boundary is the real boundary" philosophy already used for lead forms —
whether a block comes from the admin editor UI or a future AI-generated
draft, it passes through the same schema before it can be persisted.

---

## 5. Rendering

`src/features/insights/blocks/BlockRenderer.tsx` maps a block's
`type` to a small, pure presentational component
(`ParagraphBlock`, `CalloutBlock`, `CodeBlock`, …), each with its own
`.module.css`. This is the one place that switches on block type — new
block types are added by extending this map and the Zod union together,
never by branching inside individual page components.

Article body code blocks reuse **no external syntax-highlighting
dependency** for v1 (the project has zero UI dependencies today beyond
Supabase/Zod — see audit §1.1/package.json; adding one is a real decision,
not a default). Plain, well-styled `<pre><code>` with the existing
`--font-mono` token covers v1; a highlighter can be added later behind
the same `CodeBlock` component without touching anything else.

---

## 6. Analytics extension (additive to existing `events.ts`)

New taxonomy entries, added to the existing file, not a new one:

```text
article_view          (slug, category, locale)
article_read_progress (slug, percent: 25 | 50 | 75 | 100)
article_cta_click     (slug, cta_location)
insights_search       (query, result_count)          # Checkpoint 4
category_view / tag_view (slug)
```

All gated the same way every existing event is: dispatched via a named
`events.x(...)` function, consent-checked by the existing
`AnalyticsProvider` registry, nothing new to build in `lib/analytics/`
itself.

---

## 7. Content Intelligence - architectural boundary

`features/content-intelligence/**` was originally deferred, unscaffolded,
per the master instruction's own checkpoint sequencing (Checkpoints 6-9).
It has since been built out across those checkpoints (see §14-18 for what
it now does). The boundary decided here at the outset has held throughout
and remains the rule:

- The **only** integration surface it has into the Insights system is a
  write path into `insights_articles` (as a `status = "in_review"` row
  awaiting human approval, via `briefs/promote.ts`, Decision 10/11), via
  the same Zod block schema described in §4 and the same `createArticle()`
  function an editor's own CMS form calls.
- It is **never** imported by anything under `src/app/insights/**` or
  `src/app/pl/wiedza/**`. If this rule is ever violated, that is a
  regression against the master instruction's core engineering principle
  (§2) and should be treated as a bug, not a refactor opportunity.

This keeps published Insights pages fully independent of Content
Intelligence: a failure, misconfiguration, or provider outage anywhere in
`content-intelligence/**` can never affect a public page render.

---

## 8. Checkpoint mapping

This architecture directly supports Checkpoint 2 (Blog foundation) and
Checkpoint 3 (CMS) as scoped in the master instruction. Checkpoint 4 (SEO/
discovery) reuses `buildPageMetadata`'s shape via a new
`buildArticleMetadata`, plus RSS/sitemap additions described in the audit.
Checkpoints 5+ are analytics/search-intelligence/AI work that build *on*
this foundation without requiring changes to it, which is the point of
doing the audit and this document before writing implementation code.

## 9. Checkpoint 2 implementation notes (deviations from this plan, as built)

Recorded per master instruction §62 ("when something in the existing
application conflicts with this plan, choose the solution that best
preserves maintainability/correctness/... and document the deviation").

1. **Direct cutover instead of the staged migration in
   `docs/INSIGHTS_AUDIT.md` §5.** The audit's migration strategy assumed
   a live application where a broken interim state carries real risk.
   At the time of this decision, the app had not yet been deployed or
   run, so that risk did not exist. `src/app/insights/
   page.tsx` and `src/app/pl/wiedza/page.tsx` were replaced directly and
   `src/features/pages/InsightsPage.tsx` was deleted outright, rather than
   building the new hub at a temporary path first. Also corrected: the
   audit stated `/pl/wiedza` didn't exist yet — it did (same legacy
   placeholder as `/insights`), so no new Polish route file was needed,
   only its content replaced.
2. **`author_name` is a required column on `insights_articles`, not
   `author_name_override`.** `profiles` only grants a "select own row" RLS
   policy (`001_initial.sql`), so an anonymous public-page query could
   never join `profiles.display_name` in the first place — denormalizing
   the display name onto the article row is the only correct fix, not an
   edge case. `INSIGHTS_DATABASE.md` §2.3 and the migration were both
   updated to match.
3. **Article body images and cover images render via a plain `<img>`,
   not `next/image`.** `next.config.mjs` has no `images.remotePatterns`
   configured, and article images come from editor/CMS-supplied URLs on
   an unknown host — `next/image` would throw at request time for any
   real external URL until that config exists. Revisit once the actual
   asset host (e.g. a Supabase Storage bucket) is decided.
4. **The global `LanguageSwitch` (in `Header`) was left unmodified.** It
   already only resolves hub-level 1:1 routes via `resolveRoute()`/
   `alternatePath()` and falls back to the home page for any dynamic
   route it doesn't recognize — true today for `/work/[slug]` case
   studies as much as for `/insights/[slug]` articles, so this is a
   pre-existing limitation, not a regression introduced here. Rather than
   restructure a shared component to carry per-page context across a
   layout boundary it doesn't naturally have access to, the per-article
   translation link (resolved server-side via
   `resolveArticleAlternatePath`) is surfaced directly in `ArticleHero`
   instead — visible inline near the byline, arguably better UX than a
   header-level toggle for this one content type.
5. **Content blocks hold plain text only in v1 — no inline formatting**
   (bold/italic/inline links/inline code) within a `paragraph`/`list`
   block. Modeling rich inline text (a second, nested schema) was judged
   out of scope for "the blog should already look professional"
   (Checkpoint 2's bar) versus "an editor can format text inline"
   (a real CMS-editor UX concern that belongs with Checkpoint 3's editor
   itself). Revisit the block schema together with the CMS editor's rich
   text handling, not before it.
6. **`src/styles/insights/{typography,layout,utilities,responsive}.css`
   were not created.** Per §6 ("avoid empty architectural theatre"),
   only `tokens.css` was created because it's the only one with genuine,
   non-duplicative shared content right now — reading measure and prose
   sizing variables consumed by multiple block `.module.css` files.
   The others are added when a real cross-component rule needs a home
   that isn't a single component's module file.
7. **Tag filtering in `listPublishedArticles` happens in application code
   after the page query**, not as a database-level join filter, as noted
   inline in `data/queries.ts`. Acceptable at the current expected content
   volume; flagged for a dedicated RPC if a tag ever needs true
   server-side pagination.

## 10. Checkpoint 3 (CMS) implementation notes

1. **`getAdminSession()` now returns `isAdmin`/`isEditor` flags** instead
   of only recognizing `admin`. `/admin/leads` and the `/admin` overview
   both explicitly redirect a non-admin (editor-only) session to
   `/admin/insights` — leads data spans all three business lines and has
   nothing to do with content, so it stays admin-only rather than
   becoming visible to every editor.
2. **The CMS editor's `body` field is a raw JSON textarea, not a visual
   block builder.** Matches the plain-text-block v1 decision from §9 —
   building a WYSIWYG block editor was judged out of scope for
   Checkpoint 3's bar ("create, edit, preview, schedule, publish,
   archive", explicitly "no AI yet required") versus a genuinely separate
   editor-UX project. The textarea is validated against the exact same
   `articleBodySchema` the public pages read through, so a malformed
   submission is rejected with a clear error rather than silently saved.
3. **No "preview" route was built as a separate `/admin/insights/[id]/
   preview` page.** A draft/scheduled article is already fully
   viewable by an authenticated editor at its normal public URL — the
   "public select published" RLS policy blocks anonymous reads of
   unpublished content, but the "editor select all" policy means an
   editor's own authenticated session can already open
   `/insights/[slug]` (or `/pl/wiedza/[slug]`) for *any* status and see
   exactly what the public will see once it's published. A dedicated
   preview route would only be needed if unauthenticated stakeholders
   (e.g. a client without an editor account) needed to see a draft — not
   a stated requirement yet.
4. **Status transitions (`publish`/`schedule`/`archive`/`back to draft`)
   are a separate action from saving content edits**, both in the UI
   (`ArticleStatusActions`, distinct from `ArticleEditorForm`) and in the
   data layer (`transitionArticleStatus`, distinct from `updateArticle`).
   This avoids a real bug class: a content-only edit accidentally
   changing (or silently clearing) an article's schedule, publish date,
   or status as a side effect of an unrelated field change.
5. **`translationOf` is set through a search-by-title picker**
   (`TranslationPicker.tsx`), not a plain id text field. The picker only
   offers articles in the opposite locale, resolves to the same
   `translationOf` article id underneath, and submits it through the
   same hidden form field the Server Action already reads, so
   `cms/schema.ts` and the `translation_of` column and relationship are
   unchanged.
6. **Tag management (creating new tags) has no UI yet** — the CMS form
   can only attach *existing* tags via checkboxes. New tags are created
   directly against `insights_tags` (e.g. via the Supabase dashboard)
   until a tag-management screen is worth building. `insights_categories`
   is similarly fixed-by-design (Decision: pillars are a small curated
   set, not editor-managed), so no category CRUD UI was built either.

## 11. Checkpoint 4 (SEO / discovery) implementation notes

- **Search is ILIKE-based (`searchPublishedArticles`), not full-text
  (`tsvector`/GIN).** `INSIGHTS_DATABASE.md` §7 deliberately deferred
  full-text indexing until real search UI and query patterns existed to
  design its field weights against — this is that deferred point, and
  the honest v1 answer is still "substring match on title/excerpt is good
  enough for the current and near-term content volume". Upgrading later
  means adding a migration + swapping this function's implementation;
  its signature and every caller stay the same.
- **The search form is a plain `<form method="GET">`**, not a client
  component with `fetch`/debounced suggestions — works without
  JavaScript, matches the "use animation sparingly"/calm editorial
  direction, and needs no new client-side state.
- **The search results page is `noindex, follow`** — a query-string
  results page isn't a URL worth showing in search results (the
  underlying articles are already indexed at their real URLs and already
  in the sitemap), but its links should still be followed.
- **RSS feed content is title/excerpt only, not full article body.**
  Summary-style feeds are the RSS norm and avoid re-serializing the
  structured content-block JSON into feed-safe HTML — a real subsequent
  step (rendering blocks to escaped HTML for `<content:encoded>`) if a
  full-content feed is ever requested, not built speculatively now.
- **hreflang in article metadata is still best-effort**, unchanged from
  Checkpoint 2 — only emitted when `resolveArticleAlternatePath` finds a
  real translation. The sitemap's per-article entries still don't cross-
  reference EN/PL (§9 item — no change here; still correct that guessing
  a pairing at the sitemap level without checking `translation_of` would
  risk pointing at a URL that doesn't exist).
- **IndexNow fires from three places, all inside
  `src/features/insights/cms/service.ts` / the scheduler's publish
  route, never from a fourth parallel implementation:** the scheduler's
  cron-driven auto-publish (`src/app/api/v1/scheduler/publish/route.ts`),
  a manual publish via `transitionArticleStatus` (any non-`published`
  status transitioning to `published` — an archive-then-republish does
  not re-fire, since it was already published before), and a content
  edit to an already-`published` article via `updateArticle` (a
  draft/in_review/scheduled/archived save never does). All three build
  the submitted URL through the one shared `articleUrl()` helper in
  `src/features/insights/seo/paths.ts` and submit through the one
  existing `pingIndexNow()` in `seo/indexNow.ts` — no separate provider,
  no duplicated URL construction. A submission failure is swallowed
  entirely inside `pingIndexNow` (logged, never thrown) and can never
  block or roll back the publish/edit that triggered it; the ping only
  ever runs after that database write has already succeeded. Draft,
  in_review, scheduled, archived, preview (`/admin/insights/[id]/
  preview`, itself `noindex`/session-gated) and admin/API URLs are
  never reachable through any of the three triggers.
- **The IndexNow key verification file lives at the literal domain
  root (`/{INDEXNOW_KEY}.txt`), not under `/api/`.** It was originally
  served at `/api/indexnow-key.txt` (still schema-legal per IndexNow's
  written spec), but Bing's real verifier rejected that `keyLocation`
  with an HTTP 422 — in practice the key must be at the domain root.
  `next.config.mjs` rewrites the one exact literal path computed from
  `INDEXNOW_KEY` to `src/app/api/indexnow-key/route.ts` (a no-op when
  the env var is unset) — never a dynamic `[key].txt` segment, which
  would otherwise match every unmatched single-segment request at the
  site root and interfere with normal 404 handling.

## 12. Checkpoint 5 (Analytics foundation) implementation notes

- **The first-party sink now actually persists.**
  `src/app/api/v1/analytics/route.ts` previously only `console.log`'d
  events (its own comment said as much); `supabase/migrations/
  004_analytics_events.sql` adds a durable `analytics_events` table and
  the route now inserts into it via the service-role client, falling
  back to the console.log when Supabase isn't configured. This was
  already the documented "contained change inside this one file" the
  prior round anticipated — no new architecture.
- **`analytics_events` has zero RLS select/insert policies for anon or
  authenticated roles.** Writes only happen through the service-role
  client (bypasses RLS entirely); reads only happen through two new
  `SECURITY DEFINER` RPCs (`insights_top_articles`,
  `insights_cta_click_counts`) that check `is_active_editor_or_admin()`
  themselves before returning anything — the same shape as
  `is_active_admin()`/`is_active_editor_or_admin()` from earlier
  checkpoints, just applied to a function that also returns rows instead
  of a boolean.
- **Two previously-defined-but-never-fired events are now wired up**:
  `article_read_progress` (a plain scroll-depth listener,
  `ReadProgressTracker`, no `IntersectionObserver` needed since this only
  cares about overall depth) and `article_cta_click` (`ArticleCtaLink`, a
  thin client wrapper around the article's bottom CTA link). `category_
  view`/`tag_view` are now fired too, via the same mount-once-ref pattern
  as `ArticleViewTracker`.
- **"Service transitions" (checklist item) is intentionally *not* a new
  event or table.** An article's CTA click (`article_cta_click`, now
  wired) and the pre-existing `service_view` event both carry enough
  shared context (`page`, `referrer`, attribution fields) in the same
  `analytics_events` log to reconstruct an article→service funnel by
  querying across both event names — building a bespoke "referral" table
  before a real query need for one exists would be exactly the kind of
  speculative infrastructure this project has been avoiding elsewhere.
- **"Lead attribution foundations" required no new code.**
  `AttributionCapture` already mounts once from the root layout
  (`src/app/layout.tsx`) and runs identically on every route, Insights
  included — first-touch UTM/referrer/landing-page capture already works
  for a visitor who lands on an article before ever filling out a lead
  form. Confirmed by reading the component rather than assumed.
- **Admin performance view**: `/admin/insights/performance` — top
  articles by view count and CTA clicks by location, last 30 days, read
  through `cms/queries.ts`'s two new RPC wrappers
  (`getTopArticles`/`getCtaClickCounts`). Deliberately minimal (two
  tables, no charts) — Checkpoint 5's bar is "the data exists and is
  readable", not a full analytics UI.

## 13. Checkpoint 6 (Search intelligence) implementation notes

This is the first checkpoint touching `src/features/content-
intelligence/**`, unscaffolded until now per §7's own rule. Only the
folders this checkpoint actually needs were created: `types/`, `google/`,
`bing/`, `keywords/`, `opportunities/`, `planner/` — not the full target
diagram (`briefs/`, `research/`, `generation/`, etc. stay unallocated
until their own checkpoint).

- **Two real external integrations, both raw `fetch`, no SDK** — same
  convention as the HubSpot CRM adapter. Google Search Console uses a
  service-account JWT (RS256-signed via Node's built-in `crypto`,
  exchanged for an OAuth2 access token) against the `searchAnalytics/
  query` endpoint. Bing Webmaster uses a simple API-key query param
  against `GetQueryStats`. Both are silent no-ops (`isConfigured()`
  false) until their env vars are set — new vars documented in
  `.env.example`.
- **Bing's `GetQueryStats` has no page dimension and no date-range
  parameter** — verified against Bing's own documented response shape,
  not assumed. It always returns whatever weekly-bucket history it
  currently has for the whole site; this provider filters that
  client-side against the requested range rather than pretending Bing's
  API accepts one.
- **A real correctness bug was caught and fixed before packaging**: the
  first draft of `search_performance_metrics.page_url` was nullable,
  which would have silently broken the ingestion upsert's idempotency —
  Postgres treats two `NULL`s as distinct for uniqueness purposes, so
  every Bing re-ingestion (which always reports `page_url = null`) would
  have inserted duplicate rows instead of updating existing ones. Fixed
  by using an empty-string sentinel (`not null default ''`) instead of
  `NULL`, documented inline in the migration.
- **Opportunity scoring (`opportunities/score.ts`) is a pure, standalone
  function** — no database or provider dependency, rewards queries close
  to breaking onto page 1 (a bell curve peaking around position 12), not
  just queries with the most raw impressions. Kept deliberately separate
  from `recompute.ts` (the aggregation + persistence step) so the formula
  itself has a stable, testable seam if it needs tuning later against
  real data.
- **"Already covered" article matching is a simple title/excerpt
  substring check**, not a page-URL join against actual ranking data.
  Documented in `recompute.ts` as a deliberate v1 simplification — a
  precise "does this specific published URL actually rank for this
  query" join is real, separate work (redirects, trailing slashes, query
  params) that Checkpoint 9's content-refresh workflow can justify
  building when it needs that precision.
- **The "planner" deliverable is `listTopOpportunities()` plus a status
  column** (new/reviewing/briefed/dismissed) — not a content-brief
  generator. Marking an opportunity "briefed" is a planning-stage
  bookmark so it stops resurfacing at the top of the list; it does not
  create any row in `insights_articles` or elsewhere. Actually generating
  a brief from a selected opportunity is Checkpoint 7's job, and — per
  §7's architectural boundary — content-intelligence's only future write
  path into the Insights system is inserting a `status = 'in_review'`
  article row, never anything reachable from
  `src/app/insights/**`/`src/app/pl/wiedza/**`.
- **No scheduler yet** — ingestion and recompute are both manual
  buttons in `/admin/insights/opportunities` (`OpportunitiesToolbar`).
  Checkpoint 8 ("Automation") is where a cron-driven refresh belongs.

---

## 14. Content Intelligence - editorial pipeline

The Content Engine named as future in §1 and §7 is implemented under
`src/features/content-intelligence/`. Its only write path into the
Insights system is exactly what §7 scopes: an `insights_articles` row
with `status = "in_review"`, created through the same `createArticle()`
function and Zod block schema an editor's own CMS form submits to.

One `content_briefs` row represents one editorial pipeline run,
optionally linked to a search opportunity. Its `status` column tracks
progress through four independent stages plus a final promotion step.
Each stage is a separate, explicit editor action in `PipelineControls.tsx`,
none runs automatically after another, and an editor can rerun an
earlier stage after a failure without repeating stages that already
succeeded.

- **Research** (`research/research.ts`) calls the configured Anthropic
  provider for a short research brief, stored as plain text for the
  generation stage to use as grounding.
- **Generation** (`generation/generate.ts`, `AnthropicProvider.ts`)
  produces the structured article body, validated against the same block
  schema public pages and the CMS editor both read through.
- **Localisation** (`localisation/localise.ts`) translates a generated
  draft into the brief's other locale.
- **Quality gate** (`quality/qualityGate.ts`) is a pure, synchronous check
  (word count, heading count, minimum block count, placeholder text, code
  blocks missing a language) with no database or provider call. A failed
  check blocks promotion, not editing.
- **Promotion** (`briefs/promote.ts`) is the only place a brief's draft
  becomes real `insights_articles` rows, and only once the brief's status
  is `quality_passed`. It never sets an article to `published`. That
  remains the separate, human `transitionArticleStatus` action already
  described in §10, unaffected by this pipeline.

Every research, generation and localisation call requires editor
authentication and a positive monthly budget check (`generation/
costGuard.ts`) before it runs, and is recorded in `ai_usage_log` (§16).

## 15. Article Visual - generation, review, approval and translation sharing

`article_visuals` stores every generated or uploaded candidate cover
image for an article, independently of `insights_articles`. A database
constraint allows at most one row with `status = "approved"` per article
at a time.

- **Generation** (`visuals/articleVisualGenerationService.ts`, via a
  configured image provider, currently OpenAI,
  `OpenAiArticleVisualProvider.ts`) and **manual upload**
  (`visuals/articleVisualStorageService.ts`, reached through a Route
  Handler rather than a Server Action because of this Next.js version's
  request body size limit) both only ever create a new `pending_review`
  candidate. Neither approves, supersedes or replaces the article's live
  cover.
- **Prompt relevance and diversity.** `ArticleVisualBrief` carries both
  `subject` (title) and `coreIdea` (excerpt), both trimmed passthroughs,
  never paraphrased or inferred - the model derives the actual visual
  concept from that real content, not from the title alone. Composition
  and lighting/atmosphere are chosen deterministically (a small string
  hash over `subject`+`coreIdea`, no external call) from curated pools,
  so different articles vary in presentation without ever hashing the
  visual metaphor itself. Category direction remains a secondary,
  subordinate stylistic cue only.
- **Review and approval** (`visuals/articleVisualReviewService.ts`) call
  a single Postgres function, `approve_article_visual`, which supersedes
  the article's previous approved candidate, marks the selected one
  approved, and writes the article's live cover fields
  (`cover_image_url`, `cover_image_alt`, `cover_image_status` on
  `insights_articles`) as one atomic operation. This is the only place
  those three columns are allowed to become `approved`.
- **Deletion** (`visuals/articleVisualDeletionService.ts`) only ever
  removes a `pending_review` or `superseded` candidate; an `approved`
  candidate can never be deleted through this path.

**Authentication/write boundary.** Editor authorization for generation
and upload is resolved exactly once per action, via
`articleVisualStorageService.ts`'s `requireEditorContext()`, before
anything slow or billable runs - never independently re-resolved
afterward. A production defect once had `generateArticleVisualCandidate`
check authorization, call the real image provider (which can take up to
two minutes), and only then hand off to a storage function that
independently re-resolved the session a second time; a session that had
gone stale during that wait could pass the first check and fail the
second, discarding an already-generated, already-paid-for image. Both
generation and upload now obtain one `ArticleVisualAuthContext` (a
session-aware, RLS-governed Supabase client plus the verified session)
up front and reuse it for the eventual write, which still runs through
that same ordinary client - never a service-role client, and RLS
(migrations 011-013) remains the final database security boundary
exactly as before.

**Managed cover ownership.** The ordinary CMS content-save path
(`updateArticle`, `createArticle` in `cms/service.ts`) never writes
`cover_image_url`, `cover_image_alt` or `cover_image_status`. Those
three fields are absent from `articleInputSchema` and from
`ArticleEditorForm.tsx` entirely. Only `approve_article_visual`, and the
translation synchronisation it triggers below, may change them.

**EN/PL translation cover sharing.** A linked EN/PL translation pair
(resolved via `translation_of`, checked in both directions, and only
acted on when the relationship is unambiguous -
`find_linked_translation_id`) shares one approved cover without a second
Storage object or a second `article_visuals` row. `sync_linked_
translation_cover` propagates the cover fields between the two
`insights_articles` rows: authoritatively, inside the same transaction as
an approval, whenever the linked translation does not own an approved
candidate of its own; and non-authoritatively, as a best-effort follow-up
from `createArticle`/`updateArticle` whenever a translation link is
saved, only filling a genuine gap rather than choosing between two
already-valid covers.

The publication gate (`transitionArticleStatus`, §10) still requires
`cover_image_status = "approved"` with a non-empty URL and alt text on
the specific article being published, whether that cover was approved
directly or synchronised from a linked translation.

## 16. AI operation observability

`ai_usage_log` (introduced with the editorial pipeline) records every
billable AI call - provider, model, token counts, estimated cost - and is
what `costGuard.ts` reads to enforce the monthly budget. It was later
extended, in place, with a provider-neutral operation type, execution
mode, run id, duration, outcome and a closed failure classification, read
back through `events/aiOperationEventQueries.ts`. The event log never
stores a prompt, response body or raw exception text.

**Write invariant: one provider attempt produces at most one row.**
`events/aiOperationEventWriter.ts`'s `recordAiOperationEvent()` is the
single canonical writer for research, generation, localisation and the AI
visibility check below, on both the success and failure branch. A
duplicate-accounting defect briefly existed where a legacy
`costGuard.logUsage()` call also wrote its own row for the same
successful call, with the same `estimated_cost_usd` - since
`checkBudget()`/`getMonthlyBudgetUsage()` sum that column unconditionally
across the whole table, every successful call's cost was counted twice
toward the monthly budget. `logUsage()` has been removed entirely (not
just its call sites) so this table has exactly one writer going forward;
`checkBudget()`'s query itself needed no change, no migration was run,
and existing historical/duplicate rows were left untouched.

The read side is consumed by `/admin/insights/ai-operations`, a read-only
admin page showing the current month's spend against the configured
budget, a per-operation-type summary, and a recent-operations table -
built entirely on `aiOperationEventQueries.ts` and a small extracted
`costGuard.getMonthlyBudgetUsage()` read, with no new query, migration or
RLS change. Article Visual (image) generation is not yet instrumented
into `ai_usage_log`, so this page does not reflect every AI-related cost
in the app; the page states this limitation explicitly.

## 17. Publishing automation boundary

`src/app/api/v1/scheduler/publish/route.ts` is triggered by an external
daily cron and publishes whichever articles are already due under their
own `scheduled_at` value, set earlier by an editor through the ordinary
`transitionArticleStatus` action described in §10. It does not decide
what to schedule, generate content, or promote a brief - it only executes
a publishing decision a human already made. `/admin/insights/queue` is a
read-only view of the same scheduled articles, ordered by when they are
due.

## 18. Optimisation and monitoring feedback loop

A set of editor-triggered admin views close the loop from a search
opportunity through to a published article's real performance, without
writing back into `insights_articles` or changing any article's status:

- `monitoring/performanceAnalysis.ts` combines the existing page-view and
  CTA-click reads with search performance data into one per-article read,
  reused by the modules below rather than each recomputing its own
  version.
- `refresh/staleness.ts` ranks published articles by age past a
  configurable threshold and by a worsening search-position trend, for
  editorial attention, not automatic action.
- `conversion/conversionIntelligence.ts` matches a lead submission's
  captured landing page back to the article that produced it. Admin-only,
  matching the existing admin-only RLS on the lead tables it reads.
- `monitoring/aiVisibility.ts` asks the configured Anthropic provider a
  representative query and records whether the studio was mentioned - a
  proxy signal for one provider, not a measurement of any specific
  real-world AI search product.
- `opportunities/cannibalisation.ts` flags search queries where two or
  more published articles both receive impressions, a sign the site is
  competing with itself rather than one article owning the term.
- `learning/calibration.ts` compares each promoted opportunity's score at
  promotion (`content_opportunities.score_at_promotion`, set once by
  `briefs/promote.ts`) against that article's actual performance, and
  folds the result into one multiplier the existing opportunity scoring
  formula applies going forward.

All of the above are manually triggered reads or recomputations from the
relevant `/admin/insights/*` page; none of them is scheduled or runs
automatically.

