/**
 * Public surface of the analytics module. Existing code imports this as
 * `@/lib/analytics` (the module resolves to this directory's index - the
 * old flat `src/lib/analytics.ts` file was replaced by this folder, so no
 * import path anywhere else in the app needed to change).
 */

export {
  CONSENT_STORAGE_KEY,
  CONSENT_CHANGED_EVENT,
  CURRENT_PRIVACY_NOTICE_VERSION,
  getStoredConsent,
  storeConsent,
  hasAnalyticsConsent,
  hasMarketingConsent,
  canLoad,
} from "./consent";
export type { ConsentState, ConsentCategory } from "./consent";

export { getBaseContext } from "./context";
export type { EventContext } from "./context";

export { dispatchEvent, registerAnalyticsProvider } from "./track";
export type { EventPayload, AnalyticsProvider } from "./track";

export { events } from "./events";

import { dispatchEvent } from "./track";

/**
 * Legacy raw dispatch, kept for any call site that predates the typed
 * taxonomy in `./events`. Prefer `events.*` for anything new - see
 * docs/ANALYTICS.md.
 */
export function trackEvent(name: string, properties: Record<string, unknown> = {}) {
  dispatchEvent({ name, properties });
}
