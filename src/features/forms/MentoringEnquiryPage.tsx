import type { Locale } from "@/lib/routes";
import { MentoringEnquiryForm } from "./MentoringEnquiryForm";

const COPY = {
  en: {
    eyebrow: "Mentoring enquiry",
    title: "Book your first mentoring session.",
    lede: "Tell us where you're starting from and what you want to get out of it - we'll match the format and follow up to schedule.",
    facts: [
      { t: "1:1, not a cohort", d: "Sessions are tailored to you, not a fixed curriculum." },
      { t: "Under-18 friendly", d: "With parent/guardian involvement, clearly disclosed below." },
      { t: "We guide, not do", d: "See our academic integrity policy for what that means in practice." },
    ],
  },
  pl: {
    eyebrow: "Zapytanie o mentoring",
    title: "Umów pierwszą sesję mentoringu.",
    lede: "Powiedz nam, od czego zaczynasz i co chcesz osiągnąć - dopasujemy format i skontaktujemy się, by ustalić termin.",
    facts: [
      { t: "1:1, nie grupa", d: "Sesje są dopasowane do Ciebie, nie do sztywnego programu." },
      { t: "Przyjazne osobom poniżej 18 lat", d: "Z udziałem rodzica/opiekuna, wyraźnie opisanym poniżej." },
      { t: "Prowadzimy, nie robimy za Ciebie", d: "Zobacz naszą politykę rzetelności akademickiej, co to oznacza w praktyce." },
    ],
  },
};

export function MentoringEnquiryPage({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  return (
    <main>
      <section className="page-hero">
        <div className="wrap form-shell">
          <div className="form-side">
            <span className="eyebrow">{t.eyebrow}</span>
            <h1>{t.title}</h1>
            <p>{t.lede}</p>
            <div className="form-facts">
              {t.facts.map((f) => (
                <div className="form-fact" key={f.t}>
                  <span className="form-fact-ic">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m5 13 4 4 10-10" />
                    </svg>
                  </span>
                  <div>
                    <b>{f.t}</b>
                    <span>{f.d}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <MentoringEnquiryForm locale={locale} />
        </div>
      </section>
    </main>
  );
}
