"use client";

import { useEffect, useState } from "react";
import { getStoredAttribution, type AttributionData } from "@/features/attribution";

/**
 * Hidden `attr_*` inputs carrying first-touch attribution into a form
 * submission (brief §9). Reads from the client-side attribution store
 * (`src/features/attribution/storage.ts`) once on mount - Server Actions
 * can't reach localStorage directly, so this is how the data crosses from
 * the browser into `submitProjectLead`/`submitMarketingLead`/
 * `submitMentoringLead` (`src/lib/actions/leads.ts`,
 * `attributionFromFormData()`). Renders nothing itself; drop it inside any
 * `<form>` that should carry attribution.
 */
export function AttributionFields() {
  const [attribution, setAttribution] = useState<AttributionData | null>(null);

  useEffect(() => {
    // Reads localStorage after mount, not as a lazy initializer - during
    // SSR and the client's first render this must render nothing (no
    // hidden inputs) so the markup matches; the real attribution data
    // populates the fields only once mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAttribution(getStoredAttribution());
  }, []);

  if (!attribution) return null;

  return (
    <>
      <input type="hidden" name="attr_source" value={attribution.source ?? ""} />
      <input type="hidden" name="attr_medium" value={attribution.medium ?? ""} />
      <input type="hidden" name="attr_campaign" value={attribution.campaign ?? ""} />
      <input type="hidden" name="attr_content" value={attribution.content ?? ""} />
      <input type="hidden" name="attr_term" value={attribution.term ?? ""} />
      <input type="hidden" name="attr_referrer" value={attribution.referrer ?? ""} />
      <input type="hidden" name="attr_landing_page" value={attribution.landingPage ?? ""} />
    </>
  );
}
