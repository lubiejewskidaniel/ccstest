"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { events, getBaseContext } from "@/lib/analytics";
import { useHoldNavClick } from "@/lib/useHoldNavClick";

type TrackedCtaLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
  ctaLocation: string;
} & ({ kind: "service"; service: string } | { kind: "insights" });

/**
 * Thin client-side wrapper around `next/link` that fires the matching CTA
 * click event (brief §5 `service_cta_click` / `blog_cta_click` equivalent)
 * on click, before navigation. Lets the surrounding page stay a Server
 * Component - only this link ships client JS, not the whole page (brief
 * engineering principle: "minimum unnecessary client-side JavaScript").
 *
 * Use `kind="service"` for any CTA pointing at a service/offer (fires
 * `service_cta_click` with the given `service` slug) and `kind="insights"`
 * for links out of/into the Insights section (fires `insights_cta_click`).
 *
 * When this renders one of the `.btn` buttons (as opposed to a plain
 * "view all"/card link), navigation is briefly held back via
 * useHoldNavClick so the button's spark-burst click effect (MotionSystem)
 * has time to actually be seen instead of being cut off by the page swap.
 */
export function TrackedCtaLink(props: TrackedCtaLinkProps) {
  const pathname = usePathname();
  const holdNavClick = useHoldNavClick();
  const { href, className, children, ctaLocation } = props;
  const isButton = className?.split(/\s+/).includes("btn") ?? false;

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    const context = getBaseContext(pathname);
    if (props.kind === "service") {
      events.serviceCtaClick(props.service, ctaLocation, context);
    } else {
      events.insightsCtaClick(ctaLocation, context);
    }
    if (isButton) holdNavClick(e);
  }

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
