# Experimentation

Readiness scaffold only. **No experiment is live in this app.** This
document exists so that when one is ready to run, adding it is a small,
contained change — not an excuse to launch one early.

## The brief's own gate

> Do not launch extensive A/B testing immediately... do not start A/B
> testing before baseline measurement is reliable.

Concretely, "reliable baseline" means: the event taxonomy is actually
firing in production (docs/ANALYTICS.md), the first-party sink or GA4 has
real traffic flowing through it, and someone has looked at that data
before layering a variant experiment underneath it. None of that has
happened yet in this sandbox build — there's no production deployment.
This scaffold is Phase 6 groundwork, not a Phase 6 launch.

## What exists

```
src/features/experiments/
  types.ts          ExperimentConfig = { id, variants: readonly string[] }
  bucketing.ts       Pure hash + assignVariant() — unit-testable, no window access
  visitorId.ts       localStorage-backed per-browser id, created lazily
  useExperiment.ts    "use client" hook — NOT called from anywhere yet
```

### Stable bucketing

`assignVariant({ id, variants }, visitorId)` deterministically maps
`(experiment id, visitor id)` to one of `variants` via a small FNV-1a
hash, mod the variant count. Same visitor + same experiment always gets
the same variant — no server-side assignment table to keep in sync, and a
returning visitor sees a consistent experience across sessions (brief §21
"stable bucketing per visitor/session"). The hashing function itself is
pure (no `localStorage`/`window`), so it's directly unit-tested in
`src/features/experiments/__tests__/bucketing.test.ts`.

The visitor id (`visitorId.ts`) is a random id stored in `localStorage`
under `ccs_experiment_visitor_id`, created **lazily on first read** — not
on every page load — so nothing writes to storage while zero experiments
call `useExperiment`. It's used only as a bucketing input; it's never sent
anywhere by itself.

### The hook

```tsx
const variant = useExperiment({ id: "hero-cta-copy", variants: ["control", "variant_b"] });

if (variant === "variant_b") {
  // render the alternate copy/layout
}
```

Returns `variants[0]` (control) synchronously during SSR and on the very
first client render — the real bucket needs `localStorage`, which isn't
available during SSR, and computing it during the initial render would
make server and client markup disagree. The real, deterministic variant
takes over after mount, and `experiment_view` fires once at that point
(never during SSR, never twice).

```ts
trackExperimentConversion(experimentId, variant, pathname);
```

Call this from the CTA/action the experiment is actually measuring — a
button click, a form submission — never from a page-load effect. A
conversion is something the visitor did.

## Rollout checklist, before wiring `useExperiment` into any real component

All of these come directly from the brief (§21–§22) and none are
optional:

- Baseline analytics has been live long enough to trust the numbers being
  compared against.
- The experiment has a single, pre-declared success metric — not "we'll
  see what looks better after the fact."
- Both variants are **fully accessible** — an experiment must never create
  an accessibility difference between variants. If a variant needs an ARIA
  fix the control doesn't, fix it in both, or don't ship the experiment.
- Both variants are **equally secure** — no variant introduces a new form
  field, endpoint, or data flow that skips validation, rate limiting, or
  consent gating.
- Neither variant shows **misleading pricing** or a false scarcity/urgency
  claim (this rules out most classic CRO "dark pattern" experiments
  outright — see the brief's explicit "no aggressive pop-ups or dark
  patterns" constraint, which isn't suspended just because something is
  being tested).
- The experiment doesn't interfere with consent — a visitor who hasn't
  granted analytics consent still sees a consistent (if unmeasured)
  experience; bucketing itself doesn't require consent (it's a local,
  never-transmitted-alone id), but `experiment_view`/`experiment_conversion`
  only reach an analytics provider under the same consent gate as every
  other event (docs/CONSENT_TRACKING.md).

## Adding a real experiment later

1. Define the `ExperimentConfig` (a stable `id`, a short `variants` list).
2. Call `useExperiment()` in the component being tested, branch on the
   returned variant.
3. Call `trackExperimentConversion()` from the actual conversion action.
4. Confirm every item in the checklist above.
5. Ship it, watch `experiment_view`/`experiment_conversion` in whatever
   sink is analyzing them, and remove the losing variant's code path once
   the experiment concludes — don't leave dead variants behind
   indefinitely.
