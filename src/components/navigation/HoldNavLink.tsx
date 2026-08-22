"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useHoldNavClick } from "@/lib/useHoldNavClick";

/**
 * Drop-in replacement for next/link's `<Link>`, used for the `.btn` CTAs
 * that live in Server Components (which can't call the useHoldNavClick
 * hook directly - this small client component is the bridge, same reason
 * TrackedCtaLink exists: only this link ships client JS, not the whole
 * page). Holds real navigation back briefly so the button's spark-burst
 * click effect (MotionSystem) has time to actually be seen - see
 * useHoldNavClick for the full reasoning.
 *
 * Any existing `onClick` prop (analytics, closing a mobile menu, etc.)
 * still runs first, exactly as before - this only adds the hold on top.
 */
export function HoldNavLink(props: ComponentProps<typeof Link>) {
  const holdNavClick = useHoldNavClick();
  const { onClick, ...rest } = props;
  return (
    <Link
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        holdNavClick(e);
      }}
    />
  );
}
