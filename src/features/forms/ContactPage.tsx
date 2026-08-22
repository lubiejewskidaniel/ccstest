import type { Locale } from "@/lib/routes";
import { ContactForm } from "./ContactForm";

const COPY = {
  en: {
    eyebrow: "Get in touch",
    title: "Let's talk about what you're building.",
    lede: "Whether it's a software project or a growth engagement, tell us what you're trying to achieve and we'll get back to you within two working days.",
    facts: [
      { t: "We reply personally", d: "No auto-responder loop - a real answer from the team." },
      { t: "Free initial scoping", d: "The first conversation costs nothing and carries no obligation." },
      { t: "We'll say no if it's not a fit", d: "And we'll try to point you somewhere better." },
    ],
  },
  pl: {
    eyebrow: "Skontaktuj się",
    title: "Porozmawiajmy o tym, co budujesz.",
    lede: "Niezależnie czy to projekt software'owy, czy współpraca growth, powiedz nam, co chcesz osiągnąć - odpowiemy w ciągu dwóch dni roboczych.",
    facts: [
      { t: "Odpowiadamy osobiście", d: "Bez pętli auto-respondera - prawdziwa odpowiedź od zespołu." },
      { t: "Bezpłatna wstępna wycena zakresu", d: "Pierwsza rozmowa nic nie kosztuje i do niczego nie zobowiązuje." },
      { t: "Powiemy 'nie', jeśli to nie pasuje", d: "I postaramy się wskazać lepsze miejsce." },
    ],
  },
};

export function ContactPage({ locale }: { locale: Locale }) {
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
          <ContactForm locale={locale} />
        </div>
      </section>
    </main>
  );
}
