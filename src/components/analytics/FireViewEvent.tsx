"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { events, getBaseContext } from "@/lib/analytics";

type ViewEventName = "mentoringView" | "insightsView" | "pricingView";

/**
 * Fires a single mount-time view event (`mentoring_view`, `insights_view`,
 * `pricing_view` - brief §5) from a Server Component page, without turning
 * the whole page into a Client Component. This is layered on top of the
 * generic `page_view` that `PageViewTracker` already fires on every route -
 * the taxonomy defines both, since the section-specific event is what makes
 * "how many people viewed the Mentoring page" queryable without parsing
 * page paths.
 *
 * Mount-once guarded by a ref so React's Strict Mode double-invoke in
 * development doesn't double-fire the event.
 */
export function FireViewEvent({ event }: { event: ViewEventName }) {
  const pathname = usePathname();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    const context = getBaseContext(pathname);
    if (event === "mentoringView") events.mentoringView(context);
    else if (event === "insightsView") events.insightsView(context);
    else events.pricingView(context);
    // Mount-only by design - this fires once per page load, not per
    // client-side navigation between two variants of the same page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
