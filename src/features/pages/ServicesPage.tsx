import { routeFor, type Locale } from "@/lib/routes";
import { PageHero } from "@/components/PageHero";
import { TrackedCtaLink } from "@/components/analytics/TrackedCtaLink";

const ARROW = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);

// `key` mirrors the slugs in `src/features/home/Capabilities.tsx` so the
// same offer reports under one consistent `service` value in
// `service_cta_click` events regardless of which page the click happened on.
const CAPS = [
  {
    key: "software-development",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M8 5 3 12l5 7M16 5l5 7-5 7" />
      </svg>
    ),
    title: { en: "Software Development", pl: "Wytwarzanie oprogramowania" },
    desc: {
      en: "Full-stack web and cloud applications, built on typed, testable foundations - from a single service to a multi-tenant platform.",
      pl: "Pełnostosowe aplikacje webowe i chmurowe, budowane na typowanych, testowalnych fundamentach - od pojedynczego serwisu po platformę wielodostępną.",
    },
    includes: {
      en: ["Web apps & APIs", "System integration", "Legacy modernization", "Cloud infrastructure"],
      pl: ["Aplikacje webowe i API", "Integracje systemowe", "Modernizacja legacy", "Infrastruktura chmurowa"],
    },
  },
  {
    key: "product-development",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 8 12 3 3 8l9 5 9-5Z" />
        <path d="M3 8v8l9 5 9-5V8M12 13v8" />
      </svg>
    ),
    title: { en: "Product Development", pl: "Rozwój produktów" },
    desc: {
      en: "From a validated idea to a shipped MVP and beyond - the same discipline we apply to our own products, applied to yours.",
      pl: "Od zwalidowanego pomysłu po wdrożone MVP i dalej - ta sama dyscyplina, którą stosujemy do własnych produktów, zastosowana do Twojego.",
    },
    includes: {
      en: ["MVP scoping & build", "SaaS architecture", "Iterative delivery", "Post-launch support"],
      pl: ["Zakres i budowa MVP", "Architektura SaaS", "Iteracyjne wdrażanie", "Wsparcie po starcie"],
    },
  },
  {
    key: "technology-consulting",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <ellipse cx="12" cy="5.5" rx="8" ry="3" />
        <path d="M4 5.5V12c0 1.7 3.6 3 8 3s8-1.3 8-3V5.5M4 12v6.5c0 1.7 3.6 3 8 3s8-1.3 8-3V12" />
      </svg>
    ),
    title: { en: "Technology Consulting", pl: "Doradztwo technologiczne" },
    desc: {
      en: "Architecture reviews, technical due diligence and roadmap guidance for teams making a decision they can't easily undo.",
      pl: "Przeglądy architektury, due diligence techniczne i doradztwo przy roadmapie dla zespołów podejmujących decyzje trudne do odwrócenia.",
    },
    includes: {
      en: ["Architecture audits", "Technical due diligence", "Vendor/stack selection", "Team & process advisory"],
      pl: ["Audyty architektury", "Due diligence techniczne", "Wybór dostawcy/stacku", "Doradztwo zespołowe i procesowe"],
    },
  },
  {
    key: "web-digital",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </svg>
    ),
    title: { en: "Web & Digital", pl: "Web i digital" },
    desc: {
      en: "Modern marketing sites, landing pages and internal tools - fast, accessible, and built to actually be maintained afterward.",
      pl: "Nowoczesne strony marketingowe, landing page'e i narzędzia wewnętrzne - szybkie, dostępne i realnie utrzymywalne po wdrożeniu.",
    },
    includes: {
      en: ["Marketing websites", "Landing pages", "Internal tools & dashboards", "CMS-backed platforms"],
      pl: ["Strony marketingowe", "Landing page'e", "Narzędzia i panele wewnętrzne", "Platformy z CMS"],
    },
  },
  {
    key: "growth-marketing",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 17l6-6 4 4 8-8M21 7v6M15 7h6" />
      </svg>
    ),
    title: { en: "Digital Growth & Marketing", pl: "Digital Growth i marketing" },
    desc: {
      en: "SEO, social, content and paid - run with the same measurement discipline as the engineering side. See the full Growth service.",
      pl: "SEO, social, treści i płatne kampanie - prowadzone z tą samą dyscypliną pomiaru co strona inżynierska. Zobacz pełną usługę Growth.",
    },
    includes: {
      en: ["SEO & local SEO", "Social media management", "Content & campaigns", "Analytics & reporting"],
      pl: ["SEO i lokalne SEO", "Zarządzanie social media", "Treści i kampanie", "Analityka i raportowanie"],
    },
    badge: true,
  },
  {
    key: "mentoring",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="3.4" />
        <path d="M5 20c1.4-4 4-6 7-6s5.6 2 7 6" />
      </svg>
    ),
    title: { en: "1:1 Mentoring", pl: "Mentoring 1:1" },
    desc: {
      en: "Programming, engineering and career mentoring for beginners, career changers and students. See the full Mentoring programme.",
      pl: "Mentoring programistyczny, inżynierski i kariery dla początkujących, zmieniających branżę i studentów. Zobacz pełny program mentoringu.",
    },
    includes: {
      en: ["1:1 sessions", "Concept explanation", "Career guidance", "Interview preparation"],
      pl: ["Sesje 1:1", "Wyjaśnianie koncepcji", "Doradztwo kariery", "Przygotowanie do rozmów"],
    },
  },
];

const COPY = {
  en: {
    eyebrow: "Services",
    title: "Four ways to work with CCS.",
    lede: "Every engagement starts with the same question: what does success actually look like for you? From there we pick the right mode - build it, own it together, grow it, or learn it.",
    ctaPrimary: "Start a project",
    ctaSecondary: "Explore growth services",
    discuss: "Discuss this",
    processEyebrow: "How engagements start",
    processTitle: "A short, honest scoping conversation - no pressure, no jargon.",
    processSteps: [
      { n: "01", t: "Tell us the goal", d: "A short form or call - what you're trying to achieve, and any constraints (timeline, budget, existing systems)." },
      { n: "02", t: "We scope it honestly", d: "If it's a good fit, we propose an approach and rough shape. If it's not, we'll say so and point you elsewhere." },
      { n: "03", t: "We agree the plan", d: "Clear milestones, clear communication cadence, no surprise scope creep." },
    ],
  },
  pl: {
    eyebrow: "Usługi",
    title: "Cztery sposoby współpracy z CCS.",
    lede: "Każda współpraca zaczyna się od tego samego pytania: jak w Twoim przypadku wygląda sukces? Stąd dobieramy właściwy tryb - budujemy to, tworzymy razem, rozwijamy, albo uczymy.",
    ctaPrimary: "Rozpocznij projekt",
    ctaSecondary: "Poznaj usługi growth",
    discuss: "Porozmawiajmy o tym",
    processEyebrow: "Jak zaczynamy współpracę",
    processTitle: "Krótka, szczera rozmowa o zakresie - bez presji i żargonu.",
    processSteps: [
      { n: "01", t: "Powiedz nam o celu", d: "Krótki formularz lub rozmowa - co chcesz osiągnąć i jakie są ograniczenia (czas, budżet, istniejące systemy)." },
      { n: "02", t: "Szczerze wyceniamy zakres", d: "Jeśli to dobre dopasowanie, proponujemy podejście i wstępny kształt. Jeśli nie - powiemy to wprost i wskażemy inną drogę." },
      { n: "03", t: "Ustalamy plan", d: "Jasne kamienie milowe, jasny rytm komunikacji, bez niespodziewanego rozrostu zakresu." },
    ],
  },
};

export function ServicesPage({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  return (
    <main>
      <PageHero
        eyebrow={t.eyebrow}
        title={t.title}
        lede={t.lede}
        actions={
          <>
            <TrackedCtaLink
              kind="service"
              service="general"
              ctaLocation="services-hero"
              href={routeFor("contact", locale)}
              className="btn btn-primary"
            >
              {t.ctaPrimary} {ARROW}
            </TrackedCtaLink>
            <TrackedCtaLink
              kind="service"
              service="growth-marketing"
              ctaLocation="services-hero"
              href={routeFor("growth", locale)}
              className="btn btn-ghost"
            >
              {t.ctaSecondary}
            </TrackedCtaLink>
          </>
        }
      />

      <section className="tight">
        <div className="wrap">
          <div className="cap-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
            {CAPS.map((item) => (
              <div className="cap-card card" key={item.title.en} style={{ minHeight: "auto" }}>
                <span className="cap-ic">
                  {item.icon}
                  {item.badge ? <span className="cap-new badge-new">NEW</span> : null}
                </span>
                <b>{item.title[locale]}</b>
                <p>{item.desc[locale]}</p>
                <ul className="tag-row" style={{ marginTop: 4 }}>
                  {item.includes[locale].map((tag) => (
                    <li className="tag" key={tag}>
                      {tag}
                    </li>
                  ))}
                </ul>
                <TrackedCtaLink
                  kind="service"
                  service={item.key}
                  ctaLocation="services-page-card"
                  href={routeFor("contact", locale)}
                  className="cap-link"
                >
                  {t.discuss} {ARROW}
                </TrackedCtaLink>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head reveal" style={{ marginBottom: 24 }}>
            <div>
              <span className="eyebrow">{t.processEyebrow}</span>
              <h2>{t.processTitle}</h2>
            </div>
          </div>
          <div className="process-row reveal-stagger" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
            {t.processSteps.map((step) => (
              <div className="process-step" key={step.n}>
                <span className="process-num">{step.n}</span>
                <b>{step.t}</b>
                <p>{step.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
