"use client";

import { hasAnalyticsConsent } from "./consent";

/**
 * Provider-agnostic dispatch (brief §4: "components should NOT directly
 * depend on individual analytics providers"). UI code only ever calls
 * `trackEvent()` from `./events` - never `window.gtag` directly. Adding a
 * second provider (a warehouse endpoint, PostHog, etc.) means registering
 * one more `AnalyticsProvider` here; no call site changes.
 */

export type EventPayload = { name: string; properties: Record<string, unknown> };

export type AnalyticsProvider = {
  id: string;
  /** Whether this provider may currently receive events (script loaded + consent granted). */
  isReady: () => boolean;
  send: (payload: EventPayload) => void;
};

type GtagFn = (...args: unknown[]) => void;
declare global {
  interface Window {
    gtag?: GtagFn;
    dataLayer?: unknown[];
  }
}

const ga4Provider: AnalyticsProvider = {
  id: "ga4",
  isReady: () => typeof window !== "undefined" && typeof window.gtag === "function" && hasAnalyticsConsent(),
  send: ({ name, properties }) => {
    window.gtag?.("event", name, properties);
  },
};

const firstPartyProvider: AnalyticsProvider = {
  id: "first-party",
  isReady: () => typeof window !== "undefined" && hasAnalyticsConsent(),
  send: (payload) => {
    // `keepalive` lets this survive a navigation that happens right after
    // the event fires (e.g. a CTA click that immediately routes away).
    fetch("/api/v1/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Best-effort - never let a failed beacon surface to the UI.
    });
  },
};

const providers: AnalyticsProvider[] = [ga4Provider, firstPartyProvider];

/** Register an additional provider (e.g. a future first-party warehouse sink). */
export function registerAnalyticsProvider(provider: AnalyticsProvider) {
  if (!providers.some((p) => p.id === provider.id)) providers.push(provider);
}

/** Dispatches to every ready provider. Silently no-ops with none ready - never throws into UI code. */
export function dispatchEvent(payload: EventPayload) {
  for (const provider of providers) {
    if (!provider.isReady()) continue;
    try {
      provider.send(payload);
    } catch (err) {
      console.error(`[analytics] provider "${provider.id}" failed to send "${payload.name}":`, err);
    }
  }
}
