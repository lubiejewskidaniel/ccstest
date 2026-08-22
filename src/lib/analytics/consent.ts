"use client";

/**
 * Consent storage - the single place that decides whether non-essential
 * tracking may run (doc "Privacy, Legal, Cookies & Compliance" PRIV-004/
 * PRIV-005; CRO/Martech brief §19 "consent state should be centrally
 * managed... avoid having individual components independently decide").
 * Nothing outside this module should touch `ccs-consent` in localStorage.
 */

export const CONSENT_STORAGE_KEY = "ccs-consent";
export const CONSENT_CHANGED_EVENT = "ccs-consent-changed";
export const CURRENT_PRIVACY_NOTICE_VERSION = "2026-08-1";

export type ConsentCategory = "necessary" | "analytics" | "marketing";

export type ConsentState = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  privacyNoticeVersion: string;
};

export function getStoredConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ConsentState;
  } catch {
    return null;
  }
}

export function storeConsent(next: ConsentState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: next }));
}

export function hasAnalyticsConsent(): boolean {
  return getStoredConsent()?.analytics === true;
}

export function hasMarketingConsent(): boolean {
  return getStoredConsent()?.marketing === true;
}

/**
 * Single gate for "may a script/category run right now" - every third-party
 * loader (GA4 today; behaviour analytics, marketing pixels, CRM chat
 * widgets tomorrow) should call this instead of reading localStorage
 * directly, so the rule lives in exactly one place (brief §18/§19).
 */
export function canLoad(category: ConsentCategory): boolean {
  if (category === "necessary") return true;
  const consent = getStoredConsent();
  if (!consent) return false;
  return category === "analytics" ? consent.analytics === true : consent.marketing === true;
}
