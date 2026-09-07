import type { BusinessTaxonomyPillar } from "./types";

/**
 * Phase 3C.1A — the v1 CCS business taxonomy.
 *
 * Authored judgment, not derived from repository data — nothing in the
 * codebase enumerates AEO/GEO/CRO/martech/DevOps terminology anywhere,
 * so this list was written directly from CCS's actual offer (per the
 * Phase 3C.1 architecture report and its specification-correction
 * follow-up) and should get a real editorial review before being
 * treated as ground truth. It reuses the six existing ServicesPage.tsx
 * capability keys verbatim rather than inventing a parallel taxonomy.
 *
 * Each pillar carries two independent term tiers:
 *   - `terms`: phrases that literally name something CCS sells. A match
 *     here is what produces `businessRelevance.level === "core"`.
 *   - `adjacentTerms`: related but less specific phrases. A match here
 *     (with no `terms` match) produces `"adjacent"`.
 *
 * Matching is deterministic contiguous-token matching (see
 * businessRelevance.ts) — never character-substring matching — so a
 * short, specific acronym like "seo" or "vps" is safe as a standalone
 * entry (it can only match a whole "seo"/"vps" token, never "kaseo" or
 * a word that merely contains those letters). Generic dictionary words
 * are deliberately EXCLUDED as standalone entries even though token
 * matching would technically make them "safe" from a substring-collision
 * point of view — a bare word like "platform" or "marketing" would still
 * token-match constantly across unrelated keywords simply because it is
 * common English/Polish vocabulary, not because of any matching bug.
 * Each pillar's comment below documents which words were deliberately
 * left out and why.
 *
 * Bare "geo" is a deliberate, explicit exception: unlike "seo"/"aeo"/
 * "cro"/"vps", "geo" is also a live, common word fragment for
 * geography/geolocation entirely outside marketing (e.g. "geo data",
 * "geo targeting for delivery routes"), so token-exact matching does
 * NOT make it safe the way it does for the other acronyms. Only the
 * full phrase ("generative engine optimisation"/"optimization") is a
 * taxonomy entry — bare "geo" must never be added to this file. See
 * businessRelevance.test.ts's "taxonomy safety" tests, which assert
 * this directly against this array.
 */
export const BUSINESS_TAXONOMY: BusinessTaxonomyPillar[] = [
	{
		key: "software-development",
		purpose:
			"Bespoke software and web-application engineering — building, integrating and modernising systems, including deployment/infrastructure delivery.",
		terms: {
			en: [
				"custom software development",
				"software development",
				"web application development",
				"web app development",
				"bespoke software",
				"custom web application",
				"api development",
				"system integration",
				"systems integration",
				"legacy modernisation",
				"legacy modernization",
				"next.js",
				"nextjs",
				"next.js development",
				"react development",
				"react.js",
				"node.js",
				"nodejs",
				"node.js development",
				"typescript",
				"typescript development",
				"backend development",
				"full stack development",
				"fullstack development",
				"database design",
				"vps",
				"vps hosting",
				"vps setup",
				"server deployment",
				"cloud deployment",
				"cloud infrastructure",
				"server infrastructure",
				"devops",
				"ci/cd",
				"continuous integration",
				"continuous deployment",
				"infrastructure as code",
				"api integration",
				"platform integration",
				"third-party integration",
			],
			pl: [
				"tworzenie oprogramowania",
				"tworzenie aplikacji webowych",
				"aplikacje webowe na zamówienie",
				"oprogramowanie na zamówienie",
				"integracja systemów",
				"integracje systemowe",
				"modernizacja systemów",
				"next.js",
				"programowanie next.js",
				"programowanie react",
				"backend",
				"rozwój oprogramowania",
				"aplikacja webowa na zamówienie",
				"wdrożenie vps",
				"infrastruktura chmurowa",
				"integracja api",
			],
		},
		// Deliberately excluded (too broad if used standalone): software,
		// app, application, development, system, code, programming,
		// technology, react, node, deployment, infrastructure, integration.
		adjacentTerms: {
			en: [
				"web application",
				"custom application",
				"software engineering",
				"system modernisation",
				"platform engineering",
				"technical implementation",
			],
			pl: ["aplikacja na zamówienie", "system informatyczny", "wdrożenie systemu", "inżynieria oprogramowania"],
		},
	},
	{
		key: "product-development",
		purpose: "New digital product / MVP creation and iterative product evolution.",
		terms: {
			en: [
				"mvp development",
				"mvp planning",
				"minimum viable product",
				"saas product development",
				"saas development",
				"product development",
				"digital product development",
				"product roadmap",
				"product architecture",
			],
			pl: [
				"tworzenie mvp",
				"rozwój produktu cyfrowego",
				"produkt saas",
				"tworzenie produktu saas",
				"architektura produktu",
			],
		},
		// Deliberately excluded: product, mvp (also "Most Valuable Player" —
		// too short and overloaded to trust as a bare acronym).
		adjacentTerms: {
			en: ["startup product", "digital product", "product strategy", "product scaling"],
			pl: ["produkt cyfrowy", "strategia produktowa", "rozwój produktu"],
		},
	},
	{
		key: "technology-consulting",
		purpose: "Independent technical advisory — architecture review, technology selection, audits — not hands-on delivery.",
		terms: {
			en: [
				"technical audit",
				"technology consulting",
				"architecture review",
				"technical due diligence",
				"technology selection",
				"technical strategy",
				"cto advisory",
				"fractional cto",
				"technical advisory",
			],
			pl: ["audyt techniczny", "doradztwo technologiczne", "przegląd architektury", "strategia techniczna", "doradztwo it"],
		},
		// Deliberately excluded: consulting, audit, technology, strategy, advisory.
		adjacentTerms: {
			en: ["technical review", "system audit", "technology roadmap", "it consulting"],
			pl: ["konsultacje techniczne", "audyt it"],
		},
	},
	{
		key: "web-digital",
		purpose: "Public-facing websites, landing pages and interactive platforms, including their technical foundations.",
		terms: {
			en: [
				"custom website",
				"business website",
				"landing page development",
				"landing page design",
				"web design",
				"website design",
				"website development",
				"cms development",
				"content management system",
				"web performance optimisation",
				"web performance optimization",
				"core web vitals",
				"site speed optimisation",
				"website accessibility",
				"web accessibility",
				"interactive platform",
				"digital platform",
				"business platform",
			],
			pl: [
				"strona internetowa na zamówienie",
				"strona firmowa",
				"tworzenie landing page",
				"projektowanie stron",
				"tworzenie stron www",
				"wydajność strony",
				"optymalizacja wydajności strony",
				"dostępność strony www",
				"platforma internetowa",
			],
		},
		// Deliberately excluded: website, platform, design, performance, web, site.
		adjacentTerms: {
			en: ["website redesign", "online presence", "web platform", "website revamp", "site performance"],
			pl: ["odświeżenie strony", "obecność online", "platforma cyfrowa"],
		},
	},
	{
		key: "growth-marketing",
		purpose: "Search/AI visibility, conversion and demand generation.",
		terms: {
			en: [
				"seo",
				"search engine optimisation",
				"search engine optimization",
				"local seo",
				"aeo",
				"answer engine optimisation",
				"answer engine optimization",
				"generative engine optimisation",
				"generative engine optimization",
				"conversion rate optimisation",
				"conversion rate optimization",
				"cro",
				"a/b testing",
				"ab testing",
				"experimentation programme",
				"experimentation program",
				"martech",
				"marketing technology",
				"marketing automation",
				"content marketing",
				"digital marketing",
				"ppc",
				"paid advertising",
				"social media marketing",
			],
			pl: [
				"seo",
				"pozycjonowanie stron",
				"lokalne seo",
				"optymalizacja pod wyszukiwarki",
				"optymalizacja konwersji",
				"testy a/b",
				"marketing treści",
				"marketing cyfrowy",
				"marketing automation",
				"reklama płatna",
				"kampanie reklamowe",
			],
		},
		// Deliberately excluded: marketing, growth, visibility, advertising,
		// content — and, deliberately, bare "geo" (see this file's own doc
		// comment above: "geo" is NOT as safe as "seo"/"aeo"/"cro" because it
		// is also common vocabulary for geography/geolocation outside
		// marketing). Only the full phrase "generative engine
		// optimisation"/"optimization" is ever used.
		adjacentTerms: {
			en: ["online visibility", "search visibility", "marketing strategy", "growth strategy", "lead generation"],
			pl: ["widoczność w internecie", "strategia marketingowa", "generowanie leadów"],
		},
	},
	{
		key: "mentoring",
		purpose: "1:1 technical mentoring and programming education.",
		terms: {
			en: [
				"programming mentoring",
				"coding mentor",
				"tech mentoring",
				"1:1 mentoring",
				"one to one mentoring",
				"programming education",
				"learn to code",
				"coding bootcamp",
				"code review mentoring",
				"career mentoring for developers",
			],
			pl: ["mentoring programowania", "mentoring it", "nauka programowania", "korepetycje z programowania", "mentoring kariery it"],
		},
		// Deliberately excluded: mentoring, education, learning, coach,
		// coaching, lessons.
		adjacentTerms: {
			en: ["learn programming", "programming lessons", "coding lessons", "technical coaching"],
			pl: ["nauka kodowania", "lekcje programowania", "korepetycje it"],
		},
	},
];
