import Link from "next/link";
import { routeFor, type Locale } from "@/lib/routes";
import { PageHero } from "@/components/PageHero";
import { MentorCanvas } from "@/features/home/MentorCanvas";
import { TrackedCtaLink } from "@/components/analytics/TrackedCtaLink";
import { FireViewEvent } from "@/components/analytics/FireViewEvent";

const ARROW = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);

const AUDIENCES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="3.4" />
        <path d="M5 20c1.4-4 4-6 7-6s5.6 2 7 6" />
      </svg>
    ),
    title: { en: "Starting out", pl: "Stawiasz pierwsze kroki" },
    desc: { en: "Beginners, career changers, self-learners building real foundations instead of copy-pasting tutorials.", pl: "Początkujący, osoby zmieniające branżę, samoucy budujący prawdziwe fundamenty zamiast kopiowania tutoriali." },
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="8.5" cy="8" r="3" />
        <circle cx="16" cy="9" r="2.4" />
        <path d="M2.5 20c1-3.6 3.4-5.6 6-5.6s5 2 6 5.6M15 14.6c2 .2 3.6 1.9 4.4 4.3" />
      </svg>
    ),
    title: { en: "University & Technical Study", pl: "Studia i przedmioty techniczne" },
    desc: { en: "Students who need concepts explained clearly - CCS teaches and guides, and never completes assessed work for you.", pl: "Studenci potrzebujący jasnych wyjaśnień - CCS uczy i wspiera, ale nigdy nie wykonuje za Ciebie ocenianych zadań." },
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 17l6-6 4 4 8-8M21 7v6M15 7h6" />
      </svg>
    ),
    title: { en: "Career changers", pl: "Zmieniający branżę" },
    desc: { en: "Coming from a different field and want a structured, honest path into software.", pl: "Osoby z innej branży, które chcą uporządkowanej i uczciwej ścieżki do świata software'u." },
  },
];

const HOW = [
  { t: { en: "Tell us your goal", pl: "Powiedz nam o celu" }, d: { en: "What you're studying or trying to learn, and your current level.", pl: "Czego się uczysz lub czego chcesz się nauczyć oraz jaki jest Twój obecny poziom." } },
  { t: { en: "We match the format", pl: "Dopasowujemy format" }, d: { en: "Regular 1:1 sessions or focused one-off help, depending on what you need.", pl: "Regularne sesje 1:1 lub jednorazowa, skupiona pomoc - zależnie od potrzeb." } },
  { t: { en: "You build real understanding", pl: "Budujesz realne zrozumienie" }, d: { en: "We explain the why, not just the how - so it sticks past the session.", pl: "Tłumaczymy dlaczego, nie tylko jak - żeby wiedza została na dłużej." } },
];

const COPY = {
  en: {
    eyebrow: "Mentoring",
    title: "Learn with real-world experience.",
    lede: "TEACH is personalized 1:1 mentoring in programming, engineering and career growth - from someone who ships production software, not just a curriculum.",
    cta: "Book a mentoring session",
    audEyebrow: "Who this is for",
    audTitle: "Three kinds of learners we work with.",
    howEyebrow: "How it works",
    howTitle: "A simple, honest process.",
    integrityTitle: "A note on academic integrity",
    integrityDesc: "CCS mentoring explains concepts, reviews your work and guides your thinking. We do not complete assignments, exams or assessed coursework on a student's behalf.",
    integrityLink: "Read our academic integrity policy",
    featureTitle: "Personalized 1:1 mentoring that helps you truly understand and build skills.",
  },
  pl: {
    eyebrow: "Mentoring",
    title: "Ucz się na realnym doświadczeniu.",
    lede: "TEACH to spersonalizowany mentoring 1:1 w programowaniu, inżynierii i rozwoju kariery - od osoby, która dostarcza działające oprogramowanie produkcyjne, a nie tylko program nauczania.",
    cta: "Umów sesję mentoringu",
    audEyebrow: "Dla kogo to jest",
    audTitle: "Trzy grupy osób, z którymi pracujemy.",
    howEyebrow: "Jak to działa",
    howTitle: "Prosty, uczciwy proces.",
    integrityTitle: "Uwaga o rzetelności akademickiej",
    integrityDesc: "Mentoring CCS wyjaśnia koncepcje, recenzuje Twoją pracę i prowadzi Twoje myślenie. Nie wykonujemy zadań, egzaminów ani ocenianych prac w imieniu studenta.",
    integrityLink: "Przeczytaj naszą politykę rzetelności akademickiej",
    featureTitle: "Spersonalizowany mentoring 1:1, który pomaga naprawdę zrozumieć i zbudować umiejętności.",
  },
};

export function MentoringPage({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  return (
    <main>
      <FireViewEvent event="mentoringView" />
      <PageHero
        eyebrow={t.eyebrow}
        title={t.title}
        lede={t.lede}
        actions={
          <TrackedCtaLink
            kind="service"
            service="mentoring"
            ctaLocation="mentoring-hero"
            href={routeFor("mentoringEnquire", locale)}
            className="btn btn-primary"
          >
            {t.cta} {ARROW}
          </TrackedCtaLink>
        }
      />

      <section className="tight">
        <div className="wrap">
          <div className="mentor-grid reveal-stagger" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 16 }}>
            {AUDIENCES.map((a) => (
              <div className="mentor-card card" key={a.title.en}>
                <span className="mentor-ic">{a.icon}</span>
                <b>{a.title[locale]}</b>
                <p>{a.desc[locale]}</p>
              </div>
            ))}
          </div>
          <div className="mentor-feature card reveal" style={{ minHeight: 220 }}>
            <MentorCanvas />
            <div className="content">
              <h3>{t.featureTitle}</h3>
              <TrackedCtaLink
                kind="service"
                service="mentoring"
                ctaLocation="mentoring-feature"
                href={routeFor("mentoringEnquire", locale)}
                className="btn btn-primary"
              >
                {t.cta} {ARROW}
              </TrackedCtaLink>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head reveal" style={{ marginBottom: 24 }}>
            <div>
              <span className="eyebrow">{t.howEyebrow}</span>
              <h2>{t.howTitle}</h2>
            </div>
          </div>
          <div className="process-row reveal-stagger" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
            {HOW.map((step, i) => (
              <div className="process-step" key={step.t.en}>
                <span className="process-num">{String(i + 1).padStart(2, "0")}</span>
                <b>{step.t[locale]}</b>
                <p>{step.d[locale]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="why-card card reveal" style={{ maxWidth: 640 }}>
            <b>{t.integrityTitle}</b>
            <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.6 }}>{t.integrityDesc}</p>
            <Link href={routeFor("academicIntegrity", locale)} className="case-link">
              {t.integrityLink} {ARROW}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
