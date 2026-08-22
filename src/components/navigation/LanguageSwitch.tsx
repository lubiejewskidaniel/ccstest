"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { alternatePath, resolveRoute, type Locale } from "@/lib/routes";
import { events, getBaseContext } from "@/lib/analytics";

/**
 * Preserves conceptual location when switching language (doc 04 principle:
 * "language switch resolves equivalent resource" - never just drops the
 * visitor back on the homepage).
 */
export function LanguageSwitch({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const resolved = resolveRoute(pathname);
  const otherHref = resolved ? alternatePath(pathname) : locale === "en" ? "/pl" : "/";

  function trackSwitch(to: Locale) {
    if (to === locale) return; // already on this language - not a real switch
    events.languageSwitch(locale, to, getBaseContext(pathname));
  }

  return (
    <div className="lang-switch" role="group" aria-label="Language">
      <Link
        href={locale === "en" ? pathname : otherHref}
        className={locale === "en" ? "active" : undefined}
        onClick={() => trackSwitch("en")}
      >
        EN
      </Link>
      <Link
        href={locale === "pl" ? pathname : otherHref}
        className={locale === "pl" ? "active" : undefined}
        onClick={() => trackSwitch("pl")}
      >
        PL
      </Link>
    </div>
  );
}
