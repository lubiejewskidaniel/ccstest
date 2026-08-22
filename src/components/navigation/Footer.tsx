import Image from "next/image";
import Link from "next/link";
import { routeFor, type Locale } from "@/lib/routes";

const COPY = {
	en: {
		tagline:
			"An engineering-led studio building software, products and online growth - and teaching the people behind them.",
		studio: "Studio",
		growLearn: "Grow & Learn",
		info: "Studio Info",
		about: "About",
		contact: "Contact",
		rights: "All rights reserved.",
		privacy: "Privacy",
		cookies: "Cookies",
		terms: "Terms",
	},
	pl: {
		tagline:
			"Studio inżynierskie budujące oprogramowanie, produkty i widoczność online - i uczące ludzi, którzy za tym stoją.",
		studio: "Studio",
		growLearn: "Rozwój i nauka",
		info: "Informacje",
		about: "O nas",
		contact: "Kontakt",
		rights: "Wszelkie prawa zastrzeżone.",
		privacy: "Prywatność",
		cookies: "Cookies",
		terms: "Regulamin",
	},
};

export function Footer({ locale }: { locale: Locale }) {
	const t = COPY[locale];
	const year = new Date().getFullYear();

	return (
		<footer id="footer">
			<div className="wrap">
				<div className="foot-top">
					<div className="foot-brand">
						<Link href={routeFor("home", locale)} className="brand">
							<Image
								src="/brand/ccs-logo-mark.png"
								alt="CCS"
								loading="eager"
								width={1200}
								height={675}
								className="brand-logo"
							/>
							<span className="brand-word">
								CODE CONSULTING
								<b>STUDIO</b>
							</span>
						</Link>
						<p>{t.tagline}</p>
					</div>
					<div className="foot-col">
						<b>{t.studio}</b>
						<ul>
							<li>
								<Link href={routeFor("services", locale)}>
									{locale === "en" ? "Services" : "Usługi"}
								</Link>
							</li>
							<li>
								<Link href={routeFor("work", locale)}>
									{locale === "en" ? "Work" : "Realizacje"}
								</Link>
							</li>
							<li>
								<Link href={routeFor("products", locale)}>
									{locale === "en" ? "Products" : "Produkty"}
								</Link>
							</li>
						</ul>
					</div>
					<div className="foot-col">
						<b>{t.growLearn}</b>
						<ul>
							<li>
								<Link href={routeFor("growth", locale)}>
									{locale === "en" ? "Growth" : "Marketing"}
								</Link>
							</li>
							<li>
								<Link href={routeFor("mentoring", locale)}>
									{locale === "en" ? "Mentoring" : "Mentoring"}
								</Link>
							</li>
							<li>
								<Link href={routeFor("insights", locale)}>
									{locale === "en" ? "Insights" : "Wiedza"}
								</Link>
							</li>
						</ul>
					</div>
					<div className="foot-col">
						<b>{t.info}</b>
						<ul>
							<li>
								<Link href={routeFor("about", locale)}>{t.about}</Link>
							</li>
							<li>
								<Link href={routeFor("contact", locale)}>{t.contact}</Link>
							</li>
						</ul>
					</div>
				</div>
				<div className="foot-bottom">
					<p>
						© {year} Code Consulting Studio. {t.rights}
					</p>
					<div className="legal-links">
						<Link href={routeFor("privacy", locale)}>{t.privacy}</Link>
						<Link href={routeFor("cookies", locale)}>{t.cookies}</Link>
						<Link href={routeFor("terms", locale)}>{t.terms}</Link>
					</div>
					<div className="socials">
						<a href="#" aria-label="LinkedIn">
							<svg viewBox="0 0 24 24" fill="currentColor">
								<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.05c.53-1 1.83-2 3.77-2 4 0 4.75 2.6 4.75 6.1V21H18v-5.7c0-1.4 0-3.1-1.9-3.1s-2.2 1.5-2.2 3v5.8H10V9Z" />
							</svg>
						</a>
						<a href="#" aria-label="GitHub">
							<svg viewBox="0 0 24 24" fill="currentColor">
								<path d="M12 2a10 10 0 0 0-3.16 19.5c.5.1.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.56-1.11-4.56-4.94 0-1.1.39-2 1.03-2.7-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.9-1.3 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.7 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .26.18.58.69.48A10 10 0 0 0 12 2Z" />
							</svg>
						</a>
						<a href="#" aria-label="Email">
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.8"
							>
								<rect x="3" y="5" width="18" height="14" rx="2" />
								<path d="m3 7 9 6 9-6" />
							</svg>
						</a>
					</div>
				</div>
			</div>
		</footer>
	);
}
