# Phase 1 Audit — CRO/SEO/AEO/Analytics/Martech Change Request

Reviewed against the existing `ccs-app/` source tree as delivered in the
previous round (homepage, 7 hub pages, 2 lead forms, 5 legal pages, minimal
admin, Supabase schema — all EN/PL). Verdict per affected area, using the
brief's own KEEP/CHANGE/ADD/REMOVE/DEFER vocabulary (§30 Phase 1).

## 3. Conversion architecture
**CHANGE.** Every commercial page already has a primary CTA (`btn-primary`)
pointing at Contact or the mentoring enquiry form, and hub pages generally
have one clear path. What's missing: CTAs aren't measurable yet (no click
events), and a couple of secondary-CTA opportunities are thin (e.g.
Services hub has no per-capability CTA beyond the shared page-level one).
No dark patterns or pop-ups exist today — nothing to remove there.

## 4–6. Analytics event architecture, taxonomy, context
**CHANGE + ADD.** `src/lib/analytics.ts` already implements the right
*shape* — a single `trackEvent()` choke point, consent-gated, with a
hand-picked `events` object — but it's a flat file with only 6 ad-hoc
event names tied to form lifecycle, no shared context envelope (page,
locale, cta_location, campaign/source/medium), and no typed taxonomy
contract. Restructuring into `src/lib/analytics/{index,events,track}.ts`
(same import path, so nothing else needs to change) and expanding the
taxonomy is the Phase 2a work.

## 7. Funnel measurement
**ADD.** No blocker — once `service_view`/`service_cta_click`/
`contact_form_start`/`contact_form_submit` exist as real events with
consistent naming, funnel math is a GA4/warehouse-side concern, not
something the app needs to compute. Nothing to build beyond emitting the
events correctly.

## 8. Lead capture architecture
**CHANGE.** Forms already go through Server Actions → Zod validation →
service-role Supabase insert → best-effort Resend notification — i.e. the
brief's conceptual flow already exists, just not behind a versioned
`/api/v1/leads` endpoint and without UTM/landing-page columns. Phase 2c
extracts the shared logic into `src/features/leads/service.ts` and adds
the API route as an additional entry point, rather than replacing the
working Server Actions (§2: don't rewrite working functionality).

## 9. Attribution
**ADD.** Nothing exists yet. Phase 2b.

## 10–14. SEO/AEO, bilingual SEO, structured data, internal linking, AEO
**CHANGE + ADD.** Every page already ships unique title/description via
Next Metadata, and `alternates.languages` is hand-written per page — but
duplicated by hand 33 times, which is exactly what §10 says to avoid.
`sitemap.ts`/`robots.ts` already exist and are correct. No JSON-LD
anywhere yet. Internal linking is already reasonably dense (hub pages
cross-link to Contact/Mentoring-enquire; footer covers all hubs) but
Insights → Services/Work linking (the brief's own worked example) doesn't
exist because Insights articles aren't real pages yet (documented gap
from the previous round). AEO content structure (direct-answer headings)
is partially present in hub page copy but wasn't written with AEO
intent — acceptable for now, DEFER a full content rewrite pass.

## 15. Redirects
**DEFER.** No prior deployed version of this app exists, so there are no
real old URLs to redirect from yet. Add the `redirects()` scaffold and
document the policy so the *next* URL change has somewhere to go.

## 16–17. Performance, Core Web Vitals
**DEFER to Phase 4.** Can't be meaningfully measured without a real
build/deploy (this sandbox can't run `next build`). Flagging now: the
homepage hero ships a non-trivial client bundle (Hero.tsx canvas/SVG
animation) — worth a bundle-size check once buildable, but not blocking
this phase.

## 18. Behaviour analytics readiness
**ADD (light).** `GoogleAnalytics.tsx` already demonstrates the
consent-gated third-party script pattern; formalizing it as a reusable
`ThirdPartyScript` wrapper (Phase 2d) makes adding Crazy Egg or similar
later a one-line addition rather than a new bespoke component.

## 19. Consent and cookies
**KEEP, CHANGE (light).** `CookieConsent.tsx` + `src/lib/analytics.ts`
already implement Necessary/Analytics/Marketing categories with
consent stored centrally and nothing loading before consent — this
already matches the brief's requirement well. Add a `canLoad(category)`
helper so future scripts don't reimplement the check inline.

## 20. CRM/HubSpot readiness
**ADD.** Nothing exists. Phase 2d — `CRMProvider` interface,
`NoopProvider` default, `HubSpotProvider` behind env vars, called from
the lead service only (never from the UI).

## 21–22. Experimentation
**ADD (scaffold only).** No experiment code exists, and none should run
yet per the brief's own Phase 6 gate ("do not start A/B testing before
baseline measurement is reliable"). Build the bucketing/event scaffold
now so it's available later without a redesign.

## 23. Feature structure
**CHANGE (partial).** Existing structure already separates `app/`,
`components/`, `features/`, `lib/` — the brief's proposed structure is
compatible. New code lands in `lib/analytics/`, `lib/crm/`, `lib/seo/`,
`lib/experiments/`, `features/attribution/`, `features/leads/`,
`app/api/v1/leads/`, `app/api/v1/analytics/` (this last one is a stub —
see Phase 2a). Existing working files (routes.ts, validation/schemas.ts,
supabase/*) are NOT renamed to fit the proposed tree — no architectural
problem forces that, so per §2 they stay put.

## 24. Environment configuration
**CHANGE.** `.env.example` already exists and is documented; add the new
martech vars (`CRM_API_KEY`, `CRM_PORTAL_ID`, `BEHAVIOUR_ANALYTICS_ID`)
alongside it.

## 25. Security
**CHANGE.** Existing Server Actions already do server-side Zod validation
and never expose the service-role key to the client (verified by grep in
the previous round). What's missing for the new `/api/v1/leads` route
specifically: rate limiting and abuse controls, since a public POST
endpoint is a materially different attack surface than a Server Action
invoked from a same-origin form. Added in Phase 2c.

## 26. Accessibility
**KEEP.** Nothing in this change request touches markup in a way that
should regress the existing WCAG 2.2 AA work (skip link, focus rings,
reduced-motion, labelled forms). Verified per-component as new UI is
added (mainly none — this phase is almost entirely non-visual plumbing).

## Summary table

| Area | Verdict |
|---|---|
| Conversion architecture | CHANGE (add measurement) |
| Analytics abstraction | CHANGE (restructure + expand) |
| Attribution | ADD |
| Lead pipeline / API | CHANGE (extract + add API route) |
| SEO metadata | CHANGE (deduplicate via helper) |
| Structured data | ADD |
| Internal linking | DEFER (needs real Insights articles) |
| Redirects | DEFER (nothing to redirect from yet) |
| Performance / CWV | DEFER (needs a real build) |
| Behaviour analytics | ADD (light wrapper) |
| Consent | KEEP + CHANGE (light) |
| CRM adapter | ADD |
| Experimentation | ADD (scaffold only, no live tests) |
| Docs | ADD |
| Tests | ADD (unit, unverified; e2e scaffolded) |
