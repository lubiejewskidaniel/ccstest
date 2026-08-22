"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Mounted once per route (from each page's top-level composition). Scans
 * for the plain `.reveal` / `.reveal-stagger` markers used throughout the
 * homepage and content pages and adds `.in` the first time each crosses
 * into view - a small, dependency-free stand-in for a heavier animation
 * library, matching doc 06 §4 "Signal Path" (motion for section reveals,
 * static under reduced motion - see the global `prefers-reduced-motion`
 * rule in globals.css, which this component doesn't need to special-case).
 */
export function SectionReveal() {
  const pathname = usePathname();

  useEffect(() => {
    const targets = Array.from(document.querySelectorAll(".reveal, .reveal-stagger"));
    if (!targets.length) return;

    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -6% 0px" }
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  return null;
}
