"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { events, getBaseContext } from "@/lib/analytics";

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
 */
export function TrackedCtaLink(props: TrackedCtaLinkProps) {
  const pathname = usePathname();
  const { href, className, children, ctaLocation } = props;

  function handleClick() {
    const context = getBaseContext(pathname);
    if (props.kind === "service") {
      events.serviceCtaClick(props.service, ctaLocation, context);
    } else {
      events.insightsCtaClick(ctaLocation, context);
    }
  }

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
