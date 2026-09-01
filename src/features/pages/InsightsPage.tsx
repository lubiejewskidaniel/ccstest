import { PageHero } from "@/components/PageHero";
import type { Locale } from "@/lib/routes";
import { FireViewEvent } from "@/components/analytics/FireViewEvent";

const POSTS = [
  {
    tag: "SEO",
    bg: "radial-gradient(120% 140% at 30% 20%, rgba(59,130,246,.35), #0a0f1c 65%)",
    title: { en: "How to build an SEO strategy that actually works", pl: "Jak zbudować strategię SEO, która naprawdę działa" },
    meta: { en: "May 14, 2025 · 5 min read", pl: "14 maja 2025 · 5 min czytania" },
    excerpt: {
      en: "Most SEO advice is generic. Here's the short version of what we actually check first: technical health, information architecture, then content - in that order.",
      pl: "Większość porad SEO jest generyczna. Oto krótka wersja tego, co faktycznie sprawdzamy najpierw: kondycja techniczna, architektura informacji, a potem treść - w tej kolejności.",
    },
  },
  {
    tag: "GROW",
    bg: "#0c1120",
    title: { en: "Social media content that brings real results", pl: "Treści w social media, które przynoszą realne efekty" },
    meta: { en: "May 10, 2025 · 6 min read", pl: "10 maja 2025 · 6 min czytania" },
    excerpt: {
      en: "Posting more isn't the answer. We break down the three content formats that consistently outperform everything else for service businesses.",
      pl: "Publikowanie więcej nie jest odpowiedzią. Omawiamy trzy formaty treści, które konsekwentnie działają lepiej dla firm usługowych.",
    },
  },
  {
    tag: "BUILD",
    bg: "linear-gradient(160deg,#12213f,#070b15)",
    title: { en: "What makes a great MVP in 2025?", pl: "Co sprawia, że MVP jest dobre w 2025 roku?" },
    meta: { en: "May 6, 2025 · 7 min read", pl: "6 maja 2025 · 7 min czytania" },
    excerpt: {
      en: "A good MVP proves the riskiest assumption first, not the easiest feature. Here's how we scope one in the first working session.",
      pl: "Dobre MVP sprawdza najpierw najbardziej ryzykowne założenie, a nie najłatwiejszą funkcję. Tak wyznaczamy zakres na pierwszej roboczej sesji.",
    },
  },
];

const COPY = {
  en: {
    eyebrow: "Insights",
    title: "Knowledge that builds better products.",
    lede: "Notes from the studio floor - engineering, growth and mentoring, written the way we'd explain it to a client.",
    comingSoon: "More articles are on the way - this index grows alongside the studio.",
  },
  pl: {
    eyebrow: "Wiedza",
    title: "Wiedza, która buduje lepsze produkty.",
    lede: "Notatki z pracy studia - inżynieria, growth i mentoring, napisane tak, jak wyjaśnilibyśmy to klientowi.",
    comingSoon: "Kolejne artykuły w drodze - ten spis rośnie razem ze studiem.",
  },
};

export function InsightsPage({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  return (
    <main className="insights-page">
      <FireViewEvent event="insightsView" />
      <PageHero eyebrow={t.eyebrow} title={t.title} lede={t.lede} />

      <section className="tight">
        <div className="wrap">
          <div className="insights-grid reveal-stagger">
            {POSTS.map((post) => (
              <article className="insight-card card" key={post.title.en}>
                <div className="insight-visual" style={{ background: post.bg }}>
                  <span className="insights-tag-label">{post.tag}</span>
                </div>
                <div className="insight-body">
                  <b>{post.title[locale]}</b>
                  <p>{post.excerpt[locale]}</p>
                  <span className="insight-meta">{post.meta[locale]}</span>
                </div>
              </article>
            ))}
          </div>
          <p className="insights-coming-soon">{t.comingSoon}</p>
        </div>
      </section>
    </main>
  );
}
