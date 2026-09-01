# CCS Web Platform — Build Log addendum (Insights subsystem, round 6)

*(The project's `homepage-design-system-and-status.md` is a read-only
project file in this session, so it can't be edited directly. This is
the entry to prepend to it — written in the same format as the existing
log — so the next session picks up the correct state.)*

## Status: Insights subsystem — Checkpoint 1 (Audit) and Checkpoint 2
## (Blog foundation) complete

Dan sent `CLAUDE_MASTER_DEVELOPER_INSTRUCTION_CCS_INSIGHTS.md` — a
64-section master instruction scoping a full Insights/Blog publishing
subsystem plus a future Content Intelligence engine, with its own
9-checkpoint delivery plan (Blog foundation → CMS → SEO/discovery →
Analytics → Search intelligence → AI editorial → Automation →
Optimisation loop, with an explicit audit-first gate before any
implementation).

**Deliverable:** the same `ccs-app` tree, updated in place. Re-zipped for
delivery. Still **not built/run in this sandbox** — npm registry access
is 403 here, same as every prior round. Verified the same way as before:
a `ts.transpileModule` syntax pass across every new/changed file (0
errors across 40 files) and an import-resolution script across the whole
`src/` tree (0 unresolved imports across 178 files).

### Checkpoint 1 — Audit (complete)
Produced `docs/INSIGHTS_AUDIT.md`, `docs/INSIGHTS_ARCHITECTURE.md`,
`docs/INSIGHTS_DATABASE.md` per the master instruction's Phase 0
requirement. Key findings: the legacy `/insights` page (and its
already-existing but unnoticed-at-first `/pl/wiedza` Polish twin) was a
static three-post placeholder with no database, CMS, categories, tags or
search — confirmed safe to fully replace rather than extend. Existing app
conventions (single `routes.ts`, RLS + service-role split, one analytics
taxonomy file, one consent gate, safe-without-backend fallbacks) were
catalogued for reuse.

### Checkpoint 2 — Blog foundation (complete)
- **Database**: `supabase/migrations/003_insights_schema.sql` —
  `insights_categories`, `insights_tags`, `insights_articles`,
  `insights_article_tags`, RLS (public read only for `status='published'
  AND published_at <= now()`, enforced in the policy itself), a new
  `is_active_editor_or_admin()` role helper alongside the existing
  `is_active_admin()`, seed rows for the three content pillars
  (BUILD/GROW/LEARN). No sample articles seeded — real content is a
  Checkpoint 3 (CMS) job, not audit-round placeholder data.
- **Content model**: structured content blocks
  (`src/features/insights/types/blocks.ts`, Zod discriminated union —
  paragraph/heading/image/code/callout/quote/list), not raw HTML/
  Markdown, per the master instruction's Decision 7. Plain text only in
  v1 — no inline bold/italic/links yet (deferred to sit alongside the
  Checkpoint 3 editor).
- **Data layer**: `src/features/insights/data/{mappers,queries}.ts` —
  public, read-only, RLS-backed, safe with no Supabase configured
  (returns empty/null, same pattern as every other Supabase-backed
  feature in this app).
- **Routing**: `src/app/insights/{page,[slug],category/[slug],
  tag/[slug]}.tsx` and the Polish mirror under `src/app/pl/wiedza/**`
  (with localized `kategoria`/`tag` segments). Both legacy pages were
  **replaced directly** rather than following the audit's originally
  planned staged cutover — since this app has never been deployed, the
  risk a staged rollout protects against doesn't exist yet. Deviation
  documented in `INSIGHTS_ARCHITECTURE.md` §9.
- **Components**: `ArticleCard`, `ArticleHero`, `ArticleToc`, `TagList`,
  `PillarCard`, plus 7 content-block renderers — each with a co-located
  `.module.css` (first use of CSS Modules anywhere in this codebase, per
  Decision 5). Article/cover images render via plain `<img>`, not
  `next/image` (no `remotePatterns` configured for an unknown CMS image
  host yet).
- **SEO**: `buildArticleMetadata()` added to the existing
  `lib/seo/metadata.ts`; `articleSchema()`/`articleBreadcrumbs()` added
  to the existing `lib/seo/structuredData.ts` (`BlogPosting` schema, only
  real fields, no invented author bios). `sitemap.ts` extended with
  published articles per locale, `lastModified` sourced from each
  article's real `updated_at`.
- **Analytics**: `article_view`, `article_read_progress`,
  `article_cta_click`, `category_view`, `tag_view`, `insights_search`
  added to the existing `lib/analytics/events.ts` taxonomy file (not a
  second file).
- **`InsightsPage.tsx` (legacy placeholder) deleted** — cutover
  complete, nothing left referencing it.

### Explicitly deferred (documented, not overlooked)
`src/styles/insights/{typography,layout,utilities,responsive}.css` —
no unique cross-component content yet, would be empty scaffolding.
Tag filtering in `listPublishedArticles` happens in application code
after the page-sized query, not as a DB-level join filter — fine at
expected content volume, flagged for a dedicated RPC later. Rich inline
text formatting inside content blocks. Everything under
`src/features/content-intelligence/**` (Checkpoints 6-9) — no code
written, by design; its only future integration surface is a write path
into the same `insights_articles` table an editor's CMS writes to.

## Next session should
Read `docs/INSIGHTS_AUDIT.md`, `docs/INSIGHTS_ARCHITECTURE.md` and
`docs/INSIGHTS_DATABASE.md` first for the Insights subsystem specifically,
then this file for overall project state. The natural next step is
**Checkpoint 3 (CMS)**: admin article list at `/admin/insights`, create/
edit/preview/schedule/publish/archive, reusing the existing `/admin` auth
gate and extending `getAdminSession()` (or a new `requireRole()`) to
recognize the `editor` role distinctly from `admin`. Ask before starting
if anything about the CMS's scope (e.g. whether editors get a rich text
toolbar in v1, given the plain-text-block deferral above) needs a product
decision first, rather than assuming.
