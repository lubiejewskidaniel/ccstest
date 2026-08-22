"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { events } from "./events";
import { getBaseContext } from "./context";

/**
 * Fires `page_view` on first mount and every client-side navigation.
 * Mounted once from the root layout, alongside MotionSystem/SectionReveal.
 * GA4 already tracks page views automatically via its own script, but this
 * keeps `page_view` inside the same typed taxonomy/consent gate as every
 * other event rather than relying on GA4's separate auto-tracking - so a
 * future non-GA4 provider (or a funnel report built from raw events) sees
 * a consistent stream.
 */
export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    events.pageView(getBaseContext(pathname));
  }, [pathname]);

  return null;
}
