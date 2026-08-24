import Image from "next/image";
import Link from "next/link";
import type { ComponentType } from "react";

import { routeFor, type Locale } from "@/lib/routes";
import type { Project } from "@/features/work/projects";
import { HoldNavLink } from "@/components/navigation/HoldNavLink";
import { TakBliskoArt, PlmsArt, VaultArt } from "@/features/home/SelectedWork";

const ARROW = (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
		<path d="M7 17 17 7M9 7h8v8" />
	</svg>
);

const BACK_ARROW = (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
		<path d="m11 17-5-5 5-5M6 12h12" />
	</svg>
);

const CHECK = (
	<svg viewBox="0 0 24 24" fill="none" stroke="var(--go)" strokeWidth="2.4" width="16" height="16" aria-hidden="true">
		<path d="m5 13 4 4 10-10" />
	</svg>
);

/**
 * Maps a project's `visual.key` (art) to the matching illustration
 * component. Kept here, in the presentation layer, rather than in
 * `projects.ts` - the data file stays JSX-free so it can be imported from
 * `generateMetadata`/the sitemap without pulling component code along.
 */
const ART_BY_KEY: Record<string, ComponentType> = {
	takblisko: TakBliskoArt,
	plms: PlmsArt,
	vault: VaultArt,
};

const COPY = {
	en: {
		home: "Home",
		work: "Work",
		challenge: "The challenge",
		approach: "The approach",
		outcome: "Outcome",
		role: "Role",
		team: "Team",
		delivery: "Delivery",
		capabilities: "Key capabilities",
		technology: "Technology & engineering",
		researchOutcome: "Research outcome",
		back: "Back to Work",
		contactCta: "Start your project",
	},
	pl: {
		home: "Strona główna",
		work: "Realizacje",
		challenge: "Wyzwanie",
		approach: "Podejście",
		outcome: "Efekt",
		role: "Rola",
		team: "Zespół",
		delivery: "Dostarczenie",
		capabilities: "Kluczowe kompetencje",
		technology: "Technologia i inżynieria",
		researchOutcome: "Wynik badań",
		back: "Powrót do Realizacji",
		contactCta: "Rozpocznij swój projekt",
	},
};

/**
 * Reusable case-study layout, driven entirely by one `Project` record from
 * `projects.ts`. Every section below is optional and renders only when the
 * project actually has that data - TakBlisko, PLMS and Dual-Layer Vault
 * share this exact component but end up with visibly different pages,
 * because they're different kinds of projects with different stories to
 * tell, not because of per-project markup forks.
 */
export function CaseStudy({ project, locale }: { project: Project; locale: Locale }) {
	const t = COPY[locale];
	const cs = project.caseStudy;
	const workHref = routeFor("work", locale);
	const homeHref = routeFor("home", locale);
	const ArtComponent = project.visual.kind === "art" ? ART_BY_KEY[project.visual.key] : null;

	// No <main> here on purpose - this same component renders both inside
	// the standalone route's own <main> (see work/[slug]/page.tsx) and
	// inside the intercepted modal's role="dialog" (see
	// components/work/CaseStudyModal.tsx), and a page must not end up with
	// two <main> landmarks when the modal is open over /work.
	return (
		<article className="case-study">
				<div className="wrap case-study-head">
					<nav className="breadcrumb" aria-label="Breadcrumb">
						<Link href={homeHref}>{t.home}</Link>
						<span aria-hidden="true">/</span>
						<Link href={workHref}>{t.work}</Link>
						<span aria-hidden="true">/</span>
						<span aria-current="page">{project.name}</span>
					</nav>

					<div className="case-pill-row">
						<span className="flagship">{project.projectLabel[locale]}</span>
						{project.statusLabel ? (
							<span className="flagship case-pill-status">{project.statusLabel[locale]}</span>
						) : null}
					</div>

					<h1>{project.name}</h1>
					<p className="lede">{cs.headline[locale]}</p>
				</div>

				<div className="wrap case-study-visual">
					{project.visual.kind === "image" ? (
						<Image
							src={project.visual.src}
							alt={project.visual.alt[locale]}
							width={project.visual.width}
							height={project.visual.height}
							className="case-visual-img"
							sizes="(max-width: 768px) 92vw, 900px"
							priority
						/>
					) : ArtComponent ? (
						<div className="case-visual-art">
							<ArtComponent />
						</div>
					) : null}
				</div>

				<div className="wrap case-study-body">
					<section className="case-section">
						<p className="case-overview">{cs.overview[locale]}</p>
					</section>

					{cs.challenge || cs.approach ? (
						<section className="case-grid-2">
							{cs.challenge ? (
								<div className="case-block">
									<h2>{t.challenge}</h2>
									<p>{cs.challenge[locale]}</p>
								</div>
							) : null}
							{cs.approach ? (
								<div className="case-block">
									<h2>{t.approach}</h2>
									<p>{cs.approach[locale]}</p>
								</div>
							) : null}
						</section>
					) : null}

					{cs.roleDetail || cs.team || cs.delivery ? (
						<section className="case-context">
							{cs.roleDetail ? (
								<div className="case-context-item">
									<span className="case-context-label">{t.role}</span>
									<span className="case-context-value">{cs.roleDetail[locale]}</span>
								</div>
							) : null}
							{cs.team ? (
								<div className="case-context-item">
									<span className="case-context-label">{t.team}</span>
									<span className="case-context-value">{cs.team[locale]}</span>
								</div>
							) : null}
							{cs.delivery ? (
								<div className="case-context-item">
									<span className="case-context-label">{t.delivery}</span>
									<span className="case-context-value">{cs.delivery[locale]}</span>
								</div>
							) : null}
						</section>
					) : null}

					{cs.capabilities && cs.capabilities.length > 0 ? (
						<section className="case-section">
							<h2>{t.capabilities}</h2>
							<ul className="case-capabilities">
								{cs.capabilities.map((c) => (
									<li key={c.en}>
										{CHECK}
										{c[locale]}
									</li>
								))}
							</ul>
						</section>
					) : null}

					<section className="case-section">
						<h2>{t.technology}</h2>
						{cs.technologyGroups && cs.technologyGroups.length > 0 ? (
							<div className="case-tech-groups">
								{cs.technologyGroups.map((group) => (
									<div className="case-tech-group" key={group.heading.en}>
										<span className="case-tech-group-label">{group.heading[locale]}</span>
										<div className="tag-row">
											{group.items.map((item) => (
												<span className="tag" key={item}>
													{item}
												</span>
											))}
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="tag-row">
								{cs.technologies.map((tech) => (
									<span className="tag" key={tech}>
										{tech}
									</span>
								))}
							</div>
						)}
					</section>

					{cs.sections && cs.sections.length > 0
						? cs.sections.map((s) => (
								<section className="case-block" key={s.heading.en}>
									<h2>{s.heading[locale]}</h2>
									<p>{s.body[locale]}</p>
								</section>
							))
						: null}

					{cs.outcome ? (
						<section className="case-block">
							<h2>{t.outcome}</h2>
							<p>{cs.outcome[locale]}</p>
						</section>
					) : null}

					{cs.researchOutcome ? (
						<section className="case-research">
							<span className="case-research-label">{t.researchOutcome}</span>
							<p>{cs.researchOutcome[locale]}</p>
						</section>
					) : null}

					<div className="case-cta-row">
						{cs.cta ? (
							cs.cta.external ? (
								<a href={cs.cta.href} target="_blank" rel="noopener" className="btn btn-primary">
									{cs.cta.label[locale]} {ARROW}
								</a>
							) : (
								<HoldNavLink href={cs.cta.href} className="btn btn-primary">
									{cs.cta.label[locale]} {ARROW}
								</HoldNavLink>
							)
						) : (
							<HoldNavLink href={routeFor("contact", locale)} className="btn btn-primary">
								{t.contactCta} {ARROW}
							</HoldNavLink>
						)}
						<HoldNavLink href={workHref} className="case-back-link">
							{BACK_ARROW} {t.back}
						</HoldNavLink>
					</div>
				</div>
		</article>
	);
}
