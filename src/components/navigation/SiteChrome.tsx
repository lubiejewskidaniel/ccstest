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
 * `/admin/**` gets none of this marketing-site chrome — it has its own
 * header-less shell (sidebar + main, see `admin/(dashboard)/layout.tsx`).
 * The `#main-content` wrapper still renders either way, since the root
 * layout's skip-link (`<a href="#main-content">`) targets it on every
 * route, admin included.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname?.startsWith("/admin")) {
    return <div id="main-content">{children}</div>;
  }

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
