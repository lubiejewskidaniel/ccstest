# Consent & Tracking

One place decides whether a non-essential script may run. Everything else
asks it.

## Categories

`src/lib/analytics/consent.ts` defines exactly three:

- **`necessary`** — always allowed; there's nothing to ask consent for.
- **`analytics`** — off by default, gates GA4 and the first-party event
  sink.
- **`marketing`** — off by default, reserved for future, clearly-disclosed
  use (nothing currently runs behind this category — see "What actually
  runs" below).

Stored as one object under the `ccs-consent` localStorage key, versioned
by `CURRENT_PRIVACY_NOTICE_VERSION` (currently `2026-08-1`) so a future
privacy notice change can be detected and re-prompted for if needed.
**Nothing outside `consent.ts` should read or write that key directly.**

## The single gate

```ts
export function canLoad(category: ConsentCategory): boolean;
```

`necessary` → always `true`. `analytics`/`marketing` → `true` only if
consent was actually stored and that specific category was granted.
Every script loader — today's `GoogleAnalytics.tsx`, the generic
`ThirdPartyScript.tsx` wrapper, and both analytics providers in
`track.ts` — calls this instead of reading `localStorage` itself. That's
what the brief means by "consent state should be centrally managed... no
individual component independently decides" (§19): there's exactly one
function that can say yes.

## The banner

`src/components/consent/CookieConsent.tsx` — reject/accept-optional at the
top level, "manage preferences" expands to per-category toggles
(`necessary` shown as always-on and disabled, `analytics`/`marketing` as
real checkboxes). Calling `storeConsent()` both persists the choice and
dispatches a `CONSENT_CHANGED_EVENT` `CustomEvent` on `window`, so already-
mounted script loaders react live — accepting analytics consent loads GA4
immediately, without a page reload.

## What actually runs today

- **GA4** (`GoogleAnalytics.tsx`) — loads once `NEXT_PUBLIC_GA_MEASUREMENT_ID`
  is set **and** analytics consent is granted. Its own automatic
  `page_view` is disabled (see docs/ANALYTICS.md) in favor of the explicit
  taxonomy event.
- **The first-party analytics sink** (`/api/v1/analytics`) — same
  analytics-consent gate, inside `firstPartyProvider` in `track.ts`.

Nothing currently runs behind the `marketing` category, and no behaviour-
analytics vendor (Crazy Egg, Hotjar, etc.) is wired up — see below.

## Behaviour analytics: the wrapper exists, no vendor is connected

`src/components/analytics/ThirdPartyScript.tsx` is a generic, consent-
gated `<Script>` wrapper — brief §18's "behaviour analytics readiness
without vendor lock-in." It's written and ready, but **nothing in the app
currently renders it**; no vendor is contracted, so there's no account ID
to configure and no env var for one. `GoogleAnalytics.tsx` keeps its own
bespoke implementation (it needs a two-tag `src` + inline-init sequence
`ThirdPartyScript` doesn't model) but both read from the same `canLoad()`
gate, so adding a real behaviour-analytics vendor later is:

```tsx
<ThirdPartyScript category="analytics" id="crazy-egg" src={`https://script.crazyegg.com/pages/scripts/${accountId}.js`} />
```

— one line, once there's a real vendor and account ID to put in it. No new
consent plumbing needed.

## Consent-gated vs. always-collected

Two things in this app are deliberately **not** gated behind analytics
consent, and that's intentional rather than an oversight:

- **First-touch attribution capture** (`AttributionCapture`) writes to its
  own `localStorage` key regardless of consent — see docs/ATTRIBUTION.md
  for why: it's a local read/write that sends nothing anywhere by itself.
  It only reaches an analytics provider once an already-consent-gated
  event fires, and only reaches a human (an admin) if the visitor chooses
  to submit a form.
- **Lead form submissions** are not analytics and were never behind this
  gate — a visitor filling out a contact form has already decided to share
  their details directly.

## Testing

`src/lib/analytics/__tests__/consent.test.ts` covers storage round-
tripping, the `CONSENT_CHANGED_EVENT` dispatch, and `canLoad()` for all
three categories in every consent state. See the README's testing note for
the unverified-in-sandbox caveat.
