import type { Locale } from "@/lib/routes";
import { Hero } from "./Hero";
import { Capabilities } from "./Capabilities";
import { SelectedWork } from "./SelectedWork";
import { ProductSpotlight } from "./ProductSpotlight";
import { Growth } from "./Growth";
import { Process } from "./Process";
import { Mentoring } from "./Mentoring";
import { Insights } from "./Insights";

/**
 * Full homepage composition - the four-mode brand story in order:
 * Hero → Capabilities (what we do) → Selected work → Product spotlight
 * (CREATE) → Growth (GROW) → Process → Mentoring (TEACH) → Insights.
 * Rendered by both `src/app/page.tsx` (en) and `src/app/pl/page.tsx` (pl).
 */
export function Home({ locale }: { locale: Locale }) {
  return (
    <main>
      <Hero locale={locale} />
      <Capabilities locale={locale} />
      <SelectedWork locale={locale} />
      <ProductSpotlight locale={locale} />
      <Growth locale={locale} />
      <Process locale={locale} />
      <Mentoring locale={locale} />
      <Insights locale={locale} />
    </main>
  );
}
