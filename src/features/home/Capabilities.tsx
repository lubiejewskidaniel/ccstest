import type { ReactNode } from "react";
import { routeFor, type Locale } from "@/lib/routes";
import { TrackedCtaLink } from "@/components/analytics/TrackedCtaLink";

const ARROW = (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
		<path d="M7 17 17 7M9 7h8v8" />
	</svg>
);

type Item = {
	key: string;
	icon: ReactNode;
	title: { en: string; pl: string };
	desc: { en: string; pl: string };
	badge?: boolean;
};

// `key` is the stable service slug used as the `service` value in
// `service_cta_click` events - kept in sync with the matching
// entries in ServicesPage.tsx so the same offer reports under the same
// slug regardless of which page the click happened on.
const ITEMS: Item[] = [
	{
		key: "software-development",
		icon: (
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.8"
			>
				<path d="M8 5 3 12l5 7M16 5l5 7-5 7" />
			</svg>
		),
		title: { en: "Software Development", pl: "Wytwarzanie oprogramowania" },
		desc: {
			en: "Custom web applications, systems and cloud solutions.",
			pl: "Dedykowane aplikacje webowe, systemy i rozwiązania chmurowe.",
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
			>
				<path d="M21 8 12 3 3 8l9 5 9-5Z" />
				<path d="M3 8v8l9 5 9-5V8M12 13v8" />
			</svg>
		),
		title: { en: "Product Development", pl: "Tworzenie produktów" },
		desc: {
			en: "From first idea to launch-ready digital products.",
			pl: "Od pierwszego pomysłu do gotowego produktu cyfrowego.",
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
			>
				<ellipse cx="12" cy="5.5" rx="8" ry="3" />
				<path d="M4 5.5V12c0 1.7 3.6 3 8 3s8-1.3 8-3V5.5M4 12v6.5c0 1.7 3.6 3 8 3s8-1.3 8-3V12" />
			</svg>
		),
		title: { en: "Technology Consulting", pl: "Doradztwo technologiczne" },
		desc: {
			en: "Architecture, technical audits and strategic guidance.",
			pl: "Architektura, audyty techniczne i doradztwo strategiczne.",
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
			>
				<rect x="3" y="4" width="18" height="12" rx="2" />
				<path d="M8 20h8M12 16v4" />
			</svg>
		),
		title: { en: "Web & Digital", pl: "Web i digital" },
		desc: {
			en: "Modern websites, landing pages and platforms.",
			pl: "Nowoczesne strony, landing page'e i platformy.",
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
			>
				<path d="M3 17l6-6 4 4 8-8M21 7v6M15 7h6" />
			</svg>
		),
		title: {
			en: "Digital Growth & Marketing",
			pl: "Marketing i widoczność  online",
		},
		desc: {
			en: "Helping your business get seen, reach more people and grow online.",
			pl: "Pomagamy Twojej firmie zwiększać widoczność, docierać do klientów i rozwijać się online.",
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
			>
				<circle cx="12" cy="8" r="3.4" />
				<path d="M5 20c1.4-4 4-6 7-6s5.6 2 7 6" />
			</svg>
		),
		title: { en: "1:1 Tech Mentoring", pl: "Mentoring IT 1:1" },
		desc: {
			en: "Practical guidance in coding, projects and career development.",
			pl: "Praktyczne wsparcie w nauce programowania, projektach i rozwoju kariery.",
		},
	},
];

const COPY = {
	en: {
		eyebrow: "What we do",
		title: "From idea to impact.",
		viewAll: "View all services",
		learnMore: "Learn more",
	},
	pl: {
		eyebrow: "Co robimy",
		title: "Od pomysłu do efektu.",
		viewAll: "Zobacz wszystkie usługi",
		learnMore: "Dowiedz się więcej",
	},
};

export function Capabilities({ locale }: { locale: Locale }) {
	const t = COPY[locale];
	return (
		<section id="capabilities">
			<div className="wrap">
				<div className="section-head reveal">
					<div>
						<span className="eyebrow">{t.eyebrow}</span>
						<h2>{t.title}</h2>
					</div>
					<TrackedCtaLink
						kind="service"
						service="services-overview"
						ctaLocation="homepage-capabilities-viewall"
						href={routeFor("services", locale)}
						className="view-all"
					>
						{t.viewAll} {ARROW}
					</TrackedCtaLink>
				</div>

				<div className="cap-grid reveal-stagger">
					{ITEMS.map((item) => (
						<TrackedCtaLink
							kind="service"
							service={item.key}
							ctaLocation="homepage-capabilities"
							href={routeFor("services", locale)}
							className="cap-card card"
							key={item.title.en}
						>
							<span className="cap-ic">
								{item.icon}
								{item.badge ? (
									<span className="cap-new badge-new">NEW</span>
								) : null}
							</span>
							<b>{item.title[locale]}</b>
							<p>{item.desc[locale]}</p>
							<span className="cap-link">
								{t.learnMore} {ARROW}
							</span>
						</TrackedCtaLink>
					))}
				</div>
			</div>
		</section>
	);
}
