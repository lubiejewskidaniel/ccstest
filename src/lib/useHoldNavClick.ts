"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";

const NAV_HOLD_MS = 1000;

/**
 * Attach to a next/link `<Link>`'s `onClick` (or compose it into an
 * existing one). Holds real navigation back for NAV_HOLD_MS so a button's
 * spark-burst click effect (see MotionSystem.tsx, which plays on any
 * `.btn`/`.to-top` click via a document-level listener) actually gets seen
 * - a prefetched Link otherwise swaps the page on the same tick, before a
 * single frame renders the burst.
 *
 * This works because next/link's own onClick checks
 * `event.defaultPrevented` before calling `router.push` and backs off when
 * it's already set (see node_modules/next/dist/client/link.js) - so
 * calling preventDefault here, inside the same onClick prop Link already
 * invokes first, is the officially-supported hook point. It is NOT a
 * timing race against a separate listener (that approach - a capture-phase
 * document listener - was tried first and was unreliable).
 *
 * Modifier-clicks (ctrl/cmd/shift/middle-click), `target="_blank"`,
 * `download` links, and non-navigational hrefs (`#...`, `mailto:`,
 * `tel:`) are left alone and navigate immediately, as usual.
 */
export function useHoldNavClick() {
  const router = useRouter();

  return function holdNavClick(e: MouseEvent<HTMLAnchorElement>) {
    const anchor = e.currentTarget;
    const isPlainLeftClick =
      e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
    if (!isPlainLeftClick || anchor.target === "_blank" || anchor.hasAttribute("download")) {
      return;
    }
    const href = anchor.getAttribute("href") ?? "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      return;
    }
    e.preventDefault();
    window.setTimeout(() => {
      if (href.startsWith("/")) {
        router.push(href);
      } else {
        window.location.href = href;
      }
    }, NAV_HOLD_MS);
  };
}
