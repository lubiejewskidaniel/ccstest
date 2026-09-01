import { routeFor, type Locale } from "@/lib/routes";
import { PageHero } from "@/components/PageHero";
import { HoldNavLink } from "@/components/navigation/HoldNavLink";

const ARROW = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);

const COPY = {
  en: {
    eyebrow: "Our products",
    title: "We build our own ideas too.",
    lede: "CREATE is the mode where we're the client - owned products, developed with the same discipline we bring to client work, and used as a proving ground for what we recommend to others.",
    flagship: "OUR FLAGSHIP",
    productName: "TakBlisko",
    productDesc: "Discover, explore and connect with places that matter to you - a location-based platform built for genuine local discovery, not another feed.",
    feat1: "Interactive map & discovery",
    feat2: "Personalized recommendations",
    status: "In active development",
    nextTitle: "What's next in CREATE",
    nextLede: "New products move from internal prototype to public roadmap once they've proven the idea holds up under real use.",
    nextItems: [
      { t: "Internal tools, productized", d: "Utilities we build for our own delivery work, occasionally worth shipping on their own." },
      { t: "Community input", d: "TakBlisko's roadmap is shaped in part by the people using it - see Insights for updates." },
    ],
    cta: "Talk to us about a product idea",
  },
  pl: {
    eyebrow: "Nasze produkty",
    title: "Budujemy też własne pomysły.",
    lede: "CREATE to tryb, w którym sami jesteśmy klientem - własne produkty, rozwijane z tą samą dyscypliną, którą wnosimy do projektów klienckich, i poligon doświadczalny dla tego, co rekomendujemy innym.",
    flagship: "NASZ FLAGOWY PRODUKT",
    productName: "TakBlisko",
    productDesc: "Odkrywaj, poznawaj i łącz się z miejscami, które są dla Ciebie ważne - platforma oparta na lokalizacji, zbudowana dla prawdziwego lokalnego odkrywania, a nie kolejnego feedu.",
    feat1: "Interaktywna mapa i odkrywanie",
    feat2: "Spersonalizowane rekomendacje",
    status: "W aktywnym rozwoju",
    nextTitle: "Co dalej w CREATE",
    nextLede: "Nowe produkty przechodzą z wewnętrznego prototypu na publiczną roadmapę, gdy pomysł sprawdzi się w realnym użyciu.",
    nextItems: [
      { t: "Narzędzia wewnętrzne jako produkty", d: "Narzędzia, które budujemy na własne potrzeby projektowe, czasem warte wydania osobno." },
      { t: "Głos społeczności", d: "Roadmapa TakBlisko jest częściowo kształtowana przez osoby, które z niego korzystają - sprawdź Insights." },
    ],
    cta: "Porozmawiajmy o pomyśle na produkt",
  },
};

export function ProductsPage({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  return (
    <main className="products-page">
      <PageHero eyebrow={t.eyebrow} title={t.title} lede={t.lede} />

      <section className="tight">
        <div className="wrap">
          <div className="spotlight card reveal">
            <div className="spotlight-visual">
              <svg viewBox="0 0 320 240" width="100%" style={{ maxWidth: 320 }} aria-hidden="true">
                <rect x="20" y="14" width="130" height="212" rx="20" fill="#0d1526" stroke="#26365c" strokeWidth="2" />
                <rect x="34" y="34" width="102" height="150" rx="6" fill="#111a2e" />
                <path d="M40 150 C70 110 90 130 110 90 C120 70 130 78 132 60" stroke="#3b82f6" strokeWidth="2" fill="none" opacity=".6" />
                <circle cx="90" cy="112" r="16" fill="#3b82f6" opacity=".35" />
                <circle cx="90" cy="112" r="5" fill="#7fd9ff" />
                <rect x="34" y="192" width="102" height="8" rx="4" fill="#26365c" />
                <rect x="150" y="34" width="150" height="192" rx="20" fill="#0c1120" stroke="#26365c" strokeWidth="2" />
                <rect x="164" y="54" width="122" height="140" rx="8" fill="#111a2e" />
                <g fill="#1c2947">
                  <rect x="174" y="64" width="102" height="26" rx="6" />
                  <rect x="174" y="96" width="102" height="26" rx="6" />
                  <rect x="174" y="128" width="102" height="26" rx="6" />
                </g>
                <circle cx="188" cy="77" r="4" fill="#34d399" />
                <circle cx="188" cy="109" r="4" fill="#3b82f6" />
                <circle cx="188" cy="141" r="4" fill="#fbbf24" />
              </svg>
            </div>
            <div className="spotlight-body">
              <div className="flag-row">
                <h3>{t.productName}</h3>
                <span className="flagship">{t.flagship}</span>
              </div>
              <p>{t.productDesc}</p>
              <ul className="feat-list">
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {t.feat1}
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="4" y="10" width="16" height="10" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                  {t.feat2}
                </li>
              </ul>
              <div className="status-dot">
                <i />
                {t.status}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head section-head-tight reveal">
            <div>
              <span className="eyebrow">{t.nextTitle}</span>
              <h2>{t.nextLede}</h2>
            </div>
          </div>
          <div className="mentor-grid mentor-grid-2col reveal-stagger">
            {t.nextItems.map((item) => (
              <div className="mentor-card card" key={item.t}>
                <b>{item.t}</b>
                <p>{item.d}</p>
              </div>
            ))}
          </div>
          <div className="products-cta">
            <HoldNavLink href={routeFor("contact", locale)} className="btn btn-dark">
              {t.cta} {ARROW}
            </HoldNavLink>
          </div>
        </div>
      </section>
    </main>
  );
}
