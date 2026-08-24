import Image from "next/image";
import Link from "next/link";
import type { ComponentType } from "react";

import { routeFor, caseStudyPath, type Locale } from "@/lib/routes";
import { PageHero } from "@/components/PageHero";
import { getAllProjects } from "@/features/work/projects";
import { TakBliskoArt, PlmsArt, VaultArt } from "@/features/home/SelectedWork";
import { HoldNavLink } from "@/components/navigation/HoldNavLink";

const ARROW = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);

/** See the matching map in CaseStudy.tsx - kept local to each presentation
 * component rather than in projects.ts so the data file stays JSX-free. */
const ART_BY_KEY: Record<string, ComponentType> = {
  takblisko: TakBliskoArt,
  plms: PlmsArt,
  vault: VaultArt,
};

const COPY = {
  en: {
    eyebrow: "Selected work",
    title: "Products and platforms we've built.",
    lede: "A mix of our own products, industry projects and research work - spanning product ownership, full-stack delivery and applied security research.",
    cta: "Start your project",
    caseStudy: "View case study",
  },
  pl: {
    eyebrow: "Wybrane realizacje",
    title: "Produkty i platformy, które zbudowaliśmy.",
    lede: "Połączenie naszych własnych produktów, projektów branżowych i prac badawczych - obejmujące własność produktową, dostarczanie full-stack i stosowane badania nad bezpieczeństwem.",
    cta: "Rozpocznij swój projekt",
    caseStudy: "Zobacz case study",
  },
};

/**
 * `/work` is the authoritative project overview (brief §5) - every card
 * here reads from the same `projects.ts` source as the homepage preview
 * and each project's own case study, and links straight into
 * `/work/[slug]` (or the PL equivalent) rather than staying a dead end.
 */
export function WorkPage({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const projects = getAllProjects();

  return (
    <main>
      <PageHero
        eyebrow={t.eyebrow}
        title={t.title}
        lede={t.lede}
        actions={
          <HoldNavLink href={routeFor("contact", locale)} className="btn btn-primary">
            {t.cta} {ARROW}
          </HoldNavLink>
        }
      />
      <section className="tight">
        <div className="wrap">
          <div className="work-grid reveal-stagger" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
            {projects.map((project) => {
              const ArtComponent = project.visual.kind === "art" ? ART_BY_KEY[project.visual.key] : null;
              return (
                <Link href={caseStudyPath(project.slug, locale)} className="work-card card" key={project.slug}>
                  <div className="work-visual">
                    {project.visual.kind === "image" ? (
                      <Image
                        src={project.visual.src}
                        alt={project.visual.alt[locale]}
                        width={project.visual.width}
                        height={project.visual.height}
                        className="work-visual-img"
                      />
                    ) : ArtComponent ? (
                      <ArtComponent />
                    ) : null}
                  </div>
                  <div className="work-body">
                    <div className="flag-row">
                      <span className="flagship">{project.projectLabel[locale]}</span>
                      {project.statusLabel ? (
                        <span className="flagship case-pill-status">{project.statusLabel[locale]}</span>
                      ) : null}
                    </div>
                    <b>{project.name}</b>
                    <p>{project.shortDescription[locale]}</p>
                    <div className="tag-row">
                      {project.tags.map((tag) => (
                        <span className="tag" key={tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                    <span className="work-role">{project.role[locale]}</span>
                    <span className="case-link">
                      {t.caseStudy} {ARROW}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
