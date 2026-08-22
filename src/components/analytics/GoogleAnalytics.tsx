"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { CONSENT_CHANGED_EVENT, getStoredConsent } from "@/lib/analytics";

/**
 * Loads the GA4 tag only once analytics consent is present AND a
 * measurement ID is configured (doc 10 §2). Reacts live to consent changes
 * fired from CookieConsent without requiring a page reload.
 */
export function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    // Reads localStorage, which isn't available during SSR - this has to
    // run after mount rather than as a lazy useState initializer, or a
    // returning visitor's server-rendered markup (script absent) would
    // disagree with their client-rendered markup (script present) and
    // React would throw a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAllowed(getStoredConsent()?.analytics === true);
    function onConsentChange(e: Event) {
      const detail = (e as CustomEvent).detail as { analytics?: boolean } | undefined;
      setAllowed(Boolean(detail?.analytics));
    }
    window.addEventListener(CONSENT_CHANGED_EVENT, onConsentChange);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onConsentChange);
  }, []);

  if (!measurementId || !allowed) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      {/* send_page_view is disabled here because PageViewTracker (src/lib/analytics/PageViewTracker.tsx)
          fires page_view explicitly through the typed event taxonomy on every route change - letting
          GA4 also auto-fire on gtag('config', ...) would double-count in an App Router SPA. */}
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){ window.dataLayer.push(arguments); }
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${measurementId}', { anonymize_ip: true, send_page_view: false });
        `}
      </Script>
    </>
  );
}
