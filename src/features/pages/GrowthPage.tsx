import { routeFor, type Locale } from "@/lib/routes";
import { PageHero } from "@/components/PageHero";
import { TrackedCtaLink } from "@/components/analytics/TrackedCtaLink";

const ARROW = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);

const ITEMS = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    ),
    title: { en: "SEO & Local SEO", pl: "SEO i lokalne SEO" },
    desc: { en: "Technical SEO, content structure and local presence - built to outlast algorithm changes.", pl: "SEO techniczne, struktura treści i obecność lokalna - budowane tak, by przetrwać zmiany algorytmów." },
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 12a8 8 0 1 1-3.6-6.7L21 4l-1 4.4" />
      </svg>
    ),
    title: { en: "Social Media Management", pl: "Zarządzanie social media" },
    desc: { en: "We plan, create and publish - a consistent presence without it eating your week.", pl: "Planujemy, tworzymy i publikujemy - spójna obecność bez pochłaniania Twojego tygodnia." },
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="m8 13 3 3 5-6" />
      </svg>
    ),
    title: { en: "Content Creation", pl: "Tworzenie treści" },
    desc: { en: "Posts, graphics, Reels, video and long-form - matched to where your audience actually is.", pl: "Posty, grafiki, Reelsy, wideo i treści długoformatowe - dopasowane do tego, gdzie naprawdę jest Twoja publiczność." },
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r=".6" fill="currentColor" />
      </svg>
    ),
    title: { en: "Growth Strategy", pl: "Strategia rozwoju" },
    desc: { en: "A quarterly plan tied to a small number of metrics that actually matter to the business.", pl: "Kwartalny plan powiązany z niewielką liczbą metryk, które realnie mają znaczenie dla biznesu." },
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 19V9M12 19V5M20 19v-7" />
      </svg>
    ),
    title: { en: "Analytics & Reporting", pl: "Analityka i raportowanie" },
    desc: { en: "Plain-language monthly reports - what changed, why, and what we're doing about it.", pl: "Miesięczne raporty prostym językiem - co się zmieniło, dlaczego i co z tym robimy." },
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 11v2a2 2 0 0 0 2 2h1l7 4V5L6 9H5a2 2 0 0 0-2 2Z" />
        <path d="M16 9a4 4 0 0 1 0 6" />
      </svg>
    ),
    title: { en: "Ads Management", pl: "Zarządzanie kampaniami reklamowymi" },
    desc: { en: "Paid campaigns run with a budget discipline - scaled up only once a channel proves itself.", pl: "Kampanie płatne prowadzone z dyscypliną budżetową - skalowane dopiero, gdy kanał się sprawdzi." },
  },
];

const ENGAGEMENTS = [
  { t: { en: "One-off project", pl: "Projekt jednorazowy" }, d: { en: "A defined piece of work - an SEO audit, a campaign, a content sprint.", pl: "Konkretny zakres pracy - audyt SEO, kampania, sprint treściowy." } },
  { t: { en: "Managed / recurring", pl: "Zarządzane / cykliczne" }, d: { en: "Ongoing management across one or more channels, reviewed and reported monthly.", pl: "Ciągłe zarządzanie jednym lub kilkoma kanałami, przeglądane i raportowane co miesiąc." } },
];

const COPY = {
  en: {
    eyebrow: "Digital growth",
    title: "We help your business grow online.",
    lede: "GROW covers everything from technical SEO to paid campaigns - run with the same measurement discipline we bring to engineering, so you always know what's working.",
    cta: "Get a growth proposal",
    engageEyebrow: "How we engage",
    engageTitle: "Two ways to work together.",
  },
  pl: {
    eyebrow: "Digital growth",
    title: "Pomagamy Twojej firmie rosnąć online.",
    lede: "GROW obejmuje wszystko od technicznego SEO po kampanie płatne - prowadzone z tą samą dyscypliną pomiaru, którą wnosimy do inżynierii, więc zawsze wiesz, co działa.",
    cta: "Poproś o propozycję growth",
    engageEyebrow: "Jak współpracujemy",
    engageTitle: "Dwa sposoby współpracy.",
  },
};

export function GrowthPage({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  return (
    <main className="growth-page">
      <PageHero
        eyebrow={t.eyebrow}
        title={t.title}
        lede={t.lede}
        actions={
          <TrackedCtaLink
            kind="service"
            service="growth-marketing"
            ctaLocation="growth-hero"
            href={routeFor("contact", locale)}
            className="btn btn-primary"
          >
            {t.cta} {ARROW}
          </TrackedCtaLink>
        }
      />

      <section className="tight">
        <div className="wrap">
          <div className="growth-grid reveal-stagger">
            {ITEMS.map((item) => (
              <div className="growth-item" key={item.title.en}>
                <span className="growth-ic">{item.icon}</span>
                <b>{item.title[locale]}</b>
                <p>{item.desc[locale]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head section-head-tight reveal">
            <div>
              <span className="eyebrow">{t.engageEyebrow}</span>
              <h2>{t.engageTitle}</h2>
            </div>
          </div>
          <div className="mentor-grid mentor-grid-2col reveal-stagger">
            {ENGAGEMENTS.map((e) => (
              <div className="mentor-card card" key={e.t.en}>
                <b>{e.t[locale]}</b>
                <p>{e.d[locale]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
