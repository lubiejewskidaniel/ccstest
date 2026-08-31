import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "@/styles/globals.css";
import { bricolageGrotesque, hankenGrotesk, ibmPlexMono } from "@/lib/fonts";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { SiteChrome } from "@/components/navigation/SiteChrome";
import { MotionSystem } from "@/components/MotionSystem";
import { SectionReveal } from "@/components/SectionReveal";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { AttributionCapture } from "@/features/attribution";
import { PageViewTracker } from "@/lib/analytics/PageViewTracker";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationSchema, websiteSchema } from "@/lib/seo/structuredData";
import { siteUrl } from "@/lib/seo/metadata";
import { BackToTop } from "@/components/navigation/BackToTop";

/**
 * Single root layout for the whole bilingual tree (Next.js allows exactly
 * one <html>/<body> pair - this app deliberately doesn't use a [locale]
 * dynamic segment). `<html lang>` is read from the `x-locale` request
 * header, stamped by middleware.ts from the URL's /pl prefix (same rule as
 * src/lib/routes.ts) - so the actual server response for
 * /pl/uslugi already ships `<html lang="pl">`, and /services ships
 * `<html lang="en">`, with no client-side correction needed for SEO/
 * accessibility on the initial load. MotionSystem's pathname effect still
 * corrects it on CLIENT-SIDE navigation between locales, since this root
 * layout doesn't re-run on those (only the leaf page changes) - see the
 * comment there.
 *
 * Default metadata is the English identity; every route under `src/app/**`
 * overrides `title`/`description`/`alternates` with its own
 * `generateMetadata`/`metadata` export (doc 10 "SEO & content architecture" -
 * every indexable page ships its own title, description and hreflang pair).
 */
export const metadata: Metadata = {
	metadataBase: new URL(siteUrl),
	title: {
		default: "Code Consulting Studio - Engineered software, products & growth",
		template: "%s · Code Consulting Studio",
	},
	description:
		"Code Consulting Studio builds software, owns products, grows businesses online, and teaches the people behind them - BUILD, CREATE, GROW, TEACH.",
	alternates: { languages: { en: "/", pl: "/pl" } },
	icons: {
		icon: [
			{ url: "/favicon.ico", sizes: "any" },
			{ url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
			{ url: "/icon-192.png", type: "image/png", sizes: "192x192" },
			{ url: "/icon-512.png", type: "image/png", sizes: "512x512" },
		],
		apple: "/apple-touch-icon.png",
	},
	openGraph: {
		type: "website",
		siteName: "Code Consulting Studio",
		title: "Code Consulting Studio - Engineered software, products & growth",
		description:
			"Software development, owned products, digital growth and 1:1 mentoring - one engineering-led studio.",
		images: [
			{
				url: "/og-image.png",
				width: 1200,
				height: 630,
				alt: "Code Consulting Studio - Software, Products, Growth and Mentoring",
			},
		],
	},
	twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
	// The browser chrome color (mobile address bar, PWA title bar) - fixed
	// to the logo's signal-blue (matches --btn-blue-1 in tokens.css, sampled
	// from the neon "{ }" bracket in the CCS mark) rather than following
	// light/dark like the page background, since this is a brand accent.
	themeColor: "#0d84ff",
	colorScheme: "dark light",
};

export default async function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const headerList = await headers();
	const lang = headerList.get("x-locale") === "pl" ? "pl" : "en";

	return (
		<html
			lang={lang}
			className={`${bricolageGrotesque.variable} ${hankenGrotesk.variable} ${ibmPlexMono.variable}`}
		>
			<body>
				<JsonLd data={[organizationSchema(), websiteSchema()]} />

				<a href="#main-content" className="skip-link">
					Skip to content
				</a>

				<div className="progress-rail" aria-hidden="true">
					<i id="progressFill" />
				</div>

				<div className="boot-curtain" id="bootCurtain" aria-hidden="true">
					<svg viewBox="0 0 100 100">
						<defs>
							<linearGradient id="bootGrad" x1="0" y1="0" x2="1" y2="1">
								<stop offset="0%" stopColor="#0aa9ff" />
								<stop offset="100%" stopColor="#1267e8" />
							</linearGradient>
						</defs>

						<path d="M64 20c-16 0-30 13-30 30s14 30 30 30" />
					</svg>
				</div>

				<ThemeProvider>
					<div className="spine" aria-hidden="true" />

					<SiteChrome>{children}</SiteChrome>

					<BackToTop locale={lang} />
				</ThemeProvider>

				<MotionSystem />
				<SectionReveal />
				<AttributionCapture />
				<PageViewTracker />
				<GoogleAnalytics />
			</body>
		</html>
	);
}
