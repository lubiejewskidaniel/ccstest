"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { events, getBaseContext } from "@/lib/analytics";

/**
 * Site-wide "delight" layer: boot-in curtain, scroll-progress rail, header
 * scroll state, back-to-top, button spark ripple and subtle card tilt.
 * Mounted once from the root layout. Everything here is inert under
 * `prefers-reduced-motion` or a coarse/touch pointer - see the guards below
 * and the matching CSS in globals.css.
 *
 * This is a deliberately plain DOM-effects component rather than a heavier
 * animation library: the interactions are simple enough (opacity/transform/
 * one SVG stroke draw) that IntersectionObserver + requestAnimationFrame
 * cover it without adding a runtime dependency.
 */
export function MotionSystem() {
  const pathname = usePathname();

  // Runs once: boot curtain, scroll progress/header state, back-to-top,
  // and the click-ripple (delegated on `document`, so it keeps working for
  // every button rendered on every future client-side navigation).
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ---- boot curtain ----
    // NB: this used to `return` a cleanup function straight from inside
    // this block on a normal (non-reduced-motion) load - which exits the
    // WHOLE effect right here. Everything wired up below (scroll progress,
    // to-top, the click-spark listener, external-link tracking) never got
    // wired up on a fresh page load - it only appeared to work when
    // `reduceMotion` was true, which skips this branch entirely. Fixed by
    // collecting this cleanup instead of returning it, so the rest of the
    // effect always runs and everything's cleanup is merged at the end.
    const curtain = document.getElementById("bootCurtain");
    let curtainCleanup: (() => void) | undefined;
    if (curtain) {
      if (reduceMotion) {
        curtain.remove();
      } else {
        document.documentElement.classList.add("boot-lock");
        const t1 = window.setTimeout(() => {
          curtain.classList.add("done");
          document.documentElement.classList.remove("boot-lock");
          window.setTimeout(() => curtain.remove(), 650);
        }, 620);
        curtainCleanup = () => window.clearTimeout(t1);
      }
    }

    // ---- scroll progress + header state + to-top ----
    const progressFill = document.getElementById("progressFill");
    const header = document.getElementById("siteHeader");
    const toTop = document.getElementById("toTop");

    function onScroll() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
      if (progressFill) progressFill.style.width = Math.min(100, Math.max(0, pct)) + "%";
      if (header) header.classList.toggle("scrolled", window.scrollY > 8);
      if (toTop) toTop.classList.toggle("show", window.scrollY > 700);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    function onToTop() {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    }
    toTop?.addEventListener("click", onToTop);

    // ---- button spark ripple + spark shower ----
    // Logo-blue flash (spark-ripple) is contained inside the button (it
    // relies on the button's own overflow:hidden to mask its fill grow).
    // The flying spark-bit particles are the opposite: they must NOT be
    // clipped by that same overflow:hidden, so they are appended to a
    // fixed-position .spark-burst layer on <body>, positioned at the
    // click's viewport coordinates, fully independent of the button box.
    //
    // Purely visual - this listener never touches navigation. Buttons
    // that are next/link `<a>` tags hold their real navigation back for a
    // beat via useHoldNavClick (see src/lib/useHoldNavClick.ts), wired on
    // each Link's own onClick - that's the reliable place to intercept a
    // Link click (Link checks event.defaultPrevented itself), not a
    // separate document-level listener racing against it.
    //
    // Deliberately NOT gated behind `reduceMotion` (unlike the rest of
    // this file): a brief, localized click acknowledgment isn't the kind
    // of continuous/looping/parallax motion that setting targets, and
    // gating it here was silently killing the entire effect for anyone
    // with "reduce motion" on at the OS level (e.g. Windows' "Show
    // animations" toggle) - most likely what was happening.
    function onButtonClick(e: MouseEvent) {
      const btn = (e.target as HTMLElement)?.closest<HTMLElement>(".btn, .to-top");
      if (!btn) return;
      const r = btn.getBoundingClientRect();

      const s = document.createElement("span");
      s.className = "spark-ripple";
      s.style.left = e.clientX - r.left + "px";
      s.style.top = e.clientY - r.top + "px";
      btn.appendChild(s);
      s.addEventListener("animationend", () => s.remove());

      const burst = document.createElement("span");
      burst.className = "spark-burst";
      burst.style.left = e.clientX + "px";
      burst.style.top = e.clientY + "px";
      document.body.appendChild(burst);

      const sparkCount = 8;
      let remaining = sparkCount;
      for (let i = 0; i < sparkCount; i++) {
        const angle = (Math.PI * 2 * i) / sparkCount + (Math.random() - 0.5) * 0.6;
        const dist = 26 + Math.random() * 34;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        const bit = document.createElement("span");
        bit.className = "spark-bit";
        bit.style.setProperty("--dx", dx.toFixed(1) + "px");
        bit.style.setProperty("--dy", dy.toFixed(1) + "px");
        bit.style.animationDelay = (Math.random() * 0.05).toFixed(2) + "s";
        bit.addEventListener("animationend", () => {
          bit.remove();
          remaining -= 1;
          if (remaining <= 0) burst.remove();
        });
        burst.appendChild(bit);
      }
    }
    document.addEventListener("click", onButtonClick);

    // ---- external link tracking (brief §5 `external_link_click`) ----
    // A single delegated listener on `document`, so every outbound link on
    // every page - present now or added later - is covered without any
    // component needing its own click handler (brief engineering
    // principle: "minimum unnecessary client-side JavaScript").
    function onExternalLinkClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement)?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (!/^https?:\/\//i.test(href)) return;
      try {
        const url = new URL(href, window.location.href);
        if (url.origin === window.location.origin) return;
      } catch {
        return;
      }
      events.externalLinkClick(href, getBaseContext(window.location.pathname));
    }
    document.addEventListener("click", onExternalLinkClick);

    return () => {
      curtainCleanup?.();
      window.removeEventListener("scroll", onScroll);
      toTop?.removeEventListener("click", onToTop);
      document.removeEventListener("click", onButtonClick);
      document.removeEventListener("click", onExternalLinkClick);
    };
  }, []);

  // `<html lang>` tracks the active locale. The server already sets this
  // correctly on the initial response (middleware.ts stamps an x-locale
  // header from the URL, app/layout.tsx reads it) - that's what matters
  // for SEO/crawlers. This effect is the client-side-navigation safety
  // net: the root layout doesn't re-run when a user clicks the language
  // switcher (single root layout, no [locale] segment - Next.js only
  // allows one <html> in the tree), so without this the attribute would
  // stay stale after navigating between EN and PL client-side.
  useEffect(() => {
    document.documentElement.lang = pathname?.startsWith("/pl") ? "pl" : "en";
  }, [pathname]);

  // Re-binds on every route change, so cards on a freshly navigated-to page
  // (client-side navigation doesn't remount MotionSystem) still get the tilt.
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointer = window.matchMedia("(hover:none), (pointer:coarse)").matches;
    if (coarsePointer || reduceMotion) return;

    const cards = Array.from(document.querySelectorAll<HTMLElement>(".cap-card, .work-card, .mentor-card"));
    let raf: number | null = null;
    const handlers: Array<{ el: HTMLElement; move: (e: MouseEvent) => void; leave: () => void }> = [];
    cards.forEach((card) => {
      const move = (e: MouseEvent) => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          const r = card.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          card.style.transform = `translateY(-4px) rotateX(${py * -4}deg) rotateY(${px * 5}deg)`;
          raf = null;
        });
      };
      const leave = () => {
        card.style.transform = "";
      };
      card.addEventListener("mousemove", move);
      card.addEventListener("mouseleave", leave);
      handlers.push({ el: card, move, leave });
    });

    return () => {
      handlers.forEach(({ el, move, leave }) => {
        el.removeEventListener("mousemove", move);
        el.removeEventListener("mouseleave", leave);
      });
    };
  }, [pathname]);

  return null;
}
