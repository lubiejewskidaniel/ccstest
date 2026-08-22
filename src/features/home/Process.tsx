import Link from "next/link";
import { routeFor, type Locale } from "@/lib/routes";

const ARROW = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);

const STEPS = [
  { num: "01", title: { en: "Discover", pl: "Poznanie" }, desc: { en: "We understand your business and goals.", pl: "Poznajemy Twoją firmę i cele." } },
  { num: "02", title: { en: "Define", pl: "Zdefiniowanie" }, desc: { en: "We plan the right solution and strategy.", pl: "Planujemy właściwe rozwiązanie i strategię." } },
  { num: "03", title: { en: "Design", pl: "Projekt" }, desc: { en: "We design with users and results in mind.", pl: "Projektujemy z myślą o użytkownikach i efektach." } },
  { num: "04", title: { en: "Build", pl: "Budowa" }, desc: { en: "We build with clean and scalable code.", pl: "Budujemy w oparciu o czysty, skalowalny kod." } },
  { num: "05", title: { en: "Launch", pl: "Wdrożenie" }, desc: { en: "We deploy and make it live.", pl: "Wdrażamy i uruchamiamy produkcyjnie." } },
  { num: "06", title: { en: "Grow", pl: "Rozwój" }, desc: { en: "We optimize, market and scale results.", pl: "Optymalizujemy, promujemy i skalujemy efekty." } },
];

const COPY = {
  en: { eyebrow: "Our process", title: "A clear path to success.", viewAll: "See the process" },
  pl: { eyebrow: "Nasz proces", title: "Jasna droga do sukcesu.", viewAll: "Zobacz proces" },
};

export function Process({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  return (
    <section id="process">
      <div className="wrap">
        <div className="section-head reveal" style={{ marginBottom: 24 }}>
          <div>
            <span className="eyebrow">{t.eyebrow}</span>
            <h2>{t.title}</h2>
          </div>
          <Link href={routeFor("services", locale)} className="view-all">
            {t.viewAll} {ARROW}
          </Link>
        </div>

        <div className="process-row reveal-stagger">
          {STEPS.map((step) => (
            <div className="process-step" key={step.num}>
              <span className="process-num">{step.num}</span>
              <b>{step.title[locale]}</b>
              <p>{step.desc[locale]}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
