# Attribution

How a visitor's marketing source gets from "clicked a campaign link" to
"attached to the lead an admin sees" — and why it's first-touch, not
last-touch.

## First-touch, not last-touch

`src/features/attribution/storage.ts`'s `captureFirstTouchAttribution()`
is the whole model:

- **Nothing stored yet, no UTM params in the URL** → record `source:
  "direct"` / `medium: "none"` (or, if a referrer exists, that referrer's
  hostname as `source` and `medium: "referral"`).
- **Nothing stored yet, UTM params present** → record them.
- **Something already stored, current visit carries no fresh UTM params**
  → **do nothing**. A plain repeat visit must never silently overwrite the
  original first touch.
- **Something already stored, current visit carries fresh UTM params** →
  re-attribute `source`/`medium`/`campaign`/`content`/`term` to the new
  campaign, but keep the *original* `referrer`, `landingPage`, and
  `capturedAt` — those describe the first visit, which a later campaign
  click doesn't retroactively change.

This is deliberately not last-touch (overwrite on every visit) — the brief
asks for first-touch as the initial model, extensible to other attribution
models later. If a last-touch or multi-touch model is ever needed, it's an
additional storage key and a second capture function, not a rewrite of
this one.

## Where it's captured

`<AttributionCapture />` mounts once from the root layout, calls
`captureFirstTouchAttribution()` in a mount-only effect, and renders
nothing. It's a separate tiny client component (not folded into
`MotionSystem` or the layout itself) so it can be reasoned about and
tested in isolation — see
`src/features/attribution/__tests__/captureFirstTouchAttribution.test.ts`.

`parseUtmParams()` and `hasUtmParams()` are pure functions (no `window`
access) — see `src/features/attribution/__tests__/parseUtm.test.ts`.

## Storage

`localStorage`, key `ccs-attribution`, written only by
`storeAttribution()` inside `storage.ts` — nothing else in the app should
touch that key directly. Best-effort: a write failure (private browsing,
quota) is caught and swallowed; attribution is enrichment, never a reason
to block a visit or a form submission.

## Where it goes

Two destinations, both consent-aware in different ways:

1. **Every analytics event's context.** `getBaseContext(pathname)` (see
   docs/ANALYTICS.md) pulls `campaign`/`source`/`medium`/`referrer` from
   stored attribution into every `events.*` call. This only reaches GA4 or
   the first-party sink once that event actually dispatches — which only
   happens with analytics consent granted (`hasAnalyticsConsent()`). So
   attribution data is never sent anywhere *on its own*; it only rides
   along on an event that was already going to fire.
2. **Lead submissions.** `<AttributionFields />` reads the stored
   attribution client-side and renders it as seven hidden form inputs
   (`attr_source`, `attr_medium`, `attr_campaign`, `attr_content`,
   `attr_term`, `attr_referrer`, `attr_landing_page`) inside every lead
   form. Server Actions can't read `localStorage` directly, so this is the
   bridge. `attributionFromFormData()` in `src/lib/actions/leads.ts`
   reconstructs the object server-side (returns `undefined` if none of the
   hidden fields were populated, rather than submitting an all-empty
   object). This path is independent of analytics consent — a visitor
   filling out a contact form has already chosen to share their details;
   attaching where they came from to that same enquiry is not a separate
   tracking decision.

## Database

`supabase/migrations/002_lead_attribution.sql` adds `utm_source`,
`utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `referrer`, and
`landing_page` columns (plus an index on `utm_source`) to all three lead
tables — `project_leads`, `marketing_enquiries`, `mentoring_enquiries`.
`src/features/leads/service.ts`'s private `attributionColumns()` helper is
the one place that maps the camelCase attribution shape to those
snake_case columns.

## Validation

`attributionSchema` in `src/lib/validation/schemas.ts` — every field
optional and length-bounded, embedded as `attribution: attributionSchema`
in all three lead schemas. It rides along on a form the visitor is already
submitting; it's never collected as its own standalone submission.

## Extending to a new attribution model

Everything above is scoped to `src/features/attribution/`. A future
last-touch or multi-touch model would add its own storage key and capture
function there, without needing to change `AttributionFields.tsx`, the DB
columns, or the lead schemas — those already treat "attribution" as one
opaque, optional object.
