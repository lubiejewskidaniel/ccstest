import Link from "next/link";
import { routeFor, type Locale } from "@/lib/routes";

const ARROW = (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
		<path d="M7 17 17 7M9 7h8v8" />
	</svg>
);

const STEPS = [
	{
		num: "01",
		title: { en: "Discover", pl: "Poznajemy" },
		desc: {
			en: "We understand your business and goals.",
			pl: "Poznajemy Twój biznes, potrzeby i cele.",
		},
	},
	{
		num: "02",
		title: { en: "Define", pl: "Definiujemy" },
		desc: {
			en: "We define the right solution, scope and direction.",
			pl: "Określamy rozwiązanie, zakres i kierunek działania.",
		},
	},
	{
		num: "03",
		title: { en: "Design", pl: "Projektujemy" },
		desc: {
			en: "We design the solution around users and real goals.",
			pl: "Projektujemy rozwiązanie z myślą o użytkownikach i konkretnych celach.",
		},
	},
	{
		num: "04",
		title: { en: "Build", pl: "Budujemy" },
		desc: {
			en: "We turn the design into a reliable, scalable product.",
			pl: "Zamieniamy projekt w solidny, skalowalny produkt.",
		},
	},
	{
		num: "05",
		title: { en: "Launch", pl: "Wdrażamy" },
		desc: {
			en: "We launch, test and make sure everything works.",
			pl: "Uruchamiamy, testujemy i upewniamy się, że wszystko działa.",
		},
	},
	{
		num: "06",
		title: { en: "Grow", pl: "Rozwijamy" },
		desc: {
			en: "We help your product evolve and can continue supporting it after launch.",
			pl: "Rozwijamy i optymalizujemy produkt, zapewniając dalsze wsparcie.",
		},
	},
];

const COPY = {
	en: {
		eyebrow: "Our process",
		title: "A clear path from idea to launch.",
		viewAll: "Explore our process",
	},
	pl: {
		eyebrow: "Nasz proces",
		title: "Jasna droga od pomysłu do wdrożenia.",
		viewAll: "Poznaj nasz proces",
	},
};

export function Process({ locale }: { locale: Locale }) {
	const t = COPY[locale];
	return (
		<section id="process">
			<div className="wrap">
				<div className="section-head reveal" style={{ marginBottom: 24 }}>
					<div>
						<span className="eyebrow">{t.eyebrow}</span>
						<h2>{t.title}</h2>
					</div>
					<Link href={routeFor("services", locale)} className="view-all">
						{t.viewAll} {ARROW}
					</Link>
				</div>

				<div className="process-row reveal-stagger">
					{STEPS.map((step) => (
						<div className="process-step" key={step.num}>
							<span className="process-num">{step.num}</span>
							<b>{step.title[locale]}</b>
							<p>{step.desc[locale]}</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
