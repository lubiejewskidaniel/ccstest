import Image from "next/image";
import Link from "next/link";

import { routeFor, type Locale } from "@/lib/routes";

const ARROW = (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		aria-hidden="true"
	>
		<path d="M7 17 17 7M9 7h8v8" />
	</svg>
);

const COPY = {
	en: {
		eyebrow: "Our products",
		title: ["We don't just", "build for clients."],
		viewAll: "View all products",
		flagship: "FLAGSHIP PRODUCT",
		screenshotAlt:
			"TakBlisko app screenshot showing a live map with nearby events",
		desc: "A map-first local discovery platform bringing nearby events, places and community activity into one simple experience.",
		feat1: "Discover your area through an interactive map",
		feat2: "See what's happening nearby, right now",
		builtBy: "Designed & built by CCS",
		active: "In active development",
		explore: "Explore TakBlisko",
	},

	pl: {
		eyebrow: "Nasze produkty",
		title: ["Tworzymy nie tylko", "dla klientów."],
		viewAll: "Zobacz wszystkie produkty",
		flagship: "FLAGOWY PRODUKT",
		screenshotAlt:
			"Zrzut ekranu aplikacji TakBlisko z mapą i wydarzeniami w pobliżu",
		desc: "Lokalna platforma oparta na mapie, która pomaga odkrywać wydarzenia, miejsca i to, co dzieje się w Twojej okolicy.",
		feat1: "Odkrywaj okolicę na interaktywnej mapie",
		feat2: "Zobacz, co dzieje się blisko Ciebie - teraz",
		builtBy: "Projektowana i rozwijana przez CCS",
		active: "Aktywnie rozwijany",
		explore: "Poznaj TakBlisko",
	},
};

export function ProductSpotlight({ locale }: { locale: Locale }) {
	const t = COPY[locale];

	return (
		<section id="products">
			<div className="wrap">
				<div className="section-head reveal">
					<div>
						<span className="eyebrow">{t.eyebrow}</span>
						<h2>
							{t.title[0]}
							<br />
							{t.title[1]}
						</h2>
					</div>

					<Link href={routeFor("products", locale)} className="view-all">
						{t.viewAll} {ARROW}
					</Link>
				</div>

				<div className="spotlight card reveal">
					<div className="spotlight-visual">
						<Image
							src="/products/takblisko-screenshot.png"
							alt={t.screenshotAlt}
							width={615}
							height={512}
							className="spotlight-screenshot"
							sizes="(max-width: 975px) 70vw, 34vw"
						/>
					</div>

					<div className="spotlight-body">
						<div className="flag-row">
							<h3>TakBlisko</h3>
							<span className="flagship">{t.flagship}</span>
						</div>

						<p>{t.desc}</p>

						<ul className="feat-list">
							<li>
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									aria-hidden="true"
								>
									<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
									<circle cx="12" cy="10" r="3" />
								</svg>
								{t.feat1}
							</li>

							<li>
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									aria-hidden="true"
								>
									<circle cx="12" cy="12" r="9" />
									<path d="M12 7v5l3 2" />
								</svg>
								{t.feat2}
							</li>
						</ul>

						<div className="spotlight-foot">
							<div className="spotlight-meta">
								<span className="built-by">{t.builtBy}</span>

								<div className="status-dot">
									<i aria-hidden="true" />
									{t.active}
								</div>
							</div>

							<a
								href="https://www.takblisko.pl"
								target="_blank"
								rel="noopener"
								className="btn btn-dark"
							>
								{t.explore}

								<svg
									viewBox="0 0 24 24"
									width="13"
									height="13"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									aria-hidden="true"
								>
									<path d="M7 17 17 7M9 7h8v8" />
								</svg>
							</a>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
