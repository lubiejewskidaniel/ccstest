# SEO & AEO

Technical SEO architecture: metadata, structured data, hreflang, sitemap,
and a few deliberate scope boundaries.

## Metadata: one helper, not thirty duplicated blocks

Before this pass, all 30 `page.tsx` files (15 routes × EN/PL) hand-wrote
their own `alternates.canonical` / `alternates.languages` pair. That
duplicated data that already lives once in `src/lib/routes.ts` — a missed
edit there could silently break hreflang for one language of one page with
nothing catching it.

`src/lib/seo/metadata.ts` exports `buildPageMetadata()`:

```ts
export const metadata = buildPageMetadata({
  routeKey: "services",
  locale: "en",
  title: "Services",
  description: "…",
});
```

It looks up the canonical path and both-language hreflang pair from
`routes.ts` (plus `x-default`, pointing at the English version — the
site's default locale), and builds matching Open Graph / Twitter Card
metadata. The plain `title` stays short so the root layout's title
template (`"%s · Code Consulting Studio"`) still applies to the `<title>`
tag; OG/Twitter titles get the full `"<title> · Code Consulting Studio"`
string directly, since those surfaces don't apply a template.

Pass `noindex: true` for a page that shouldn't be indexed. Admin routes
don't use this helper at all — they set `robots: { index: false, follow:
false }` directly, since they have no bilingual pair to build hreflang for.

A small script cross-checked every one of the 30 page files against
`routes.ts` (correct `routeKey`, correct `locale`, correct resulting file
path) before this landed — see the verification note in `docs/AUDIT.md`.

## Structured data (JSON-LD)

`src/lib/seo/structuredData.ts` + `src/components/seo/JsonLd.tsx` +
`src/components/seo/PageStructuredData.tsx`. Site-wide `Organization` and
`WebSite` schemas render once, from the root layout. Every page adds:

- `WebPage` — always.
- `BreadcrumbList` (Home → current page) — every route except the homepage.
- `Service` — **only** on the Growth and Mentoring pages, each describing
  exactly one accurately-scoped offer.

### Deliberately not implemented

The brief is explicit that structured data must be "valid... never
misleading" (§12). Two things are scoped out rather than approximated:

- **`Person` schema** — no page in this app currently publishes a real,
  verified named individual (founder/team bio with a real name and role).
  Inventing one to check a box would violate the same accuracy requirement
  the brief sets. Add it once that content exists.
- **`Service` schema on the Services hub page** — that page lists six
  offerings at once (Software Development, Product Development, Technology
  Consulting, Web & Digital, Growth & Marketing, Mentoring). Emitting six
  `Service` entries would mean duplicating the CAPS catalog that currently
  lives only inside `ServicesPage.tsx` (icons and all) into the metadata
  layer — a bigger data-modeling change than "add structured data" should
  require. The Growth and Mentoring pages get `Service` schema because
  each describes exactly one offer already. Follow-up: extract a shared,
  non-JSX service catalog (key/title/description) that both the UI and the
  metadata layer import from, then extend the Services hub page similarly.

## Hreflang & bilingual routing

`src/lib/routes.ts` remains the single source of truth for every URL pair.
`buildPageMetadata()` reads from it for page-level hreflang;
`src/app/sitemap.ts` reads from the same map for sitemap-level
`alternates.languages`. There's exactly one place either could drift from
the actual route map, and it isn't either of those two files.

## Sitemap & robots

`src/app/sitemap.ts` and `src/app/robots.ts` were already correct going
into this pass — one entry per route key with bilingual alternates,
`/admin` and `/api` disallowed. No changes were needed here (see the
Phase 1 audit, `docs/AUDIT.md`).

## Redirects

**Deferred, not forgotten.** There is nothing to redirect from — this is
the first deployed version of this URL structure, so no legacy paths exist
yet. When a URL changes after launch, add the redirect to `next.config.ts`
(or middleware, if the volume grows) as a 308 (permanent, preserves
method) rather than a 302, and avoid chaining more than one redirect for
the same path.

## Core Web Vitals

**Deferred to a real build.** Every Lighthouse/CWV number depends on a
production `next build` + a real hosting environment, neither of which
this sandbox has (no npm registry access — see the README's "before you
run this" note). Once a build exists: measure before optimizing, and never
trade an accessibility regression for a Lighthouse score (brief §16 is
explicit that this doesn't count as a successful optimization even if the
number improves).

## AEO — human-first, direct-answer content

This is a content-authoring guideline, not a code module. When writing or
editing page copy:

- Answer the likely question in the first sentence or two of a section,
  not buried after three paragraphs of preamble.
- Prefer real headings and short paragraphs an answer engine can extract
  cleanly over dense marketing copy.
- Don't pad a page with a large FAQ block whose "questions" are really
  just section headers restated as questions — the brief specifically
  warns against "repetitive FAQ spam." A short, genuine FAQ (a handful of
  things people actually ask that aren't already answered by the page
  body) is fine.

## Internal linking

The homepage → Services hub → individual capability CTAs → Contact is now
a real, clicked-and-tracked path (see docs/ANALYTICS.md's
`service_cta_click`). **Deferred:** deeper internal linking from Insights
articles into service pages — there are only three static placeholder
articles today (see the README's "what's genuinely not built yet"), so
there's no real content to link from without inventing copy that doesn't
exist. Once Insights has real, individually-routed articles, link each one
to the service(s) it's actually about.
