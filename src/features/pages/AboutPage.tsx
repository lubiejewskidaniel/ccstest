import { routeFor, type Locale } from "@/lib/routes";
import { PageHero } from "@/components/PageHero";
import { HoldNavLink } from "@/components/navigation/HoldNavLink";

const ARROW = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);

const MODES = [
  { k: "BUILD", t: { en: "We build software.", pl: "Budujemy oprogramowanie." }, d: { en: "Engineering-led delivery for products and systems that need to hold up.", pl: "Wytwarzanie oprogramowania prowadzone inżyniersko, dla produktów i systemów, które muszą wytrzymać próbę czasu." } },
  { k: "CREATE", t: { en: "We create our own products.", pl: "Tworzymy własne produkty." }, d: { en: "Owned products like TakBlisko keep us honest about what we recommend to clients.", pl: "Własne produkty jak TakBlisko trzymają nas w ryzach co do tego, co rekomendujemy klientom." } },
  { k: "GROW", t: { en: "We grow businesses online.", pl: "Rozwijamy firmy online." }, d: { en: "SEO, content and paid, measured with the same rigor as the engineering side.", pl: "SEO, treści i płatne kampanie, mierzone z tą samą rzetelnością co strona inżynierska." } },
  { k: "TEACH", t: { en: "We teach the people behind it.", pl: "Uczymy ludzi, którzy za tym stoją." }, d: { en: "1:1 mentoring so the next generation of engineers understands the why, not just the how.", pl: "Mentoring 1:1, dzięki któremu kolejne pokolenie inżynierów rozumie dlaczego, nie tylko jak." } },
];

const VALUES = [
  { t: { en: "Technical excellence", pl: "Doskonałość techniczna" }, d: { en: "We ship code we'd be comfortable maintaining ourselves - because sometimes we do.", pl: "Dostarczamy kod, który sami chcielibyśmy utrzymywać - bo czasem to robimy." } },
  { t: { en: "Transparent communication", pl: "Transparentna komunikacja" }, d: { en: "Clear scope, clear timelines, and an honest 'no' when something isn't a good fit.", pl: "Jasny zakres, jasne terminy i szczere 'nie', gdy coś nie jest dobrym dopasowaniem." } },
  { t: { en: "Business-focused approach", pl: "Podejście zorientowane na biznes" }, d: { en: "Technology is a means, not the point - every decision ties back to your actual goal.", pl: "Technologia jest środkiem, nie celem - każda decyzja wiąże się z Twoim realnym celem." } },
  { t: { en: "Long-term partnership", pl: "Długofalowa współpraca" }, d: { en: "We'd rather do one relationship well for years than churn through one-off jobs.", pl: "Wolimy dobrze prowadzić jedną współpracę przez lata niż przechodzić przez jednorazowe zlecenia." } },
];

const COPY = {
  en: {
    eyebrow: "About CCS",
    title: "An engineering-led studio, not an agency.",
    lede: "Code Consulting Studio exists at the intersection of four things we're genuinely good at: building software, owning products, growing businesses online, and teaching the people who'll do this after us.",
    modesEyebrow: "How the studio is organized",
    modesTitle: "Four modes, one team.",
    valuesEyebrow: "What we care about",
    valuesTitle: "Why clients choose CCS.",
    cta: "Start a conversation",
  },
  pl: {
    eyebrow: "O CCS",
    title: "Studio inżynierskie, nie agencja.",
    lede: "Code Consulting Studio działa na przecięciu czterech rzeczy, w których jesteśmy naprawdę dobrzy: budowania oprogramowania, tworzenia własnych produktów, rozwijania firm online i uczenia ludzi, którzy będą to robić po nas.",
    modesEyebrow: "Jak zorganizowane jest studio",
    modesTitle: "Cztery tryby, jeden zespół.",
    valuesEyebrow: "Na czym nam zależy",
    valuesTitle: "Dlaczego klienci wybierają CCS.",
    cta: "Rozpocznij rozmowę",
  },
};

export function AboutPage({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  return (
    <main>
      <PageHero
        eyebrow={t.eyebrow}
        title={t.title}
        lede={t.lede}
        actions={
          <HoldNavLink href={routeFor("contact", locale)} className="btn btn-primary">
            {t.cta} {ARROW}
          </HoldNavLink>
        }
      />

      <section className="tight">
        <div className="wrap">
          <div className="section-head reveal" style={{ marginBottom: 24 }}>
            <div>
              <span className="eyebrow">{t.modesEyebrow}</span>
              <h2>{t.modesTitle}</h2>
            </div>
          </div>
          <div className="cap-grid reveal-stagger" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
            {MODES.map((m) => (
              <div className="cap-card card" key={m.k} style={{ minHeight: "auto" }}>
                <span className="flagship" style={{ alignSelf: "flex-start" }}>
                  {m.k}
                </span>
                <b>{m.t[locale]}</b>
                <p>{m.d[locale]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head reveal" style={{ marginBottom: 24 }}>
            <div>
              <span className="eyebrow">{t.valuesEyebrow}</span>
              <h2>{t.valuesTitle}</h2>
            </div>
          </div>
          <div className="cap-grid reveal-stagger" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
            {VALUES.map((v) => (
              <div className="cap-card card" key={v.t.en} style={{ minHeight: "auto" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--go)" strokeWidth="2.4" width="20" height="20">
                  <path d="m5 13 4 4 10-10" />
                </svg>
                <b>{v.t[locale]}</b>
                <p>{v.d[locale]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
