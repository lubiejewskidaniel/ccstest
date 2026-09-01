"use client";

import { dispatchEvent } from "./track";
import type { EventContext } from "./context";

/**
 * Documented event taxonomy (brief §5 "at minimum support"). CCS's domain
 * language replaces the brief's generic examples where the app has a more
 * specific equivalent - `tutoring_*` → `mentoring_*`, `blog_*` →
 * `insights_*` - documented in `docs/ANALYTICS.md`. `pricing_view` /
 * `pricing_cta_click` are defined for forward compatibility even though no
 * dedicated pricing page exists yet.
 *
 * Every function here is the ONLY place its event name is spelled out -
 * components call these, never `dispatchEvent`/`trackEvent` with a raw
 * string, so a typo can't silently create a new inconsistent event name
 * (the exact failure mode brief §5 calls out).
 */

function send(name: string, context: EventContext, extra: Record<string, unknown> = {}) {
  dispatchEvent({ name, properties: { ...context, ...extra } });
}

export const events = {
  pageView: (context: EventContext) => send("page_view", context),

  serviceView: (service: string, context: EventContext) => send("service_view", context, { service }),
  serviceCtaClick: (service: string, ctaLocation: string, context: EventContext) =>
    send("service_cta_click", context, { service, cta_location: ctaLocation }),

  pricingView: (context: EventContext) => send("pricing_view", context),
  pricingCtaClick: (ctaLocation: string, context: EventContext) =>
    send("pricing_cta_click", context, { cta_location: ctaLocation }),

  contactFormStart: (formType: "project" | "marketing", context: EventContext) =>
    send("contact_form_start", context, { form_type: formType }),
  contactFormSubmit: (formType: "project" | "marketing", context: EventContext) =>
    send("contact_form_submit", context, { form_type: formType }),
  contactFormError: (formType: "project" | "marketing", errorCount: number, context: EventContext) =>
    send("contact_form_error", context, { form_type: formType, error_count: errorCount }),

  // CCS-specific equivalent of the brief's `tutoring_*` events.
  mentoringView: (context: EventContext) => send("mentoring_view", context),
  mentoringEnquiryStart: (context: EventContext) => send("mentoring_enquiry_start", context),
  mentoringEnquirySubmit: (context: EventContext) => send("mentoring_enquiry_submit", context),
  mentoringEnquiryError: (errorCount: number, context: EventContext) =>
    send("mentoring_enquiry_error", context, { error_count: errorCount }),

  // CCS-specific equivalent of the brief's `blog_*` events.
  insightsView: (context: EventContext) => send("insights_view", context),
  insightsCtaClick: (ctaLocation: string, context: EventContext) =>
    send("insights_cta_click", context, { cta_location: ctaLocation }),

  // Article-level events (Insights Checkpoint 2/5) — extends the same
  // taxonomy above rather than a second events file, per
  // docs/INSIGHTS_ARCHITECTURE.md §6.
  articleView: (slug: string, category: string, context: EventContext) =>
    send("article_view", context, { slug, category }),
  articleReadProgress: (slug: string, percent: 25 | 50 | 75 | 100, context: EventContext) =>
    send("article_read_progress", context, { slug, percent }),
  articleCtaClick: (slug: string, ctaLocation: string, context: EventContext) =>
    send("article_cta_click", context, { slug, cta_location: ctaLocation }),
  categoryView: (slug: string, context: EventContext) => send("category_view", context, { slug }),
  tagView: (slug: string, context: EventContext) => send("tag_view", context, { slug }),
  insightsSearch: (query: string, resultCount: number, context: EventContext) =>
    send("insights_search", context, { query, result_count: resultCount }),

  externalLinkClick: (href: string, context: EventContext) => send("external_link_click", context, { href }),
  languageSwitch: (from: "en" | "pl", to: "en" | "pl", context: EventContext) =>
    send("language_switch", context, { from_locale: from, to_locale: to }),
  themeChange: (theme: string, context: EventContext) => send("theme_change", context, { theme }),

  // Experimentation readiness (brief §21) - no live experiments run these yet.
  experimentView: (experimentId: string, variant: string, context: EventContext) =>
    send("experiment_view", context, { experiment_id: experimentId, variant }),
  experimentConversion: (experimentId: string, variant: string, context: EventContext) =>
    send("experiment_conversion", context, { experiment_id: experimentId, variant, conversion: true }),
};
