# Lead Management

The pipeline every enquiry goes through, from a form field to a row an
admin can see, and the two ways in.

## The pipeline

```
Form (progressively-enhanced React) ──┐
                                       ├──> src/features/leads/service.ts ──> Supabase insert ──> notifyNewLead() ──> syncLeadToCRM() ──> analytics conversion event
POST /api/v1/leads (JSON) ────────────┘
```

`src/features/leads/service.ts` is the single business-logic core —
`createProjectLead()`, `createMarketingLead()`, `createMentoringLead()`.
Each one: Zod-validates the raw input against the matching schema in
`src/lib/validation/schemas.ts`, inserts via the privileged Supabase
client (with a graceful dev-mode fallback that logs a warning and returns
success without persisting, if Supabase isn't configured), fires the
Resend notification email (best-effort, never blocks the response), fires
the CRM sync (same), and returns a typed `LeadResult`:

```ts
type LeadResult =
  | { ok: true }
  | { ok: false; kind: "validation"; fieldErrors: … }
  | { ok: false; kind: "persistence"; message: string };
```

This file is server-only but deliberately does **not** carry a `"use
server"` directive itself — it's a plain module, only ever imported by
files that do carry that directive (or by the route handler, which is
already server-only by definition). That keeps it usable from both entry
points below without Next.js's "a `use server` file may only export async
functions" rule getting in the way.

## Two entry points, one pipeline

**Server Actions** (`src/lib/actions/leads.ts`) — what the site's own
React forms use. `submitProjectLead` / `submitMarketingLead` /
`submitMentoringLead` read `FormData`, build the raw object (including
`attributionFromFormData()` — see docs/ATTRIBUTION.md), call the matching
service function, and map the `LeadResult` into the `useActionState`-
compatible shape the forms already expected before this pass. No existing
form-handling logic was rewritten — this is a thin adapter in front of the
same validation and persistence that was already there.

**`POST /api/v1/leads`** (`src/app/api/v1/leads/route.ts`) — a versioned
JSON API for any future caller that isn't this app's own forms (a partner
integration, a native app, a separate microsite). Body: `{ "type":
"project" | "marketing" | "mentoring", ...fields }`, same field names and
shapes as the Zod schemas. Responses: `201` on success, `400` with
`fieldErrors` on validation failure, `500` on a persistence failure, `429`
with a `Retry-After` header when rate-limited.

Neither entry point duplicates validation or persistence logic — both call
the same three functions in `service.ts`.

## Rate limiting

`src/lib/rateLimit.ts` — an in-memory sliding-window limiter,
`checkRateLimit(key, { limit, windowMs })`. The lead API is limited to 5
requests / 10 minutes per client IP (`getClientIp()` reads
`x-forwarded-for` / `x-real-ip`).

**Known limitation, documented deliberately:** this state lives in the
Node process's memory. It resets on redeploy and is **not** shared across
multiple server instances. Fine for a single-instance deployment or as a
first line of defense; a multi-instance production deployment needs a
shared store (Upstash Redis, Vercel KV, etc.) behind the same
`checkRateLimit()` signature — swapping the implementation is a contained
change in that one file, no caller needs to change.

## Attribution on every lead

Every lead record carries `utm_source`, `utm_medium`, `utm_campaign`,
`utm_content`, `utm_term`, `referrer`, and `landing_page` (migration
`002_lead_attribution.sql`) — see docs/ATTRIBUTION.md for how that data
gets from the visitor's browser onto the submitted form.

## CRM sync

`syncLeadToCRM()` (`src/lib/crm/index.ts`) resolves to the configured
`HubSpotProvider` if `CRM_API_KEY` + `CRM_PORTAL_ID` are both set,
otherwise a silent `NoopProvider`. Fire-and-forget from `service.ts`,
wrapped in its own `try/catch` — a CRM outage or misconfiguration must
never surface as a failed form submission to the visitor. See
`src/lib/crm/HubSpotProvider.ts` for the custom HubSpot properties this
needs created in the target portal before it does anything
(`ccs_enquiry_type`, `ccs_enquiry_summary`, `ccs_utm_source`,
`ccs_utm_medium`, `ccs_utm_campaign`).

## Conversion events

A successful submission fires `contact_form_submit` /
`mentoring_enquiry_submit` (see docs/ANALYTICS.md) from the form's own
success effect — not from the server, since the event needs the same
consent-gated client-side dispatch path every other event uses.

## What's still manual (Phase 2, out of scope for this pass)

Lead status, notes, assignment, and audit logging in the admin dashboard —
the admin UI today is sign-in + an overview with counts + a read-only
recent-leads table. See the README's "what's genuinely not built yet."

## Testing

`src/lib/validation/__tests__/schemas.test.ts` covers every lead schema's
happy path and its key rejection cases (short message, bad email, wrong
enum value, the mentoring form's minor/guardian `.refine()`). See the
top-level testing note in the README for the caveat that these are
unverified in this sandbox (no npm registry access).
