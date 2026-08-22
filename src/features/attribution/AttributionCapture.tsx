"use client";

import { useEffect } from "react";
import { captureFirstTouchAttribution } from "./storage";

/**
 * Mounted once from the root layout (alongside MotionSystem/SectionReveal).
 * Runs a single first-touch attribution capture per browser and is
 * otherwise invisible - no UI, no third-party request, no consent
 * category involved (it's a first-party record of how this visitor found
 * the site, written only to this origin's own localStorage; see
 * docs/ATTRIBUTION.md and docs/CONSENT_TRACKING.md for why this doesn't
 * require the analytics/marketing consent categories the way GA4 does).
 */
export function AttributionCapture() {
  useEffect(() => {
    captureFirstTouchAttribution(
      { search: window.location.search, pathname: window.location.pathname },
      document.referrer
    );
  }, []);

  return null;
}
