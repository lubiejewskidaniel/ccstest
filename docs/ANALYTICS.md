# Analytics

How this app measures usage: the abstraction, the event taxonomy, and how
to add a new event or a new provider without touching call sites.

## Why an abstraction at all

The brief's requirement (CRO/SEO/Analytics/Martech implementation brief §4)
is that UI code never depends on a specific analytics vendor directly — no
component should call `window.gtag(...)` itself. Two things follow from
that: swapping or adding a provider (a warehouse endpoint, PostHog, a
future replacement for GA4) is a change in one file, not a grep-and-replace
across the app; and every event has one typed call site, so a typo can't
silently create a new, inconsistent event name in analytics tooling.

## The pieces

```
src/lib/analytics/
  events.ts       The taxonomy — the ONLY place event name strings appear.
  context.ts      EventContext type + getBaseContext(pathname).
  track.ts        dispatchEvent() + the AnalyticsProvider[] registry.
  consent.ts      Consent storage + canLoad() (see docs/CONSENT_TRACKING.md).
  PageViewTracker.tsx   Fires page_view on every route change.
  index.ts        Public barrel — `@/lib/analytics`.
```

Call sites only ever import from `@/lib/analytics` and only ever call
`events.*`:

```tsx
import { events, getBaseContext } from "@/lib/analytics";
import { usePathname } from "next/navigation";

const pathname = usePathname();
events.serviceCtaClick("mentoring", "hero", getBaseContext(pathname));
```

`getBaseContext(pathname)` builds the shared `EventContext` — `page`,
`locale` (derived from the `/pl/...` prefix), and `campaign`/`source`/
`medium`/`referrer` pulled from stored first-touch attribution (see
docs/ATTRIBUTION.md). Every `events.*` function takes this context and
layers its own event-specific properties on top inside `events.ts`'s
private `send()` helper — components never construct a raw payload.

## Event taxonomy

The brief's minimum taxonomy, with CCS's domain language substituted where
the app has a more specific equivalent (`tutoring_*` → `mentoring_*`,
`blog_*` → `insights_*`):

| Event | Fired from |
|---|---|
| `page_view` | `PageViewTracker`, mounted once in the root layout, on every route change |
| `service_view` | Not yet wired to any page mount — see "Not wired yet" below |
| `service_cta_click` | Hero CTAs, homepage Capabilities cards, Services/Growth/Mentoring page CTAs |
| `pricing_view` / `pricing_cta_click` | Defined for forward compatibility — no dedicated pricing page exists yet |
| `contact_form_start` / `_submit` / `_error` | `ContactForm.tsx` (project + marketing forms) |
| `mentoring_view` | `FireViewEvent` on `MentoringPage` |
| `mentoring_enquiry_start` / `_submit` / `_error` | `MentoringEnquiryForm.tsx` |
| `insights_view` | `FireViewEvent` on `InsightsPage` |
| `insights_cta_click` | Homepage Insights section links |
| `external_link_click` | A single delegated listener in `MotionSystem.tsx` — covers every outbound `<a>` on every page automatically |
| `language_switch` | `LanguageSwitch.tsx` |
| `theme_change` | `ThemeToggle.tsx` |
| `experiment_view` / `experiment_conversion` | Defined, not yet fired by anything live — see docs/EXPERIMENTATION.md |

**Not wired yet:** `service_view` (a page-level "this service page was
viewed" event, distinct from `service_cta_click`) isn't fired from the
Services/Growth/Mentoring pages. `mentoring_view`/`insights_view` cover the
single-purpose pages; `service_view` firing per-capability on the Services
hub would need the same service-slug catalog described as a deliberate
scope boundary in docs/SEO_AEO.md. Left as a follow-up rather than wired
with a half-accurate slug.

Every event's shared context intentionally excludes anything that could be
personal data — no names, emails, form message bodies, or credentials ever
pass through `EventContext` (brief §6). Form submission events carry a
count or a type, never the submitted content.

## Providers

`track.ts` currently registers two:

- **`ga4Provider`** — sends to `window.gtag` when it exists and analytics
  consent is granted. GA4's own automatic `page_view` is disabled
  (`send_page_view: false` in `GoogleAnalytics.tsx`) specifically because
  `PageViewTracker` already fires it explicitly — leaving both on would
  double-count in an App Router SPA.
- **`firstPartyProvider`** — `POST`s to `/api/v1/analytics` with
  `keepalive: true` (survives a navigation that happens right after the
  triggering click), gated on the same analytics consent check. The route
  handler (`src/app/api/v1/analytics/route.ts`) currently validates and
  structurally logs each event — a placeholder for a real warehouse/DB
  sink, not a decorative stub; wiring a real destination is a contained
  change inside that one file.

Both providers fail silently and independently — `dispatchEvent()` wraps
each `provider.send()` call in its own `try/catch`, so one provider's
failure (a network error, an ad blocker) never blocks another.

### Adding a provider

```ts
import { registerAnalyticsProvider } from "@/lib/analytics";

registerAnalyticsProvider({
  id: "posthog",
  isReady: () => typeof window !== "undefined" && hasAnalyticsConsent(),
  send: ({ name, properties }) => posthog.capture(name, properties),
});
```

### Adding an event

Add one function to `events.ts`'s exported object — never call
`dispatchEvent`/`trackEvent` with a raw string from a component.

## Rate limiting on the ingest side

`/api/v1/analytics` is rate-limited (120 requests/minute per IP) using the
same in-memory limiter leads use — see docs/LEAD_MANAGEMENT.md for its
single-instance caveat, which applies here too.
