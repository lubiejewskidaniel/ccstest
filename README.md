# Code Consulting Studio — Web Platform

The full CCS marketing site and lead-capture platform: bilingual (EN/PL),
four-mode brand architecture (BUILD / CREATE / GROW / TEACH), Next.js 16
App Router + Supabase, built against the `CCS_Software_Engineering_
PreDevelopment_Specification_v4` documentation set.

## ⚠️ Before you run this

This project was hand-written in a sandboxed environment **with no access
to the npm registry**, so `npm install`, `next build` and `next dev` have
**not been run or verified here**. The code is internally consistent (every
import was checked to resolve, every component's props match its callers)
but you are the first real build. Expect the normal amount of first-build
friction — a missing type tweak, a Next.js 16 API that shifted slightly —
rather than a fundamentally broken structure.

```bash
npm install
cp .env.example .env.local   # fill in real values, see below
npm run dev
```

Recommended before your first commit: `npm run typecheck && npm run lint`.

## Tech stack

- **Next.js 16** (App Router, Server Actions, Server Components by default)
- **React 19**
- **TypeScript 5.9**, strict mode
- **Supabase** — Postgres, Auth, Row Level Security
- **Zod** — the single source of truth for form validation, shared between
  client-side hints and the server-side boundary
- Hand-rolled CSS design system (no Tailwind, no component library) — see
  [Design system](#design-system--why-not-the-docs-default-fonts) below
- No animation library — scroll reveals, the hero signal field, card tilt,
  the boot curtain etc. are plain `IntersectionObserver` /
  `requestAnimationFrame` / CSS transitions (see `src/components/
  MotionSystem.tsx` and `src/components/SectionReveal.tsx`)

## Project structure

```
src/
  app/                  Route files only — thin wrappers that pick a
                         locale, build metadata via buildPageMetadata(),
                         and render a feature component
    pl/                 Every Polish route lives under here
    admin/(dashboard)/   Auth-gated admin routes (route group, no URL segment)
    admin/login/        Public admin sign-in
    api/v1/leads/        Versioned JSON lead API (mirrors the Server Actions)
    api/v1/analytics/    First-party event sink
    sitemap.ts, robots.ts, not-found.tsx, layout.tsx
  components/
    seo/                 JsonLd, PageStructuredData
    analytics/           GoogleAnalytics, ThirdPartyScript, TrackedCtaLink,
                         FireViewEvent
    consent/              CookieConsent banner
    Shared chrome: nav, theme, motion, PageHero
  features/
    home/                Homepage sections (Hero, Capabilities, ...)
    pages/               Hub page content (Services, Work, Products, ...)
    forms/               Contact + mentoring forms and their page wrappers
    legal/               Privacy/Cookies/Terms/Accessibility/Academic
                         integrity content
    admin/               Admin login form
    attribution/          First-touch UTM/referrer capture (docs/ATTRIBUTION.md)
    leads/                Shared lead validation+persistence service, used by
                         both the Server Actions and the /api/v1/leads route
    experiments/          Bucketing + useExperiment scaffold — not yet wired
                         into any component (docs/EXPERIMENTATION.md)
  lib/
    routes.ts            EN/PL route map — the single source of truth for
                         every URL in the app
    validation/schemas.ts Zod schemas for all three lead forms + attribution
    actions/leads.ts      Server Actions — thin FormData adapters over
                         features/leads/service.ts
    actions/adminAuth.ts  Admin sign-in/out Server Actions
    supabase/             browser.ts / server.ts / privileged.ts / adminAuth.ts
    analytics/             Central analytics abstraction — events.ts (the
                         typed taxonomy), track.ts, consent.ts, context.ts
                         (docs/ANALYTICS.md, docs/CONSENT_TRACKING.md)
    seo/                   buildPageMetadata() + JSON-LD builders
                         (docs/SEO_AEO.md)
    crm/                   CRMProvider interface + HubSpot adapter
                         (docs/LEAD_MANAGEMENT.md)
    rateLimit.ts           In-memory limiter for the public API routes
    email.ts              Optional Resend notification on new leads
  styles/                tokens.css (design tokens, light/dark) +
                         globals.css (every component's CSS)
supabase/migrations/
  001_initial.sql          Schema + RLS (unverified — see below)
  002_lead_attribution.sql  UTM/referrer/landing-page columns on lead tables
```

## Routes

Every route exists in both languages via `src/lib/routes.ts`, which is also
what the language switcher, sitemap and every internal `<Link>` read from —
there is no second, hand-maintained list to fall out of sync.

| Key | EN | PL |
|---|---|---|
| home | `/` | `/pl` |
| services | `/services` | `/pl/uslugi` |
| work | `/work` | `/pl/realizacje` |
| products | `/products` | `/pl/produkty` |
| growth | `/growth` | `/pl/marketing` |
| mentoring | `/mentoring` | `/pl/mentoring` |
| mentoringEnquire | `/mentoring/enquire` | `/pl/mentoring/zapytaj` |
| insights | `/insights` | `/pl/wiedza` |
| about | `/about` | `/pl/o-nas` |
| contact | `/contact` | `/pl/kontakt` |
| privacy | `/privacy` | `/pl/prywatnosc` |
| cookies | `/cookies` | `/pl/cookies` |
| terms | `/terms` | `/pl/regulamin` |
| accessibility | `/accessibility` | `/pl/dostepnosc` |
| academicIntegrity | `/academic-integrity` | `/pl/integrity` |

Plus `/admin/login` and `/admin` (+ `/admin/leads`), both `noindex`.

## Environment variables

See `.env.example`. Every server-only value falls back gracefully when
unset rather than crashing:

- No Supabase env vars → lead forms still render and validate, but log a
  warning and don't persist (`console.warn("[leads] Supabase not
  configured...")`) — useful for local UI work without a real database.
- No `RESEND_API_KEY` / `LEAD_NOTIFY_EMAIL` → the notification email
  silently no-ops.
- No `NEXT_PUBLIC_GA_MEASUREMENT_ID` → the GA4 script never loads, cookie
  banner still works.
- No `CRM_API_KEY` / `CRM_PORTAL_ID` → CRM sync resolves to a silent no-op
  provider (see `docs/LEAD_MANAGEMENT.md`).

`SUPABASE_SERVICE_ROLE_KEY` is the one value that must **never** reach the
browser — it's only imported from `src/lib/supabase/privileged.ts`, which
is only ever called from Server Actions.

## Database

Apply `supabase/migrations/001_initial.sql`, then `002_lead_attribution.sql`,
to a Supabase project (`supabase db push` or paste each into the SQL
editor, in order). `001_initial.sql` creates:

- `profiles`, `user_roles` — staff/admin accounts
- `project_leads`, `marketing_enquiries`, `mentoring_enquiries` — the three
  lead tables, RLS-enabled, no public read or write policy (all public
  writes go through the service-role client inside a Server Action; all
  admin reads go through an `is_active_admin()` SECURITY DEFINER helper)

To create your first admin: sign a user up via Supabase Auth (dashboard or
`supabase.auth.admin.createUser`), then insert matching rows into
`profiles` (`active = true`) and `user_roles` (`role = 'admin'`).

`content_items`, `content_approvals` and `channel_connections` (doc 08 §1,
marked FUTURE) are intentionally not created yet — add them in a later
migration when that phase starts.

## CRO, SEO/AEO, analytics & martech

A second engineering pass added measurement, attribution, lead-pipeline
hardening, SEO structure, and experimentation groundwork on top of the
platform above, per a dedicated implementation brief. Six docs cover it in
depth — start with whichever matches what you're touching:

- [`docs/ANALYTICS.md`](docs/ANALYTICS.md) — the central analytics
  abstraction, the typed event taxonomy, and how to add an event or a
  provider.
- [`docs/SEO_AEO.md`](docs/SEO_AEO.md) — the metadata helper, structured
  data, hreflang, and what's deliberately scoped out (a `Person` schema,
  per-offer `Service` schema on the Services hub).
- [`docs/ATTRIBUTION.md`](docs/ATTRIBUTION.md) — the first-touch UTM/
  referrer model and how it reaches both analytics events and lead
  records.
- [`docs/LEAD_MANAGEMENT.md`](docs/LEAD_MANAGEMENT.md) — the shared lead
  service behind both the Server Actions and `/api/v1/leads`, rate
  limiting, and CRM sync.
- [`docs/CONSENT_TRACKING.md`](docs/CONSENT_TRACKING.md) — the consent
  categories, the single `canLoad()` gate, and what's actually
  consent-gated vs. always-collected.
- [`docs/EXPERIMENTATION.md`](docs/EXPERIMENTATION.md) — the bucketing
  scaffold and the rollout checklist for when a real experiment is ready
  (**no experiment is live in this app**).

[`docs/AUDIT.md`](docs/AUDIT.md) is the Phase 1 audit this whole pass was
staged against — a KEEP/CHANGE/ADD/REMOVE/DEFER verdict per area of the
brief, including what was deliberately deferred and why (Core Web Vitals
work needing a real build, redirect management having nothing to redirect
from yet, and others).

## Testing

`npm test` runs the Vitest suite (`npm run test:watch` for watch mode).
Coverage: lead-schema validation (happy path + rejection cases), UTM
parsing and first-touch attribution persistence, consent storage/gating,
the analytics event taxonomy's exact payload shape, `buildPageMetadata()`'s
canonical/hreflang/OG output, the HubSpot CRM adapter (mocked `fetch`),
the rate limiter's sliding window, and experiment bucketing determinism.

**Unverified in this sandbox**, same caveat as the rest of the build (see
"Before you run this" above) — no npm registry access here means `vitest`
and `jsdom` were never actually installed or run. The suite was written
against the real source and hand-traced test-by-test against each
function's actual logic (documented inline in a couple of the trickier
attribution tests), but you are the first real run.

## Design system — why not the docs' default fonts

The brand documentation's baseline suggestion was Inter + JetBrains Mono.
This build deliberately overrides that with **Bricolage Grotesque**
(display), **Hanken Grotesk** (body) and **IBM Plex Mono** (data/eyebrows/
tags) — a specific, repeated instruction from the person who commissioned
this build, who wanted the site to read as an intentionally designed
system rather than a generic "AI-generated" look. Everything else — the
Engineered Light / Signal Path color tokens, the four-mode architecture,
the bilingual route structure — follows the documentation as written.

Illustrations (project mockups, the mentoring feature panel, insight card
art) are original inline SVG rather than stock photography, for the same
reason.

## Pragmatic simplifications (documented, not accidental)

- **The hero is always dark**, independent of the site-wide theme toggle —
  `.hero` redeclares the dark token values scoped to itself in
  `globals.css`. Doing full light-theme parity for every hero illustration
  was out of scope for this pass; the rest of the site fully supports
  system/dark/light.
- **`<html lang>` is corrected client-side** (`MotionSystem`'s
  pathname-driven effect) rather than via a `[locale]` route segment,
  since Next.js only allows one root layout/`<html>` per app and the
  route scheme here uses literal paths (`/pl/...`), not a dynamic segment.
- **Insights is a static index**, not a full CMS-backed blog — doc 15
  marks content management as a Phase 2 admin module; the three articles
  shown are real copy, not lorem ipsum, but there's no per-article route
  yet.
- **Admin is intentionally minimal** — sign-in, an overview with lead
  counts, and a read-only recent-leads table. Filtering, status, notes,
  assignment and audit logging are explicitly Phase 2 (doc 15 §2).

## What's genuinely not built yet

- Phase 2 admin modules (lead status/notes/assignment, bilingual content
  management for services/work/products/insights, SEO field controls,
  audit log)
- Individual Insights article pages/CMS
- Growth client portal and mentoring booking/payment portal (both FUTURE
  per doc 15 §3–4)
- A behaviour-analytics vendor (Crazy Egg, Hotjar, etc.) — the
  consent-gated loader exists (`ThirdPartyScript.tsx`) but nothing is
  contracted or configured; see `docs/CONSENT_TRACKING.md`
- `Person` JSON-LD and per-offer `Service` JSON-LD on the Services hub
  page — both deliberately scoped out until the underlying content exists;
  see `docs/SEO_AEO.md`
- Any live A/B experiment — `docs/EXPERIMENTATION.md`'s scaffold is
  wired to nothing; the brief is explicit this shouldn't launch before
  baseline analytics is trustworthy in production
- Core Web Vitals measurement/optimization — needs a real `next build` and
  a real hosting environment, neither of which exist in this sandbox
- A real, populated legal review of the Privacy/Terms/Cookies/Accessibility
  pages — they're accurate to how the *code* behaves, but doc 12 §3
  explicitly requires the actual operating entity, contact details,
  retention periods and lawful bases to be confirmed by qualified counsel
  before launch. Each legal page carries a visible template notice until
  that happens.

## Homepage-only static build

An earlier, purely static (no framework) version of just the homepage
still exists for reference/comparison — see the sibling `ccs-website/`
folder if it was delivered alongside this one, and the live Artifact
published during that phase of the work.
