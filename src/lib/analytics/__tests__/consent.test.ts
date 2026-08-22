import { describe, it, expect, beforeEach } from "vitest";
import {
  getStoredConsent,
  storeConsent,
  hasAnalyticsConsent,
  hasMarketingConsent,
  canLoad,
  CONSENT_CHANGED_EVENT,
  CURRENT_PRIVACY_NOTICE_VERSION,
  type ConsentState,
} from "../consent";

const ALL_GRANTED: ConsentState = {
  necessary: true,
  analytics: true,
  marketing: true,
  privacyNoticeVersion: CURRENT_PRIVACY_NOTICE_VERSION,
};

const ANALYTICS_ONLY: ConsentState = { ...ALL_GRANTED, marketing: false };

describe("consent", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("getStoredConsent returns null before anything is stored", () => {
    expect(getStoredConsent()).toBeNull();
  });

  it("storeConsent persists the given state and getStoredConsent reads it back", () => {
    storeConsent(ALL_GRANTED);
    expect(getStoredConsent()).toEqual(ALL_GRANTED);
  });

  it("storeConsent dispatches CONSENT_CHANGED_EVENT with the new state as detail", () => {
    let received: ConsentState | null = null;
    window.addEventListener(CONSENT_CHANGED_EVENT, (e) => {
      received = (e as CustomEvent<ConsentState>).detail;
    });
    storeConsent(ANALYTICS_ONLY);
    expect(received).toEqual(ANALYTICS_ONLY);
  });

  it("hasAnalyticsConsent/hasMarketingConsent reflect the stored categories independently", () => {
    storeConsent(ANALYTICS_ONLY);
    expect(hasAnalyticsConsent()).toBe(true);
    expect(hasMarketingConsent()).toBe(false);
  });

  it("hasAnalyticsConsent is false when nothing is stored", () => {
    expect(hasAnalyticsConsent()).toBe(false);
  });

  describe("canLoad", () => {
    it("necessary always loads, even with no consent stored", () => {
      expect(canLoad("necessary")).toBe(true);
    });

    it("analytics/marketing do not load with no consent stored", () => {
      expect(canLoad("analytics")).toBe(false);
      expect(canLoad("marketing")).toBe(false);
    });

    it("analytics loads once granted, independent of marketing", () => {
      storeConsent(ANALYTICS_ONLY);
      expect(canLoad("analytics")).toBe(true);
      expect(canLoad("marketing")).toBe(false);
    });

    it("marketing loads once granted", () => {
      storeConsent(ALL_GRANTED);
      expect(canLoad("marketing")).toBe(true);
    });
  });
});
