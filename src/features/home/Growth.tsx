import { routeFor, type Locale } from "@/lib/routes";
import Link from "next/link";

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

const ITEMS = [
	{
		icon: (
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.8"
			>
				<circle cx="11" cy="11" r="7" />
				<path d="m21 21-4.3-4.3" />
			</svg>
		),
		title: { en: "SEO & Local SEO", pl: "SEO i lokalne SEO" },
		desc: {
			en: "Improve visibility and rank higher.",
			pl: "Zwiększamy widoczność Twojej firmy w wyszukiwarkach.",
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
				<path d="M21 12a8 8 0 1 1-3.6-6.7L21 4l-1 4.4" />
			</svg>
		),
		title: { en: "Social Media Management", pl: "Prowadzenie social media" },
		desc: {
			en: "We create, publish and manage your content.",
			pl: "Tworzymy, publikujemy i prowadzimy Twoje profile.",
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
				<rect x="3" y="3" width="18" height="18" rx="3" />
				<path d="m8 13 3 3 5-6" />
			</svg>
		),
		title: { en: "Content Creation", pl: "Tworzenie treści" },
		desc: {
			en: "Posts, graphics, Reels, videos & more.",
			pl: "Posty, grafiki, Reelsy, wideo i więcej.",
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
				<circle cx="12" cy="12" r="8.5" />
				<circle cx="12" cy="12" r="4.5" />
				<circle cx="12" cy="12" r=".6" fill="currentColor" />
			</svg>
		),
		title: { en: "Growth Strategy", pl: "Strategia rozwoju" },
		desc: {
			en: "Data-driven strategies for real results.",
			pl: "Strategie oparte na danych, nastawione na realne wyniki.",
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
				<path d="M4 19V9M12 19V5M20 19v-7" />
			</svg>
		),
		title: { en: "Analytics & Reporting", pl: "Analityka i raportowanie" },
		desc: {
			en: "Clear reports that show what works.",
			pl: "Czytelne raporty pokazujące, co naprawdę działa.",
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
				<path d="M3 11v2a2 2 0 0 0 2 2h1l7 4V5L6 9H5a2 2 0 0 0-2 2Z" />
				<path d="M16 9a4 4 0 0 1 0 6" />
			</svg>
		),
		title: { en: "Ads Management", pl: "Kampanie reklamowe" },
		desc: {
			en: "Campaigns that bring quality leads.",
			pl: "Kampanie nastawione na pozyskiwanie wartościowych klientów.",
		},
	},
];

const COPY = {
	en: {
		eyebrow: "Digital growth",
		title: "We help your business grow online.",
		viewAll: "Explore our growth services",
	},
	pl: {
		eyebrow: "ROZWÓJ ONLINE",
		title: "Pomagamy Twojej firmie rozwijać się online.",
		viewAll: "Zobacz, jak pomagamy rosnąć",
	},
};

export function Growth({ locale }: { locale: Locale }) {
	const t = COPY[locale];
	return (
		<section id="growth">
			<div className="wrap">
				<div className="section-head reveal">
					<div>
						<span className="eyebrow">{t.eyebrow}</span>
						<h2>{t.title}</h2>
					</div>
					<Link href={routeFor("growth", locale)} className="view-all">
						{t.viewAll} {ARROW}
					</Link>
				</div>

				<div className="growth-grid reveal-stagger">
					{ITEMS.map((item) => (
						<div className="growth-item" key={item.title.en}>
							<span className="growth-ic">{item.icon}</span>
							<b>{item.title[locale]}</b>
							<p>{item.desc[locale]}</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
