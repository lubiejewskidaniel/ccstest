import { routeFor, type Locale } from "@/lib/routes";
import { PageHero } from "@/components/PageHero";
import { HoldNavLink } from "@/components/navigation/HoldNavLink";

const ARROW = (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
		<path d="M7 17 17 7M9 7h8v8" />
	</svg>
);

const MODES = [
	{
		k: "BUILD",
		t: {
			en: "We build software.",
			pl: "Budujemy oprogramowanie.",
		},
		d: {
			en: "From websites and web applications to business systems and integrations - engineered for reliability, maintainability and long-term growth.",
			pl: "Od stron i aplikacji internetowych po systemy biznesowe i integracje - tworzymy rozwiązania z myślą o niezawodności, łatwym rozwoju i długoterminowym utrzymaniu.",
		},
	},

	{
		k: "CREATE",
		t: {
			en: "We create our own products.",
			pl: "Tworzymy własne produkty.",
		},
		d: {
			en: "Products like TakBlisko let us test ideas, technologies and product decisions in the real world - and bring that experience into our client work.",
			pl: "Produkty takie jak TakBlisko pozwalają nam sprawdzać pomysły, technologie i decyzje produktowe w praktyce - a zdobyte doświadczenie wykorzystywać w projektach naszych klientów.",
		},
	},

	{
		k: "GROW",
		t: {
			en: "We grow businesses online.",
			pl: "Pomagamy firmom rozwijać się online.",
		},
		d: {
			en: "We combine SEO, content, paid campaigns and analytics to improve visibility, reach the right audience and turn digital activity into measurable business results.",
			pl: "Łączymy SEO, treści, płatne kampanie i analitykę, aby zwiększać widoczność, docierać do właściwych odbiorców i przekładać działania online na mierzalne efekty biznesowe.",
		},
	},

	{
		k: "TEACH",
		t: {
			en: "We help people and teams build the skills to succeed in technology.",
			pl: "Pomagamy ludziom i zespołom rozwijać umiejętności potrzebne w świecie technologii.",
		},
		d: {
			en: "From 1:1 mentoring and learning to code to team training and technology adoption - we focus on understanding not just how things work, but why.",
			pl: "Od indywidualnego mentoringu i nauki programowania po szkolenia zespołów i wdrażanie technologii - pomagamy zrozumieć nie tylko, jak coś działa, ale również dlaczego.",
		},
	},
];

const VALUES = [
	{
		t: {
			en: "Engineering quality",
			pl: "Jakość inżynierska",
		},
		d: {
			en: "We build software we'd be confident maintaining and developing ourselves - because often, we do.",
			pl: "Tworzymy oprogramowanie, które sami chcielibyśmy rozwijać i utrzymywać - bo często właśnie to robimy.",
		},
	},

	{
		t: {
			en: "Clear communication",
			pl: "Jasna i uczciwa komunikacja",
		},
		d: {
			en: "Clear scope, realistic timelines and honest advice - including saying no when something doesn't make sense.",
			pl: "Jasno określamy zakres, realne terminy i możliwości. Jeśli uważamy, że coś nie ma sensu - mówimy o tym otwarcie.",
		},
	},

	{
		t: {
			en: "Business-first thinking",
			pl: "Technologia dla biznesu",
		},
		d: {
			en: "Technology is a tool, not the goal. We choose solutions around your real needs, objectives and business constraints.",
			pl: "Technologia jest narzędziem, nie celem. Dobieramy rozwiązania do rzeczywistych potrzeb, celów i możliwości Twojego biznesu.",
		},
	},

	{
		t: {
			en: "Long-term partnership",
			pl: "Współpraca na dłużej",
		},
		d: {
			en: "We build relationships that continue beyond launch - supporting, improving and evolving what we create together.",
			pl: "Budujemy relacje, które nie kończą się wraz z wdrożeniem - wspieramy, ulepszamy i rozwijamy rozwiązania, które tworzymy wspólnie.",
		},
	},
];

const COPY = {
	en: {
		eyebrow: "About CCS",
		title: "An engineering-led studio, not an agency.",
		lede: "Code Consulting Studio brings together software engineering, product development, digital growth and technology education. We build, test and grow things ourselves - and bring that practical experience into every project, partnership and training programme.",
		modesEyebrow: "How the studio is organized",
		modesTitle: "Four modes, one team.",
		valuesEyebrow: "What we care about",
		valuesTitle: "Why clients choose CCS.",
		cta: "Start a conversation",
	},

	pl: {
		eyebrow: "O CCS",
		title: "Studio inżynierskie, nie agencja.",
		lede: "Code Consulting Studio łączy inżynierię oprogramowania, rozwój produktów, rozwój biznesu online i edukację technologiczną. Sami tworzymy, testujemy i rozwijamy rozwiązania, a zdobyte w praktyce doświadczenie wykorzystujemy w projektach, współpracy z firmami i szkoleniach.",
		modesEyebrow: "Jak działa nasze studio",
		modesTitle: "Cztery tryby, jeden zespół.",
		valuesEyebrow: "Na czym nam zależy",
		valuesTitle: "Dlaczego klienci wybierają CCS.",
		cta: "Porozmawiajmy",
	},
};

export function AboutPage({ locale }: { locale: Locale }) {
	const t = COPY[locale];
	return (
		<main>
			<PageHero
				eyebrow={t.eyebrow}
				title={t.title}
				lede={t.lede}
				actions={
					<HoldNavLink
						href={routeFor("contact", locale)}
						className="btn btn-primary"
					>
						{t.cta} {ARROW}
					</HoldNavLink>
				}
			/>

			<section className="tight">
				<div className="wrap">
					<div className="section-head reveal" style={{ marginBottom: 24 }}>
						<div>
							<span className="eyebrow">{t.modesEyebrow}</span>
							<h2>{t.modesTitle}</h2>
						</div>
					</div>
					<div
						className="cap-grid reveal-stagger"
						style={{ gridTemplateColumns: "repeat(4,1fr)" }}
					>
						{MODES.map((m) => (
							<div
								className="cap-card card"
								key={m.k}
								style={{ minHeight: "auto" }}
							>
								<span className="flagship" style={{ alignSelf: "flex-start" }}>
									{m.k}
								</span>
								<b>{m.t[locale]}</b>
								<p>{m.d[locale]}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			<section>
				<div className="wrap">
					<div className="section-head reveal" style={{ marginBottom: 24 }}>
						<div>
							<span className="eyebrow">{t.valuesEyebrow}</span>
							<h2>{t.valuesTitle}</h2>
						</div>
					</div>
					<div
						className="cap-grid reveal-stagger"
						style={{ gridTemplateColumns: "repeat(4,1fr)" }}
					>
						{VALUES.map((v) => (
							<div
								className="cap-card card"
								key={v.t.en}
								style={{ minHeight: "auto" }}
							>
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="var(--go)"
									strokeWidth="2.4"
									width="20"
									height="20"
								>
									<path d="m5 13 4 4 10-10" />
								</svg>
								<b>{v.t[locale]}</b>
								<p>{v.d[locale]}</p>
							</div>
						))}
					</div>
				</div>
			</section>
		</main>
	);
}
