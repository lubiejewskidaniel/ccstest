"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { CONSENT_CHANGED_EVENT, canLoad, type ConsentCategory, type ConsentState } from "@/lib/analytics";

/**
 * Generic consent-gated third-party script loader (brief §18 "behaviour
 * analytics readiness" / §19 "avoid having individual components
 * independently decide whether marketing scripts can execute"). Every
 * future vendor script - Crazy Egg, Hotjar, a marketing pixel - should
 * mount through this instead of hand-rolling its own consent check, the
 * way `GoogleAnalytics.tsx` currently does. `GoogleAnalytics` keeps its own
 * implementation for now (it needs a two-tag `src` + inline-init sequence
 * this generic wrapper doesn't model) but both read from the same
 * `canLoad()` gate in `src/lib/analytics/consent.ts`, so there's exactly
 * one place that decides what's allowed to run.
 *
 * Usage once a behaviour-analytics vendor is actually contracted:
 * ```tsx
 * <ThirdPartyScript
 *   category="analytics"
 *   id="crazy-egg"
 *   src={`https://script.crazyegg.com/pages/scripts/${accountId}.js`}
 * />
 * ```
 */
export function ThirdPartyScript({
  category,
  id,
  src,
  strategy = "afterInteractive",
}: {
  category: ConsentCategory;
  id: string;
  src: string;
  strategy?: "afterInteractive" | "lazyOnload";
}) {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    // Reads localStorage (via canLoad -> getStoredConsent), which isn't
    // available during SSR - this has to run after mount rather than as a
    // lazy useState initializer, or a returning visitor's server-rendered
    // markup (script absent) would disagree with their client-rendered
    // markup (script present) and React would throw a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAllowed(canLoad(category));
    function onConsentChange(e: Event) {
      void (e as CustomEvent<ConsentState>).detail;
      setAllowed(canLoad(category));
    }
    window.addEventListener(CONSENT_CHANGED_EVENT, onConsentChange);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onConsentChange);
  }, [category]);

  if (!allowed) return null;

  return <Script id={id} src={src} strategy={strategy} />;
}
