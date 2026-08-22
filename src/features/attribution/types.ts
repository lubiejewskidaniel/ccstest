/**
 * First-touch attribution snapshot (brief §9 "Attribution"). Captured once,
 * on the visitor's first landing, and never overwritten by a later visit -
 * that's what makes it "first-touch" rather than "last-touch". Attached to
 * a lead only when the visitor actually submits a form; never sent to GA4
 * or any third party on its own (see docs/ATTRIBUTION.md for the consent
 * reasoning).
 */
export type AttributionData = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  referrer: string | null;
  landingPage: string;
  capturedAt: string; // ISO timestamp
};

export const UTM_PARAM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
