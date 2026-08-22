"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { routeFor, type Locale } from "@/lib/routes";

const COPY = {
  en: {
    eyebrow: "404",
    title: "This path doesn't lead anywhere yet.",
    desc: "The page you're looking for may have moved, or the link is out of date.",
    cta: "Back to homepage",
  },
  pl: {
    eyebrow: "404",
    title: "Ta ścieżka donikąd nie prowadzi.",
    desc: "Strona, której szukasz, mogła zostać przeniesiona albo link jest nieaktualny.",
    cta: "Wróć na stronę główną",
  },
};

export default function NotFound() {
  const pathname = usePathname();
  const locale: Locale = pathname?.startsWith("/pl") ? "pl" : "en";
  const t = COPY[locale];

  return (
    <main>
      <section style={{ borderTop: "none", padding: "min(14vw, 140px) 0" }}>
        <div className="wrap" style={{ maxWidth: 560, textAlign: "center", margin: "0 auto" }}>
          <span className="eyebrow" style={{ justifyContent: "center" }}>
            {t.eyebrow}
          </span>
          <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", marginTop: 16, fontWeight: 600 }}>{t.title}</h1>
          <p style={{ color: "var(--ink-2)", marginTop: 14, lineHeight: 1.6 }}>{t.desc}</p>
          <Link href={routeFor("home", locale)} className="btn btn-primary" style={{ marginTop: 28 }}>
            {t.cta}
          </Link>
        </div>
      </section>
    </main>
  );
}
