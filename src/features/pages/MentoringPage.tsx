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
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.8"
			>
				<circle cx="12" cy="8" r="3.4" />
				<path d="M5 20c1.4-4 4-6 7-6s5.6 2 7 6" />
			</svg>
		),

		title: {
			en: "Starting in tech",
			pl: "Pierwsze kroki w technologii",
		},

		desc: {
			en: "Beginners, self-learners and career changers building strong foundations in programming, computing and software development.",
			pl: "Początkujący, samoucy i osoby zmieniające branżę, które chcą zbudować solidne podstawy programowania, informatyki i tworzenia oprogramowania.",
		},
	},

	{
		icon: (
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.8"
			>
				<circle cx="8.5" cy="8" r="3" />
				<circle cx="16" cy="9" r="2.4" />
				<path d="M2.5 20c1-3.6 3.4-5.6 6-5.6s5 2 6 5.6M15 14.6c2 .2 3.6 1.9 4.4 4.3" />
			</svg>
		),

		title: {
			en: "University & academic development",
			pl: "Studia i rozwój akademicki",
		},

		desc: {
			en: "Support with computing concepts, projects, dissertations, research methods and academic development - always with academic integrity in mind.",
			pl: "Wsparcie w zagadnieniach informatycznych, projektach, pracach dyplomowych, metodach badawczych i rozwoju akademickim - zawsze z poszanowaniem zasad rzetelności akademickiej.",
		},
	},

	{
		icon: (
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.8"
			>
				<path d="M3 17l6-6 4 4 8-8M21 7v6M15 7h6" />
			</svg>
		),

		title: {
			en: "Professional growth & teams",
			pl: "Rozwój zawodowy i zespoły",
		},

		desc: {
			en: "Practical guidance for professionals and teams - from technical skills and projects to tailored training and technology adoption.",
			pl: "Praktyczne wsparcie dla specjalistów i zespołów - od rozwoju umiejętności technicznych i projektów po dopasowane szkolenia i wdrażanie technologii.",
		},
	},
];

const HOW = [
	{
		t: {
			en: "Tell us your goal",
			pl: "Powiedz nam, jaki masz cel",
		},

		d: {
			en: "Tell us what you want to learn, improve or achieve and where you are today.",
			pl: "Powiedz nam, czego chcesz się nauczyć, co rozwinąć lub osiągnąć i na jakim etapie jesteś obecnie.",
		},
	},

	{
		t: {
			en: "We match the format",
			pl: "Dobieramy odpowiednią formę",
		},

		d: {
			en: "1:1 mentoring, project guidance, academic support or tailored team training - depending on what you need.",
			pl: "Mentoring 1:1, konsultacje projektowe, wsparcie akademickie lub szkolenia dla zespołów - zależnie od potrzeb.",
		},
	},

	{
		t: {
			en: "You build real understanding",
			pl: "Budujesz prawdziwe zrozumienie",
		},

		d: {
			en: "We explain why things work, not just how to do them - so the knowledge stays useful beyond the session.",
			pl: "Tłumaczymy, dlaczego coś działa, a nie tylko jak to zrobić - dzięki temu wiedza zostaje z Tobą na dłużej.",
		},
	},
];

const COPY = {
	en: {
		eyebrow: "CCS Teach",

		title: "Learn with real-world experience.",

		lede: "CCS TEACH combines practical software development, current academic experience and technology education. From first steps in programming and university study to professional development and team training, we help people and teams build skills they can use in practice.",

		cta: "Discuss your goals",

		audEyebrow: "Who we work with",

		audTitle: "Learning and development at every stage.",

		howEyebrow: "How it works",

		howTitle: "A simple, honest process.",

		integrityTitle: "Academic integrity matters",

		integrityDesc:
			"CCS helps students understand concepts, plan their work, review their own solutions and develop stronger academic and technical skills. We do not write assignments, complete assessments or produce work for submission on a student's behalf.",

		integrityLink: "Read our academic integrity policy",

		featureTitle:
			"From individual mentoring to team training - practical learning built around real goals.",
	},

	pl: {
		eyebrow: "CCS Teach",

		title: "Ucz się poprzez praktykę i realne doświadczenie.",

		lede: "CCS TEACH łączy praktyczne doświadczenie w tworzeniu oprogramowania, aktualną wiedzę akademicką i edukację technologiczną. Od pierwszych kroków w programowaniu i studiów po rozwój zawodowy i szkolenia zespołów - pomagamy ludziom i zespołom rozwijać umiejętności, które można wykorzystać w praktyce.",

		cta: "Porozmawiajmy o Twoich celach",

		audEyebrow: "Z kim pracujemy",

		audTitle: "Nauka i rozwój na każdym etapie.",

		howEyebrow: "Jak to działa",

		howTitle: "Prosty i uczciwy proces.",

		integrityTitle: "Rzetelność akademicka ma znaczenie",

		integrityDesc:
			"CCS pomaga studentom zrozumieć zagadnienia, zaplanować własną pracę, analizować własne rozwiązania i rozwijać kompetencje akademickie oraz techniczne. Nie piszemy prac zaliczeniowych, nie wykonujemy ocenianych zadań ani nie przygotowujemy prac do oddania w imieniu studenta.",

		integrityLink: "Przeczytaj naszą politykę rzetelności akademickiej",

		featureTitle:
			"Od indywidualnego mentoringu po szkolenia zespołów - praktyczna nauka oparta na realnych celach.",
	},
};

export function MentoringPage({ locale }: { locale: Locale }) {
	const t = COPY[locale];

	return (
		<main className="mentoring-page">
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
					<div className="mentor-grid reveal-stagger">
						{AUDIENCES.map((a) => (
							<div className="mentor-card card" key={a.title.en}>
								<span className="mentor-ic">{a.icon}</span>
								<b>{a.title[locale]}</b>
								<p>{a.desc[locale]}</p>
							</div>
						))}
					</div>

					<div className="mentor-feature card reveal">
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
					<div className="section-head section-head-tight reveal">
						<div>
							<span className="eyebrow">{t.howEyebrow}</span>
							<h2>{t.howTitle}</h2>
						</div>
					</div>

					<div className="process-row reveal-stagger">
						{HOW.map((step, i) => (
							<div className="process-step" key={step.t.en}>
								<span className="process-num">
									{String(i + 1).padStart(2, "0")}
								</span>

								<b>{step.t[locale]}</b>
								<p>{step.d[locale]}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			<section>
				<div className="wrap">
					<div className="why-card card reveal">
						<b>{t.integrityTitle}</b>

						<p>{t.integrityDesc}</p>

						<Link
							href={routeFor("academicIntegrity", locale)}
							className="case-link"
						>
							{t.integrityLink} {ARROW}
						</Link>
					</div>
				</div>
			</section>
		</main>
	);
}
