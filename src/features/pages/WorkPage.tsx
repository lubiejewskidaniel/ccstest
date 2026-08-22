import Link from "next/link";
import { routeFor, type Locale } from "@/lib/routes";
import { PageHero } from "@/components/PageHero";
import { TakBliskoArt, PlmsArt, VaultArt } from "@/features/home/SelectedWork";

const ARROW = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);

const PROJECTS = [
  {
    name: "TakBlisko",
    Art: TakBliskoArt,
    tags: ["Next.js", "PostgreSQL", "Maps API"],
    desc: {
      en: "Location-based platform connecting people with places and experiences. CCS's flagship owned product, in active development.",
      pl: "Platforma oparta na lokalizacji, łącząca ludzi z miejscami i wydarzeniami. Flagowy własny produkt CCS, w aktywnym rozwoju.",
    },
    role: { en: "Product, engineering & growth", pl: "Produkt, inżynieria i growth" },
  },
  {
    name: "PLMS",
    Art: PlmsArt,
    tags: ["Next.js", "Supabase", "Tailwind CSS"],
    desc: {
      en: "A learning management system for modern education - course delivery, progress tracking and role-based dashboards.",
      pl: "System LMS dla nowoczesnej edukacji - dostarczanie kursów, śledzenie postępów i panele zależne od roli.",
    },
    role: { en: "Client engagement - BUILD", pl: "Projekt klienta - BUILD" },
  },
  {
    name: "Dual-Layer Vault",
    Art: VaultArt,
    tags: ["Next.js", "Encryption", "Supabase"],
    desc: {
      en: "Secure, encrypted storage with layered access control, built for a client with strict confidentiality requirements.",
      pl: "Bezpieczne, szyfrowane przechowywanie danych z warstwową kontrolą dostępu, zbudowane dla klienta o wysokich wymaganiach poufności.",
    },
    role: { en: "Client engagement - BUILD", pl: "Projekt klienta - BUILD" },
  },
];

const COPY = {
  en: {
    eyebrow: "Selected work",
    title: "Products and platforms we've built.",
    lede: "A mix of our own products and client engagements - spanning consumer platforms, education technology and secure data systems.",
    cta: "Start your project",
  },
  pl: {
    eyebrow: "Wybrane realizacje",
    title: "Produkty i platformy, które zbudowaliśmy.",
    lede: "Połączenie naszych własnych produktów i projektów klienckich - platformy konsumenckie, edukacyjne i bezpieczne systemy danych.",
    cta: "Rozpocznij swój projekt",
  },
};

export function WorkPage({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  return (
    <main>
      <PageHero
        eyebrow={t.eyebrow}
        title={t.title}
        lede={t.lede}
        actions={
          <Link href={routeFor("contact", locale)} className="btn btn-primary">
            {t.cta} {ARROW}
          </Link>
        }
      />
      <section className="tight">
        <div className="wrap">
          <div className="work-grid reveal-stagger" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
            {PROJECTS.map((p) => (
              <div className="work-card card" key={p.name}>
                <div className="work-visual">
                  <p.Art />
                </div>
                <div className="work-body">
                  <b>{p.name}</b>
                  <p>{p.desc[locale]}</p>
                  <div className="tag-row">
                    {p.tags.map((tag) => (
                      <span className="tag" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <span className="case-link" style={{ color: "var(--ink-3)", fontWeight: 500 }}>
                    {p.role[locale]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
