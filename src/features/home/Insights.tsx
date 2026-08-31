import Link from "next/link";
import { routeFor, type Locale } from "@/lib/routes";
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

const CHECK = (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
		<path d="m5 13 4 4 10-10" />
	</svg>
);

const COPY = {
	en: {
		eyebrow: "Insights",

		title: "Knowledge you can put into practice.",

		viewAll: "Explore all insights",

		posts: [
			{
				title: "How to build an SEO strategy that actually works",
				meta: "5 min read",
			},
			{
				title: "Social media content that brings real results",
				meta: "6 min read",
			},
			{
				title: "What does a good MVP actually need?",
				meta: "7 min read",
			},
		],

		whyTitle: "Why work with CCS",

		why: [
			"Technical quality",
			"Clear communication",
			"Business-focused approach",
			"Long-term partnership",
		],

		about: "About CCS",
	},

	pl: {
		eyebrow: "Wiedza",

		title: "Wiedza, którą możesz wykorzystać w praktyce.",

		viewAll: "Zobacz wszystkie artykuły",

		posts: [
			{
				title: "Jak zbudować strategię SEO, która naprawdę działa",
				meta: "5 min czytania",
			},
			{
				title: "Treści w social media, które przynoszą efekty",
				meta: "6 min czytania",
			},
			{
				title: "Czego naprawdę potrzebuje dobre MVP?",
				meta: "7 min czytania",
			},
		],

		whyTitle: "Dlaczego warto pracować z CCS",

		why: [
			"Techniczna jakość",
			"Jasna komunikacja",
			"Podejście biznesowe",
			"Długofalowa współpraca",
		],

		about: "O CCS",
	},
};

export function Insights({ locale }: { locale: Locale }) {
	const t = COPY[locale];
	return (
		<section id="insights">
			<div className="wrap">
				<div className="section-head reveal">
					<div>
						<span className="eyebrow">{t.eyebrow}</span>
						<h2>{t.title}</h2>
					</div>
					<TrackedCtaLink
						kind="insights"
						ctaLocation="homepage-insights-viewall"
						href={routeFor("insights", locale)}
						className="view-all"
					>
						{t.viewAll} {ARROW}
					</TrackedCtaLink>
				</div>

				<div className="insight-grid reveal-stagger">
					<TrackedCtaLink
						kind="insights"
						ctaLocation="homepage-insights-card"
						href={routeFor("insights", locale)}
						className="insight-card card"
					>
						<div
							className="insight-visual"
							style={{
								background:
									"radial-gradient(120% 140% at 30% 20%, rgba(59,130,246,.35), #0a0f1c 65%)",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<span
								style={{
									fontFamily: "var(--font-mono)",
									fontSize: 22,
									letterSpacing: ".1em",
									color: "var(--spark)",
								}}
							>
								SEO
							</span>
						</div>
						<div className="insight-body">
							<b>{t.posts[0]!.title}</b>
							<span className="insight-meta">{t.posts[0]!.meta}</span>
						</div>
					</TrackedCtaLink>

					<TrackedCtaLink
						kind="insights"
						ctaLocation="homepage-insights-card"
						href={routeFor("insights", locale)}
						className="insight-card card"
					>
						<div
							className="insight-visual"
							style={{
								background: "#0c1120",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								gap: 8,
							}}
						>
							<svg
								width="34"
								height="34"
								viewBox="0 0 24 24"
								fill="none"
								stroke="#c084fc"
								strokeWidth="1.6"
							>
								<path d="M21 11.5a8.4 8.4 0 0 1-8.9 8.4 8.6 8.6 0 0 1-3.6-.7L3 20l1-4.9A8.4 8.4 0 1 1 21 11.5Z" />
							</svg>
							<svg
								width="26"
								height="26"
								viewBox="0 0 24 24"
								fill="none"
								stroke="#34d399"
								strokeWidth="1.6"
							>
								<path d="M4 19V9M12 19V5M20 19v-7" />
							</svg>
						</div>
						<div className="insight-body">
							<b>{t.posts[1]!.title}</b>
							<span className="insight-meta">{t.posts[1]!.meta}</span>
						</div>
					</TrackedCtaLink>

					<TrackedCtaLink
						kind="insights"
						ctaLocation="homepage-insights-card"
						href={routeFor("insights", locale)}
						className="insight-card card"
					>
						<div
							className="insight-visual"
							style={{ background: "linear-gradient(160deg,#12213f,#070b15)" }}
						>
							<svg
								width="100%"
								height="100%"
								viewBox="0 0 200 130"
								preserveAspectRatio="xMidYMid slice"
								aria-hidden="true"
							>
								<rect
									x="60"
									y="30"
									width="80"
									height="60"
									rx="8"
									fill="#0d1526"
									stroke="#2c3b5f"
								/>
								<path
									d="M75 55 c8-14 20-14 25 0 c5-14 17-14 25 0"
									fill="none"
									stroke="#7fd9ff"
									strokeWidth="2.5"
								/>
							</svg>
						</div>
						<div className="insight-body">
							<b>{t.posts[2]!.title}</b>
							<span className="insight-meta">{t.posts[2]!.meta}</span>
						</div>
					</TrackedCtaLink>

					<div className="why-card card">
						<b>{t.whyTitle}</b>
						<ul className="why-list">
							{t.why.map((item) => (
								<li key={item}>
									{CHECK} {item}
								</li>
							))}
						</ul>
						<Link href={routeFor("about", locale)} className="case-link">
							{t.about} {ARROW}
						</Link>
					</div>
				</div>
			</div>
		</section>
	);
}
