"use client";

import { usePathname } from "next/navigation";

/**
 * Wraps the purely decorative, marketing-site-only layer mounted in the
 * root layout (boot curtain, scroll-progress rail, animated spine,
 * back-to-top) so none of it renders under `/admin/**`.
 *
 * Root cause this fixes: `.spine` is `position: absolute` at
 * `left: var(--pad)` with a continuously animating traveling spark
 * (`travel-spine`, globals.css) — a fixed horizontal offset from the left
 * edge of the page. The admin sidebar (`.admin-nav`) also starts at the
 * left edge, so the two sat on top of each other with the spine's
 * infinite animation running behind/through the nav links. Excluding the
 * decorative layer here is the structural fix (not a z-index patch) --
 * an internal admin tool was never supposed to carry the marketing
 * site's motion layer in the first place.
 *
 * Same mechanism `SiteChrome` already uses for locale/route detection
 * (`usePathname()` from a small client component nested in the server
 * root layout), so this introduces no new pattern.
 */
export function PublicChrome({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	if (pathname?.startsWith("/admin")) return null;
	return <>{children}</>;
}
