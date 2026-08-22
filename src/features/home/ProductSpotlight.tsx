import Link from "next/link";
import { routeFor, type Locale } from "@/lib/routes";

const ARROW = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);

const COPY = {
  en: {
    eyebrow: "Our products",
    title: "We build our own ideas too.",
    viewAll: "View all products",
    flagship: "OUR FLAGSHIP",
    desc: "Discover, explore and connect with places that matter to you.",
    feat1: "Interactive map & discovery",
    feat2: "Personalized recommendations",
    builtBy: "Built by CCS",
    active: "Active",
    explore: "Explore TakBlisko",
  },
  pl: {
    eyebrow: "Nasze produkty",
    title: "Budujemy też własne pomysły.",
    viewAll: "Zobacz wszystkie produkty",
    flagship: "NASZ FLAGOWY PRODUKT",
    desc: "Odkrywaj, poznawaj i łącz się z miejscami, które są dla Ciebie ważne.",
    feat1: "Interaktywna mapa i odkrywanie",
    feat2: "Spersonalizowane rekomendacje",
    builtBy: "Stworzone przez CCS",
    active: "Aktywny",
    explore: "Poznaj TakBlisko",
  },
};

export function ProductSpotlight({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  return (
    <section id="products">
      <div className="wrap">
        <div className="section-head reveal">
          <div>
            <span className="eyebrow">{t.eyebrow}</span>
            <h2>{t.title}</h2>
          </div>
          <Link href={routeFor("products", locale)} className="view-all">
            {t.viewAll} {ARROW}
          </Link>
        </div>

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
              <h3>TakBlisko</h3>
              <span className="flagship">{t.flagship}</span>
            </div>
            <p>{t.desc}</p>
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
            <div className="spotlight-foot">
              <div>
                <span className="built-by">{t.builtBy}</span>
                <div className="status-dot">
                  <i />
                  {t.active}
                </div>
              </div>
              <a href="#" className="btn btn-dark">
                {t.explore}{" "}
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 17 17 7M9 7h8v8" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
