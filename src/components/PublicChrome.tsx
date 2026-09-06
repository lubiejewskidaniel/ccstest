"use client";

import { usePathname } from "next/navigation";

/**
 * Wraps the purely decorative, marketing-site-only layer mounted in the
 * root layout (boot curtain, scroll-progress rail, animated spine,
 * back-to-top) so none of it renders under the authenticated `/admin/**`
 * dashboard.
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
 * `/admin/login`, however, is a public, unauthenticated page with no
 * sidebar (see SiteChrome.tsx, which already treats it as public for
 * Header/Footer/CookieConsent) -- the `.spine`/`.admin-nav` collision
 * this file exists to prevent doesn't apply there, so it gets the same
 * exact-match exception SiteChrome uses, keeping the two in agreement
 * about what counts as "public chrome". Letting this layer mount/unmount
 * in step with SiteChrome (rather than churning independently on the
 * public <-> /admin/login boundary) is also what MotionSystem's boot-
 * curtain handling now depends on -- see the comment there.
 *
 * Same mechanism `SiteChrome` already uses for locale/route detection
 * (`usePathname()` from a small client component nested in the server
 * root layout), so this introduces no new pattern.
 */
export function PublicChrome({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const isAdminLogin = pathname === "/admin/login";
	if (pathname?.startsWith("/admin") && !isAdminLogin) return null;
	return <>{children}</>;
}
