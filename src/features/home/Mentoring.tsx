import Link from "next/link";
import { routeFor, type Locale } from "@/lib/routes";
import { MentorCanvas } from "./MentorCanvas";

const COPY = {
  en: {
    eyebrow: "Mentoring",
    title: "Learn with real-world experience.",
    card1Title: "Starting out",
    card1Desc: "Beginners, career changers, self-learners.",
    card2Title: "University & Technical Study",
    card2Desc: "Students who need concepts explained.",
    featureTitle: "Personalized 1:1 mentoring that helps you truly understand and build skills.",
    cta: "Explore mentoring",
  },
  pl: {
    eyebrow: "Mentoring",
    title: "Ucz się na realnym doświadczeniu.",
    card1Title: "Stawiasz pierwsze kroki",
    card1Desc: "Początkujący, osoby zmieniające branżę, samoucy.",
    card2Title: "Studia i przedmioty techniczne",
    card2Desc: "Studenci potrzebujący jasnych wyjaśnień.",
    featureTitle: "Spersonalizowany mentoring 1:1, który pomaga naprawdę zrozumieć i zbudować umiejętności.",
    cta: "Poznaj mentoring",
  },
};

export function Mentoring({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  return (
    <section id="mentoring">
      <div className="wrap">
        <div className="section-head reveal" style={{ marginBottom: 24 }}>
          <div>
            <span className="eyebrow">{t.eyebrow}</span>
            <h2>{t.title}</h2>
          </div>
        </div>

        <div className="mentor-grid reveal-stagger">
          <div className="mentor-card card">
            <span className="mentor-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="8" r="3.4" />
                <path d="M5 20c1.4-4 4-6 7-6s5.6 2 7 6" />
              </svg>
            </span>
            <b>{t.card1Title}</b>
            <p>{t.card1Desc}</p>
          </div>
          <div className="mentor-card card">
            <span className="mentor-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="8.5" cy="8" r="3" />
                <circle cx="16" cy="9" r="2.4" />
                <path d="M2.5 20c1-3.6 3.4-5.6 6-5.6s5 2 6 5.6M15 14.6c2 .2 3.6 1.9 4.4 4.3" />
              </svg>
            </span>
            <b>{t.card2Title}</b>
            <p>{t.card2Desc}</p>
          </div>
          <div className="mentor-feature card">
            <MentorCanvas />
            <div className="content">
              <h3>{t.featureTitle}</h3>
              <Link href={routeFor("mentoringEnquire", locale)} className="btn btn-primary">
                {t.cta}{" "}
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 17 17 7M9 7h8v8" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
