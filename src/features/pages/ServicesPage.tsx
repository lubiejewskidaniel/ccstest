import type { ReactNode } from "react";

import { routeFor, type Locale } from "@/lib/routes";
import { PageHero } from "@/components/PageHero";
import { TrackedCtaLink } from "@/components/analytics/TrackedCtaLink";

const ARROW = (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.8"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<path d="M7 17 17 7" />
		<path d="M9 7h8v8" />
	</svg>
);

type Item = {
	key: string;
	icon: ReactNode;
	title: {
		en: string;
		pl: string;
	};
	desc: {
		en: string;
		pl: string;
	};
	includes: {
		en: string[];
		pl: string[];
	};
	badge?: boolean;
};

// Stable service slugs used by analytics.
const CAPS: Item[] = [
	{
		key: "software-development",
		icon: (
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.8"
				aria-hidden="true"
			>
				<path d="M8 5 3 12l5 7M16 5l5 7-5 7" />
			</svg>
		),
		title: {
			en: "Software Development",
			pl: "Tworzenie oprogramowania",
		},
		desc: {
			en: "Custom web applications, systems and cloud solutions built around your business, users and long-term goals. Whether you need a new application, want to connect existing systems or replace manual processes with something more efficient, we can help design and build the right solution.",
			pl: "Tworzymy dedykowane aplikacje webowe, systemy i rozwiązania chmurowe dopasowane do Twojego biznesu i jego dalszego rozwoju. Niezależnie od tego, czy potrzebujesz nowej aplikacji, chcesz połączyć istniejące systemy czy zastąpić ręczne procesy bardziej efektywnym rozwiązaniem - możemy pomóc je zaprojektować i zbudować.",
		},
		includes: {
			en: [
				"Web apps & APIs",
				"System integrations",
				"Legacy modernisation",
				"Cloud infrastructure",
				"Databases & data management",
				"Authentication & access",
			],
			pl: [
				"Aplikacje webowe i API",
				"Integracje systemowe",
				"Modernizacja systemów",
				"Infrastruktura chmurowa",
				"Bazy danych i zarządzanie danymi",
				"Logowanie i dostęp",
			],
		},
	},
	{
		key: "product-development",
		icon: (
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.8"
				aria-hidden="true"
			>
				<path d="M21 8 12 3 3 8l9 5 9-5Z" />
				<path d="M3 8v8l9 5 9-5V8M12 13v8" />
			</svg>
		),
		title: {
			en: "Product Development",
			pl: "Tworzenie produktów cyfrowych",
		},
		desc: {
			en: "From an early idea to an MVP and a product ready to grow - we help turn concepts into useful digital products. If you have an idea but are unsure what to build first, which features really matter or how to test it without overinvesting, we can help define the right path.",
			pl: "Od pierwszego pomysłu przez MVP po produkt gotowy do dalszego rozwoju - pomagamy zamieniać koncepcje w działające rozwiązania cyfrowe. Jeśli masz pomysł, ale nie wiesz, od czego zacząć, które funkcje są naprawdę potrzebne lub jak sprawdzić potencjał produktu bez nadmiernych kosztów - pomożemy wyznaczyć właściwy kierunek.",
		},
		includes: {
			en: [
				"MVP planning & build",
				"SaaS products",
				"Iterative development",
				"Post-launch support",
				"Product architecture",
				"Scaling & optimisation",
			],
			pl: [
				"Planowanie i budowa MVP",
				"Produkty SaaS",
				"Rozwój iteracyjny",
				"Wsparcie po wdrożeniu",
				"Architektura produktu",
				"Skalowanie i optymalizacja",
			],
		},
	},
	{
		key: "technology-consulting",
		icon: (
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.8"
				aria-hidden="true"
			>
				<ellipse cx="12" cy="5.5" rx="8" ry="3" />
				<path d="M4 5.5V12c0 1.7 3.6 3 8 3s8-1.3 8-3V5.5M4 12v6.5c0 1.7 3.6 3 8 3s8-1.3 8-3V12" />
			</svg>
		),
		title: {
			en: "Technology Consulting",
			pl: "Doradztwo technologiczne",
		},
		desc: {
			en: "Independent technical guidance to help you make better decisions about architecture, systems, tools and future development. We can also review what you already have, identify technical risks, performance issues or unnecessary complexity, and show where improvements could save time and cost.",
			pl: "Pomagamy podejmować świadome decyzje dotyczące architektury, systemów, technologii i dalszego kierunku rozwoju. Możemy również przeanalizować to, co już posiadasz, wskazać ryzyka techniczne, problemy z wydajnością lub zbędną złożoność oraz znaleźć miejsca, w których usprawnienia mogą oszczędzić czas i koszty.",
		},
		includes: {
			en: [
				"Architecture reviews",
				"Technical audits",
				"Technology selection",
				"Technical strategy",
				"Performance reviews",
				"Security guidance",
			],
			pl: [
				"Przeglądy architektury",
				"Audyty techniczne",
				"Dobór technologii",
				"Strategia techniczna",
				"Analiza wydajności",
				"Doradztwo bezpieczeństwa",
			],
		},
	},
	{
		key: "web-digital",
		icon: (
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.8"
				aria-hidden="true"
			>
				<rect x="3" y="4" width="18" height="12" rx="2" />
				<path d="M8 20h8M12 16v4" />
			</svg>
		),
		title: {
			en: "Websites & Platforms",
			pl: "Strony i platformy",
		},
		desc: {
			en: "Modern websites, landing pages and interactive platforms designed to communicate clearly, perform well and support real business goals. We can go beyond the website itself with CMS, integrations, analytics, SEO foundations and tools that make it easier to manage and grow your online presence.",
			pl: "Projektujemy nowoczesne strony, landing page'e i platformy, które dobrze wyglądają, szybko działają i wspierają konkretne cele biznesowe. Możemy pójść dalej niż sama strona, wdrażając CMS, integracje, analitykę, podstawy SEO oraz narzędzia ułatwiające zarządzanie i rozwój obecności online.",
		},
		includes: {
			en: [
				"Business websites",
				"Landing pages",
				"Interactive platforms",
				"CMS solutions",
				"SEO foundations",
				"Performance & accessibility",
			],
			pl: [
				"Strony firmowe",
				"Landing page'e",
				"Platformy interaktywne",
				"Rozwiązania CMS",
				"Podstawy SEO",
				"Wydajność i dostępność",
			],
		},
	},
	{
		key: "growth-marketing",
		icon: (
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.8"
				aria-hidden="true"
			>
				<path d="M3 17l6-6 4 4 8-8M21 7v6M15 7h6" />
			</svg>
		),
		title: {
			en: "Digital Growth & Marketing",
			pl: "Marketing i widoczność online",
		},
		desc: {
			en: "SEO, social media, content and campaigns focused on helping your business reach the right people and grow online. We also use analytics and conversion insights to understand what is actually working, where potential customers are being lost and what can be improved next.",
			pl: "SEO, social media, treści i kampanie pomagające zwiększać widoczność firmy, docierać do właściwych klientów i rozwijać biznes online. Wykorzystujemy również analitykę i dane o konwersji, aby sprawdzić, co naprawdę działa, gdzie tracisz potencjalnych klientów i co warto poprawić w kolejnym kroku.",
		},
		includes: {
			en: [
				"SEO & local SEO",
				"Social media management",
				"Content & campaigns",
				"Analytics & reporting",
				"Conversion optimisation",
				"Paid advertising",
			],
			pl: [
				"SEO i lokalne SEO",
				"Prowadzenie social media",
				"Treści i kampanie",
				"Analityka i raportowanie",
				"Optymalizacja konwersji",
				"Kampanie reklamowe",
			],
		},
		badge: true,
	},
	{
		key: "mentoring",
		icon: (
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.8"
				aria-hidden="true"
			>
				<circle cx="12" cy="8" r="3.4" />
				<path d="M5 20c1.4-4 4-6 7-6s5.6 2 7 6" />
			</svg>
		),
		title: {
			en: "1:1 Tech Mentoring",
			pl: "Mentoring IT 1:1",
		},
		desc: {
			en: "Practical one-to-one support with programming, technical concepts, projects and career development. Sessions can focus on a specific problem, help you understand difficult topics, review your code or project, or give you a clearer direction for what to learn and improve next.",
			pl: "Indywidualne wsparcie w nauce programowania, zagadnieniach technicznych, projektach i rozwoju kariery. Spotkania mogą dotyczyć konkretnego problemu, trudnego zagadnienia, przeglądu kodu lub projektu, a także pomóc Ci określić, czego warto uczyć się i co rozwijać w kolejnym kroku.",
		},
		includes: {
			en: [
				"1:1 sessions",
				"Technical concepts",
				"Project support",
				"Career guidance",
				"Code reviews",
				"Interview preparation",
			],
			pl: [
				"Sesje 1:1",
				"Zagadnienia techniczne",
				"Wsparcie w projektach",
				"Rozwój kariery",
				"Przegląd kodu",
				"Przygotowanie do rozmów",
			],
		},
	},
];

const COPY = {
	en: {
		eyebrow: "Services",
		title: "How we can help.",
		lede: "From software and digital products to online growth and mentoring - we combine technical expertise with a practical approach focused on real goals.",
		ctaPrimary: "Start a project",
		ctaSecondary: "Explore growth services",
		discuss: "Discuss this",
		processEyebrow: "How we start",
		processTitle:
			"A simple, transparent start - focused on what you actually need.",
		processSteps: [
			{
				n: "01",
				t: "Tell us what you need",
				d: "Share your goal, challenge or idea through a short form or conversation. You do not need to prepare a technical specification.",
			},
			{
				n: "02",
				t: "We define the scope",
				d: "We look at what you need, discuss the right approach and define a realistic scope, direction and next steps.",
			},
			{
				n: "03",
				t: "We agree the plan",
				d: "You know what we are building, how we will work and what happens next before the project moves forward.",
			},
		],
	},
	pl: {
		eyebrow: "Usługi",
		title: "Jak możemy Ci pomóc.",
		lede: "Od oprogramowania i produktów cyfrowych po rozwój online i mentoring - łączymy wiedzę techniczną z praktycznym podejściem skoncentrowanym na realnych celach.",
		ctaPrimary: "Rozpocznij projekt",
		ctaSecondary: "Zobacz, jak pomagamy rosnąć",
		discuss: "Porozmawiajmy o tym",
		processEyebrow: "Jak zaczynamy",
		processTitle:
			"Prosty i przejrzysty początek - skoncentrowany na tym, czego naprawdę potrzebujesz.",
		processSteps: [
			{
				n: "01",
				t: "Powiedz nam, czego potrzebujesz",
				d: "Opowiedz nam o swoim celu, problemie lub pomyśle przez krótki formularz albo podczas rozmowy. Nie potrzebujesz gotowej specyfikacji technicznej.",
			},
			{
				n: "02",
				t: "Określamy zakres",
				d: "Analizujemy potrzeby, omawiamy najlepsze podejście i określamy realny zakres, kierunek oraz kolejne kroki.",
			},
			{
				n: "03",
				t: "Ustalamy plan",
				d: "Zanim zaczniemy, wiesz co tworzymy, jak będzie wyglądać współpraca i jakie będą kolejne etapy.",
			},
		],
	},
};

export function ServicesPage({ locale }: { locale: Locale }) {
	const t = COPY[locale];

	return (
		<main className="services-page">
			<PageHero
				eyebrow={t.eyebrow}
				title={t.title}
				lede={t.lede}
				actions={
					<>
						<TrackedCtaLink
							kind="service"
							service="general"
							ctaLocation="services-hero"
							href={routeFor("contact", locale)}
							className="btn btn-split"
						>
							<span className="btn-split__label">{t.ctaPrimary}</span>

							<span className="btn-split__icon" aria-hidden="true">
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.8"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<path d="M7 17 17 7" />
									<path d="M9 7h8v8" />
								</svg>
							</span>
						</TrackedCtaLink>

						<TrackedCtaLink
							kind="service"
							service="growth-marketing"
							ctaLocation="services-hero"
							href={routeFor("growth", locale)}
							className="btn btn-ghost"
						>
							{t.ctaSecondary}
						</TrackedCtaLink>
					</>
				}
			/>

			<section className="tight">
				<div className="wrap">
					<div className="services-grid">
						{CAPS.map((item) => (
							<div className="cap-card services-card card" key={item.key}>
								<span className="cap-ic">
									{item.icon}

									{item.badge ? (
										<span className="cap-new badge-new">NEW</span>
									) : null}
								</span>

								<b>{item.title[locale]}</b>

								<p>{item.desc[locale]}</p>

								<ul className="tag-row services-tags">
									{item.includes[locale].map((tag) => (
										<li className="tag" key={tag}>
											{tag}
										</li>
									))}
								</ul>

								<TrackedCtaLink
									kind="service"
									service={item.key}
									ctaLocation="services-page-card"
									href={routeFor("contact", locale)}
									className="cap-link"
								>
									{t.discuss} {ARROW}
								</TrackedCtaLink>
							</div>
						))}
					</div>
				</div>
			</section>

			<section>
				<div className="wrap">
					<div className="section-head services-process-head reveal">
						<div>
							<span className="eyebrow">{t.processEyebrow}</span>

							<h2>{t.processTitle}</h2>
						</div>
					</div>

					<div className="process-row services-process-grid reveal-stagger">
						{t.processSteps.map((step) => (
							<div className="process-step" key={step.n}>
								<span className="process-num">{step.n}</span>

								<b>{step.t}</b>

								<p>{step.d}</p>
							</div>
						))}
					</div>
				</div>
			</section>
		</main>
	);
}
