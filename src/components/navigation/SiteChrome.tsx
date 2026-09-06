"use client";

import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/routes";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { CookieConsent } from "@/components/consent/CookieConsent";

/**
 * The whole app shares a single root layout (Next.js only allows one <html>
 * per tree), so locale-aware chrome (Header/Footer/CookieConsent all take an
 * explicit `locale` prop) needs to resolve which locale is active from the
 * current route rather than from a server-rendered param. `/pl/...` → pl,
 * everything else → en, matching the `routes.ts` path scheme exactly.
 *
 * The authenticated admin dashboard (`/admin`, `/admin/leads`,
 * `/admin/insights`, the `/admin/insights/**` editor/preview routes,
 * etc. — everything under `admin/(dashboard)/layout.tsx` plus the
 * bare auth-gated routes beside it) gets none of this marketing-site
 * chrome — it has its own header-less shell (sidebar + main).
 * `/admin/login`, however, is a public, unauthenticated page that just
 * happens to live under `/admin` — it gets the normal public Header/
 * Footer/CookieConsent like any other public route, so it reads as
 * part of the CCS site rather than an isolated tool, while every
 * other `/admin/*` path keeps its existing header-less treatment
 * unchanged. The `#main-content` wrapper still renders either way,
 * since the root layout's skip-link (`<a href="#main-content">`)
 * targets it on every route, admin included.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isAdminLogin = pathname === "/admin/login";

  if (pathname?.startsWith("/admin") && !isAdminLogin) {
    return <div id="main-content">{children}</div>;
  }

  // /admin/login has no locale variants (the whole admin area is
  // English-only), so it always renders the English header/footer —
  // the same fallback every other unmapped route already gets here.
  const locale: Locale = pathname?.startsWith("/pl") ? "pl" : "en";

  return (
    <>
      <Header locale={locale} />
      <div id="main-content">{children}</div>
      <Footer locale={locale} />
      <CookieConsent locale={locale} />
    </>
  );
}
