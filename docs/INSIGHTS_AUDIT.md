# Insights Subsystem — Phase 0 Audit

Status: **Checkpoint 1 (Audit) — complete.**
Scope: read-only inspection of the current CCS application before any
Insights implementation work begins, per
`CLAUDE_MASTER_DEVELOPER_INSTRUCTION_CCS_INSIGHTS.md` §4.

No production code was changed to produce this document.

---

## 0. Note on `docs/`

The design-system status log (`homepage-design-system-and-status.md`)
references a `docs/` folder with `ANALYTICS.md`, `SEO_AEO.md`,
`ATTRIBUTION.md`, etc. from a prior round. **That folder is not present in
the `app-ccs.zip` uploaded for this task** — this audit treats the code as
the source of truth and rebuilds the relevant facts from it directly. If a
fuller `docs/` folder exists elsewhere, it should be merged in rather than
overwritten; nothing here assumes it doesn't exist, only that it wasn't
available to inspect.

Two stray editor lock files (`.fuse_hidden*`) were found under
`src/features/admin/` and `src/lib/supabase/` / `src/lib/validation/` and
removed as harmless cleanup (not tracked source, zero-byte artifacts from
the packaging process) — noted here for transparency since it's the one
filesystem change made outside `docs/`.

---

## 1. Existing architecture

### 1.1 Framework & routing

- **Next.js 16.3.1**, App Router, React 19.2.8, TypeScript 5.9 strict.
- **No `[locale]` dynamic segment.** English lives at the root
  (`/`, `/services`, `/insights`, …) and Polish is a fully parallel,
  hand-written tree under `src/app/pl/**` with its own path per page
  (`/pl/uslugi`, `/pl/wiedza`, …). There is exactly **one** root
  `layout.tsx` (Next.js only allows one `<html>`/`<body>` pair), which
  reads the locale from a request header rather than from a route param.
- **`src/lib/routes.ts`** is the single source of truth mapping a
  `RouteKey` (`"services"`, `"insights"`, …) to its EN and PL path pair.
  `routeFor`, `resolveRoute`, and `alternatePath` are the only sanctioned
  way to go from key → path, path → key, or EN path ↔ PL path. Every
  `generateMetadata`/`metadata` export, the sitemap, the language switch,
  and breadcrumbs all go through this file — nothing hardcodes a `/pl/...`
  string outside it.
- **`src/middleware.ts`** does two unrelated jobs in one function (Next
  runs one middleware per request): (a) stamps an `x-locale` header from
  the `/pl` prefix, read by the root layout to set server-rendered
  `<html lang>` correctly on the *first* response; (b) refreshes the
  Supabase auth cookie, but only for paths under `/admin`. It no-ops
  cleanly when Supabase env vars are absent.
- Case-study/project pages are the only existing dynamic segment pattern:
  `caseStudyPath(slug, locale)` builds `/work/[slug]` and
  `/pl/realizacje/[slug]` on top of the `work` route rather than a second
  hardcoded table — this is the closest existing precedent for how
  Insights' `[slug]` article route should be built.

### 1.2 Data & backend

- **Supabase** (Postgres + Auth + RLS), `@supabase/ssr` for
  cookie-based sessions, `@supabase/supabase-js` for the privileged path.
- Three Supabase client constructors, each with one job:
  - `createSupabaseServerClient()` — cookie/session-aware, publishable
    key, RLS applies. Used for admin auth checks.
  - `createSupabasePrivilegedClient()` — service-role key, **bypasses
    RLS**, server-only, never imported into anything that ships to the
    browser. This is the only path allowed to write lead tables.
  - A browser client (`src/lib/supabase/browser.ts`) for client-side use.
  - All three constructors return `null` when their env vars are absent,
    and every caller is written to degrade gracefully (admin shows "not
    configured" instead of crashing; forms don't claim to have persisted
    data they didn't). This "safe without a real backend" pattern is
    consistent everywhere and should be preserved for Insights.
- **Migrations** live at `supabase/migrations/NNN_description.sql`,
  applied in order, never edited after the fact — `002_lead_attribution.sql`
  already establishes the precedent of an additive migration on top of
  `001_initial.sql`. Insights' schema should be `003_insights_schema.sql`.
- **RLS pattern**: every table enables RLS; a `SECURITY DEFINER` helper
  (`public.is_active_admin()`) checks `user_roles` + `profiles.active`
  without recursive-policy problems, and is the thing every admin-only
  `select` policy calls. Public *writes* never go through RLS at all —
  they go through a Server Action that validates with Zod, then calls the
  privileged client. This is the security boundary the brief calls
  "public write model", and it's the correct model to copy for public
  article *reads* vs. admin article *writes*.
- **Roles** already modelled: `admin`, `editor`, `mentor`
  (`user_roles.role check (...)`). `editor` exists in the schema already
  but nothing currently uses it — it's the natural role for an Insights
  CMS author/publisher, so no new role enum value is needed.

### 1.3 Server/client component usage

- Server Components are the default; `"use client"` is applied narrowly
  (theme toggle, mobile menu, form inputs, analytics dispatch, consent
  banner) — not at the page level. Admin pages are `async` Server
  Components that fetch directly with the server Supabase client.
- Server Actions (`src/lib/actions/`) are the mutation boundary for public
  forms; a parallel versioned `POST /api/v1/leads` REST route calls the
  *same* extracted `src/features/leads/service.ts` core so the logic isn't
  duplicated. This "thin transport, shared service core" shape is the
  right template for Insights' publish/schedule/approve actions, which
  will need both a Server Action (admin UI) and, eventually, an API route
  (Content Intelligence engine writing drafts programmatically).

### 1.4 Existing admin

- `src/app/admin/(dashboard)/{page.tsx,leads/page.tsx}` +
  `admin/login/page.tsx`, gated by `admin/(dashboard)/layout.tsx` calling
  `getAdminSession()` and redirecting to `/admin/login` if absent.
  `getAdminSession()` requires **both** a role row and `profiles.active =
  true` — a deactivated staff account with a lingering role row is still
  denied. This is the auth gate Insights' `/admin/insights/**` must sit
  behind; it needs no new auth mechanism, only new nav items and an
  editor-vs-admin distinction where the brief calls for one (Decision 10:
  human approval required).
- Admin styling is `.admin-*` classes on top of the shared `globals.css`
  design tokens (not a separate stylesheet system) — small enough that a
  handful of new `.admin-*` rules for an Insights table/editor view can
  reasonably extend it, rather than requiring the full
  `src/styles/insights/` architecture (that's for the *public-facing*
  editorial pages, per the brief's own scoping).

### 1.5 SEO / metadata

- `src/lib/seo/metadata.ts`: `buildPageMetadata()` for standard pages,
  `buildProjectMetadata()` for the one existing dynamic-content type
  (case studies) — canonical + hreflang + `x-default` + OG/Twitter, all
  derived from `routes.ts`. Insights needs a third variant,
  `buildArticleMetadata()`, following the exact same shape but reading
  from article records instead of `routes.ts` + a static `Project[]`.
- `src/lib/seo/structuredData.ts`: `organizationSchema`, `websiteSchema`,
  `webPageSchema`, `serviceSchema`, `breadcrumbSchema` — deliberately
  **no `Person` schema anywhere** (no verified named-individual content
  exists yet) and **no per-offer `Service` schema on the Services hub**
  (documented as a scope boundary, not an oversight). The precedent this
  sets for Insights: only emit `Article`/`BlogPosting` JSON-LD fields that
  are genuinely true of a given article (real author, real date, real
  reading time) — never invented values to "complete" a schema.
- `src/app/sitemap.ts` iterates `routes.ts` for every static route, plus
  `getAllProjects()` for dynamic case-study slugs, each with per-locale
  `alternates.languages`. Insights articles are the second dynamic content
  type and slot into this exact same pattern
  (`getAllPublishedArticles()` → sitemap entries with hreflang pairs).
- `src/app/robots.ts` disallows `/admin/` and `/api/`. Draft/scheduled
  Insights articles must be excluded from the sitemap by publish-state
  filtering at the query level (never listed in the first place), not by
  a robots rule — the brief's "draft content is not indexed" requirement
  is best enforced at the data layer.

### 1.6 Analytics & consent

- `src/lib/analytics/events.ts` is the **only** place event-name strings
  are spelled out; every component calls a named function
  (`events.insightsView(...)`) rather than `dispatchEvent` with a raw
  string. `insights_view` and `insights_cta_click` events **already
  exist** in the taxonomy (added when the legacy placeholder Insights page
  was wired up) — Insights v2 should extend this file with
  `article_view`, `article_read_progress`, `article_cta_click`,
  `search_query`, etc., not invent a second taxonomy file.
- `src/lib/analytics/consent.ts` is the single `canLoad(category)` gate;
  `hasAnalyticsConsent()`/`hasMarketingConsent()` read one localStorage
  key. Anything Insights adds (e.g. a future recommendation-tracking
  script) must call `canLoad()`, never read consent state itself.
- A pluggable `AnalyticsProvider[]` registry already exists (GA4 + a
  first-party `/api/v1/analytics` sink) — article view/read-progress
  events flow through this for free once they're dispatched via
  `events.ts`; no new sink is needed for MVP.

### 1.7 Legacy Insights implementation

- `src/app/insights/page.tsx` → `InsightsPage` (English). **Correction to
  an earlier draft of this audit:** a Polish route at
  `src/app/pl/wiedza/page.tsx` already exists — it renders the same
  `InsightsPage` component with `locale="pl"`. So both locales had the
  placeholder; there was no missing Polish route to create from scratch,
  only content to replace at cutover (see Checkpoint 2 implementation
  notes in `INSIGHTS_ARCHITECTURE.md` §9).
- The entire "blog" is **three hardcoded post objects** inside the
  component file itself (`POSTS` array with inline gradient backgrounds
  as "cover images", hand-written EN/PL title/excerpt pairs, and a static
  date string). There is no article route, no database table, no CMS, no
  categories, no tags, no search — it is a static teaser grid ending in a
  "more articles are on the way" message.
- This confirms the master instruction's framing exactly: it is not a
  cosmetic redesign target, it is a placeholder to be **replaced**, not
  extended.

### 1.8 State management

No global client state library. Local `useState`/`useReducer` per
component, `localStorage` for consent/attribution/theme, cookies for
Supabase auth. Insights should follow the same minimalism — no Redux/
Zustand/etc. introduced for the CMS or reading UI.

---

## 2. Reusable assets

| Asset | Reuse | Why |
|---|---|---|
| `src/lib/routes.ts` (`RouteKey`, `Locale`, `routeFor`, `alternatePath`) | **Reuse directly**, extend with an `insightsCategory`/`insightsTag` pattern only if hub-level (not per-article) paths are needed | It's already the single source of truth for hub-level EN/PL pairs; article `[slug]` routes sit *under* `routes.insights[locale]` the same way case studies sit under `routes.work[locale]` |
| `caseStudyPath()` pattern | **Reuse the pattern, not the function** — write an analogous `articlePath(slug, locale)` | Same shape: a dynamic slug appended to a hub's locale path, not a second hardcoded table |
| `Header`, `Footer`, `SiteChrome`, `MobileMenu`, `LanguageSwitch`, `BackToTop` | **Reuse unchanged** | These are the "shared navigation/header/footer" the master instruction explicitly requires Insights to sit inside; they're already locale-aware via `routes.ts` and carry no Insights-specific coupling |
| `ThemeProvider` / `ThemeToggle` (`data-theme` attribute + CSS variables) | **Reuse unchanged** | Insights' own token layer (`src/styles/insights/tokens.css`) will be scoped variables layered on top of the existing `--ink-*`/`--surface-*`/`--signal` tokens, so dark/light both work with zero new logic |
| `src/lib/fonts.ts` (Bricolage Grotesque / Hanken Grotesk / IBM Plex Mono) | **Reuse unchanged** | Standing override already in place site-wide; an editorial blog is exactly where a display/body/mono type system pays off most, no reason to diverge |
| `buildPageMetadata()` | **Reuse for the Insights hub, category and tag pages** | Same canonical/hreflang/OG shape as every other hub page |
| `breadcrumbSchema()`, `webPageSchema()`, `organizationSchema()`/`websiteSchema()` | **Reuse unchanged** | Generic, accurate for any page including Insights |
| `PageHero` | **Reuse for the Insights index page only** (not for individual articles) | The index page is a hub like Services/Work; an individual article needs a richer `ArticleHero` (title, author, date, reading time, cover) that `PageHero`'s narrow eyebrow/H1/lede shape doesn't cover — better as a new, purpose-built component than bending a shared one with optional props |
| `is_active_admin()` SQL helper + RLS pattern | **Reuse unchanged** | Exactly the access model Insights needs: public `select` on published articles, admin/editor `select`+`write` on everything |
| `createSupabasePrivilegedClient()` / server client split | **Reuse unchanged** | Public article reads can go through RLS directly (no privileged client needed, unlike lead writes); CMS writes reuse the existing server-session client since editors are authenticated, not anonymous |
| `src/lib/validation/schemas.ts` pattern (Zod, server boundary is the real boundary) | **Reuse the pattern**, add a new `src/features/insights/**` schema file | Same "client validation is a courtesy" philosophy applies to article/category/tag forms in the CMS |
| `src/lib/analytics/events.ts` + `consent.ts` + provider registry | **Extend, don't replace** | `insights_view`/`insights_cta_click` already exist; add article-level events to the same file so there is still exactly one taxonomy |
| `MotionSystem` delegated `external_link_click` listener | **Reuse unchanged** | Already covers every outbound link on every page automatically, including future article body links |
| `SectionReveal` (`IntersectionObserver`-based reveal) | **Reuse for hub-level sections** (featured/latest/pillars grids); **do not force it inside article body copy** | Matches "subtle reveal" guidance for listing pages; heavy scroll-triggered animation inside long-form reading content would work against the "calm, editorial" design direction |

---

## 3. Things that should NOT be reused

- **`InsightsPage.tsx` and its `POSTS` array** — this is the legacy
  placeholder itself. It stays live (per the migration strategy below)
  until the new system is functional, then is deleted outright. Nothing
  in it (hardcoded post shape, inline gradient "covers") should be
  carried into the new architecture even superficially — it was never
  designed to hold real content.
- **Global `globals.css` (507 lines) as a place to add Insights rules.**
  It is currently a reasonably-sized, single shared stylesheet for the
  whole marketing site's chrome (nav, buttons, hero, cards, admin). It has
  no CSS Modules anywhere in the codebase today — Insights will be the
  **first** part of the app to introduce `*.module.css`, exactly as the
  master instruction specifies (Decision 5). Adding article/editorial
  rules to `globals.css` instead would immediately violate rule §7.2 of
  the brief ("do not pollute the main CCS global CSS") and reintroduce
  the specificity/naming risk CSS Modules exist to avoid.
- **Admin dashboard's ad hoc inline `style={{ ... }}` props**
  (`admin/(dashboard)/page.tsx`, `leads/page.tsx`). These work for two
  small, static admin screens but do not scale to an article editor with
  meaningfully more UI surface (status pills, scheduling controls, block
  editor). New Insights admin screens should use real `.admin-*` classes
  or scoped CSS Modules, not more inline styles, so the admin area
  doesn't fork into two inconsistent styling approaches.
- **The three-table lead-form Zod/Server-Action trio as a literal
  template for articles.** The *pattern* (Zod schema → Server Action →
  privileged client) is worth reusing (see above), but leads are
  single-shot, anonymous, write-only submissions; articles are
  authenticated, versioned, multi-state (draft/scheduled/published/
  archived) content with reads by the public and writes by editors. Copying
  the lead-form shape literally would under-model status transitions and
  revision history that a CMS needs from day one.
- **Any of the round-5 CRO/Analytics/Martech `features/experiments/`
  scaffold, as a dependency.** It exists but is explicitly not wired into
  any component yet (no production deployment, no analytics baseline to
  test against). Insights must not take a hard dependency on it turning
  on — if it's used at all (e.g. later A/B-testing an article layout),
  it's additive and Insights must work identically with it absent.

---

## 4. Risks

### Routing
- **`/pl/insights` does not exist today** even though `routes.ts` defines
  `insights: { pl: "/pl/wiedza" }`. Building the Polish Insights tree is
  not "add a locale to an existing page", it's a net-new route — lower
  risk than a rename, but must not be skipped as "already there".
- **Route collisions**: `category/[slug]` and `tag/[slug]` under
  `/insights/` are new dynamic segments in a part of the tree that
  currently has none. Next.js will error at build time on any genuine
  slug collision (e.g. a category and a tag sharing a slug, or a category
  slug colliding with a real article slug) — the data layer must enforce
  slug uniqueness *across* articles/categories/tags within a locale, not
  just uniqueness within each individual table.

### CSS
- Introducing `src/styles/insights/tokens.css` risks **token name
  collisions** with `src/styles/tokens.css` if Insights invents new
  variable names that shadow existing ones (e.g. another `--surface`).
  Mitigation: Insights tokens should be additively namespaced
  (`--insights-content-width`, `--insights-prose-*`) and only ever *read*
  the existing `--ink-*`/`--surface-*`/`--signal`/`--spark` tokens, never
  redefine them.
- Long-form article typography (line-length, vertical rhythm) has no
  existing precedent in this codebase — every current page is short
  marketing copy, not prose. `src/styles/insights/typography.css` is new
  ground, not an extension of anything, and needs deliberate design
  rather than borrowing existing card/hero rules.

### Locale
- The "conceptual location preserved across languages" rule
  (`alternatePath()`) assumes a 1:1 hub mapping. Individual articles won't
  always have a 1:1 EN/PL pair on day one (a Polish article might not
  exist yet for a freshly published English one, or vice versa). The
  language switcher's current behavior (always resolve to the equivalent
  path) will need an explicit fallback for articles without a translation
  yet — this is a real design decision for `INSIGHTS_ARCHITECTURE.md`,
  not just an edge case to patch later.

### Middleware
- Low risk: the existing middleware's locale-header logic is a pure path-
  prefix check and doesn't care about what's under `/insights/`. The
  `/admin` cookie-refresh branch already covers `/admin/insights/**`
  automatically since it matches on `/admin` as a prefix.

### Database / migrations
- `supabase/migrations/002_lead_attribution.sql` is additive on top of
  `001_initial.sql` and has **never been run against a real Supabase
  instance** in this sandbox (no npm/network access, stated explicitly in
  the existing migration's own header comment). The Insights schema
  (`003_insights_schema.sql`) inherits this same "unverified against a
  real Postgres instance" risk — it must be reviewed and dry-run before
  being applied to any real project, same caveat the existing migrations
  already carry.
- RLS policy risk specific to content: a naive `select` policy that
  allows "everyone" to read `articles` would also expose drafts and
  scheduled-but-unpublished content to anyone with the anon key who
  queries Supabase directly (not just through the Next.js app). The
  public `select` policy must filter on `status = 'published' AND
  published_at <= now()` **in the policy itself**, not rely on the
  Next.js query layer to always remember the filter.

### Duplicate sitemap logic
- Real risk if not handled carefully: `src/app/sitemap.ts` currently
  builds its entries from two sources (`routes.ts` static keys +
  `getAllProjects()`). Adding Insights articles as a third source is
  mechanically easy, but article `updatedAt`/`lastmod` and
  `changeFrequency` need real values from the content table — copying the
  static `monthly`/`0.6` defaults used for marketing pages would
  understate how often published articles actually change, and overstate
  it for archived ones.

### Admin authentication
- No new risk introduced by reusing `getAdminSession()`, **provided**
  Insights CMS routes actually sit under `src/app/admin/insights/**`
  (matching the existing `/admin` middleware/layout gate) rather than a
  new top-level path that would bypass both the middleware's cookie
  refresh and the layout's redirect check.
- The brief calls for `editor` as a role distinct from `admin`
  (Decision 10 — human approval). The schema already has an `editor`
  enum value but `getAdminSession()` today only checks for
  `roles.includes("admin")`. This function will need a second check (or a
  parametrized `requireRole()`) so an `editor` can be let into
  `/admin/insights/**` without being treated as a full `admin` — this is
  a real, if small, code change and is called out explicitly here so it
  isn't missed as "already handled".

---

## 5. Proposed migration strategy

**Superseded — see `INSIGHTS_ARCHITECTURE.md` §9, item 1.** This section
described a staged cutover appropriate for a live, deployed application.
Since this app has never been deployed or run (confirmed in `README.md`),
Checkpoint 2 was built as a direct replacement instead: both legacy pages
were replaced in place and `InsightsPage.tsx` was deleted once the new
routes were verified. Kept below for the original reasoning, in case a
future round needs the staged approach for some other feature.

1. **Do not touch `src/app/insights/page.tsx` or `InsightsPage.tsx`
   during Checkpoint 2 (Blog foundation) or Checkpoint 3 (CMS).** Build
   the new system at a temporary internal path (or behind a feature flag
   read at build/request time) so both can exist simultaneously without
   the legacy page competing for the same route.
2. Once the new Insights hub, article route, EN/PL parity, and at least
   one real published article are verified end-to-end (Checkpoint 2 exit
   criteria), **cut over the route**: replace the content of
   `src/app/insights/page.tsx` to render the new hub instead of
   `InsightsPage`, and add the missing `src/app/pl/insights/page.tsx`.
3. Only after the cutover is confirmed working should `InsightsPage.tsx`
   and its `POSTS` array be deleted. Until then it remains as inert,
   unrouted code (or is deleted immediately at cutover — either is fine;
   what must not happen is deleting it *before* the replacement route
   exists and is verified).
4. Navigation (`Header`/`MobileMenu`) already links to the `insights`
   `RouteKey`, not to the file directly — so no navigation change is
   needed at cutover; the link keeps working, its destination just gets
   richer.
5. Sitemap/robots need no interim special-casing: the legacy static page
   was already indexable and stays that way until cutover; the new
   article routes are added to the sitemap as they're built, gated by the
   RLS-level "published only" filter described above so nothing in-
   progress leaks into search results before cutover.

---

## 6. Summary for Checkpoint 1 sign-off

The existing application is a clean, deliberately-scoped Next.js 16 +
Supabase site with consistent conventions (single routes table, safe-
without-backend fallbacks, RLS + service-role split, one analytics
taxonomy file, one consent gate). The legacy Insights page is confirmed to
be exactly what the master instruction assumes: a static three-post
placeholder with no CMS, no database, and no Polish route — safe to fully
replace, not adapt. No blocking architectural conflicts were found between
the existing app and the target Insights architecture; the main real
decisions still open are the editor-vs-admin role check, the EN/PL
article-parity fallback, and the sitemap `lastmod` source — all captured
above and carried into `INSIGHTS_ARCHITECTURE.md`.
