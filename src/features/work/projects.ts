import type { Locale } from "@/lib/routes";

/**
 * Single source of truth for every project shown on the homepage, the
 * /work hub and its case-study pages. SelectedWork.tsx, WorkPage.tsx and
 * the case-study routes all read from this file instead of keeping their
 * own copies - duplicated project text is how PLMS used to end up
 * described as an LMS in one place and a lead-management platform in
 * another. Add a project by adding one entry to `projects` below; every
 * surface that lists projects will pick it up automatically.
 */

export type LocalizedText = {
	en: string;
	pl: string;
};

export type ProjectType =
	| "owned-product"
	| "industry-project"
	| "research-project";

export type ProjectStatus = "active-development" | "completed" | "research";

/** A named art component (see ART_BY_SLUG in the work feature's UI files)
 * or a real screenshot. Kept as data, not JSX, so this file can be
 * imported from Server Components, `generateMetadata` and the sitemap
 * without pulling any component code along with it. */
export type ProjectVisual =
	| { kind: "art"; key: string }
	| {
			kind: "image";
			src: string;
			width: number;
			height: number;
			alt: LocalizedText;
	  };

export type CaseStudySection = {
	heading: LocalizedText;
	body: LocalizedText;
};

export type ProjectCta = {
	label: LocalizedText;
	href: string;
	external?: boolean;
};

export type Project = {
	slug: string;
	name: string;

	type: ProjectType;
	status?: ProjectStatus;

	/** Localized display label for the type pill, e.g. "OWN PRODUCT" /
	 * "WŁASNY PRODUKT" - kept as data rather than derived from `type` so
	 * the exact wording stays authoritative in one place. */
	projectLabel: LocalizedText;
	/** Only set where the card should show a status suffix next to the
	 * type pill (currently just TakBlisko - "OWN PRODUCT · ACTIVE
	 * DEVELOPMENT"). PLMS and Dual-Layer Vault show their type alone. */
	statusLabel?: LocalizedText;

	visual: ProjectVisual;
	externalUrl?: string;

	/** Shown on the homepage card and as the lede of the /work card. */
	shortDescription: LocalizedText;
	/** Context line under the /work card, e.g. "Product strategy ·
	 * Architecture · Full-stack · Growth". */
	role: LocalizedText;

	/** Portfolio tags shown everywhere (homepage, /work, case-study tech line). */
	tags: string[];

	seo: {
		title: LocalizedText;
		description: LocalizedText;
	};

	caseStudy: {
		headline: LocalizedText;
		overview: LocalizedText;
		challenge?: LocalizedText;
		approach?: LocalizedText;
		outcome?: LocalizedText;

		/** Filled only where the case study needs a role more specific
		 * than the portfolio-card `role` (currently PLMS). */
		roleDetail?: LocalizedText;
		team?: LocalizedText;
		delivery?: LocalizedText;
		researchOutcome?: LocalizedText;

		technologies: string[];
		/** Optional grouped breakdown ("Frontend", "Backend & Data", ...)
		 * rendered instead of the flat `technologies` tag row when present -
		 * lets a project's stack read as an actual architecture instead of
		 * one undifferentiated list. Group labels are localized; the tech
		 * names inside each group are not (tags never are - see `tags`
		 * above), matching how `technologies` itself already works. */
		technologyGroups?: { heading: LocalizedText; items: string[] }[];
		capabilities?: LocalizedText[];
		sections?: CaseStudySection[];

		cta?: ProjectCta;
	};
};

export const projects: Project[] = [
	{
		slug: "takblisko",
		name: "TakBlisko",
		type: "owned-product",
		status: "active-development",
		projectLabel: { en: "OWN PRODUCT", pl: " PRODUKT WŁASNY" },
		statusLabel: { en: "ACTIVE DEVELOPMENT", pl: "AKTYWNY ROZWÓJ" },
		visual: {
			kind: "image",
			src: "/work/takblisko-hero.png",
			width: 1600,
			height: 1000,
			alt: {
				en: "TakBlisko homepage showing the local discovery map and sign-up form",
				pl: "Strona główna TakBlisko z mapą lokalnego odkrywania i formularzem zapisu",
			},
		},
		externalUrl: "https://www.takblisko.pl",
		shortDescription: {
			en: "A map-first local discovery platform helping people find events, places and things happening nearby.",
			pl: "Lokalna platforma oparta na mapie, pomagająca odkrywać wydarzenia, miejsca i to, co dzieje się w pobliżu.",
		},
		role: {
			en: "Product strategy · Architecture · Full-stack · Growth",
			pl: "Strategia produktowa · Architektura · Full-stack · Growth",
		},
		tags: ["Next.js", "Supabase", "PostgreSQL"],
		seo: {
			title: {
				en: "TakBlisko - Map-First Local Discovery Platform | Code Consulting Studio",
				pl: "TakBlisko - lokalna platforma odkrywania miejsc i wydarzeń | Code Consulting Studio",
			},
			description: {
				en: "How CCS designed and built TakBlisko, an owned map-first product for discovering local events and places, from architecture to real-world rollout.",
				pl: "Jak CCS zaprojektowało i zbudowało TakBlisko - własny produkt oparty na mapie do odkrywania lokalnych wydarzeń i miejsc, od architektury po wdrożenie.",
			},
		},
		caseStudy: {
			headline: {
				en: "A map-first way to discover what's happening nearby.",
				pl: "Mapa jako prostszy sposób odkrywania tego, co dzieje się w pobliżu.",
			},

			overview: {
				en: "TakBlisko is a CCS-owned local discovery platform built around a simple idea: finding interesting things nearby should be easier. Instead of relying on another endless feed, the product puts the local area at the centre of the experience, helping people discover events, places and activity around them.",
				pl: "TakBlisko to własny produkt CCS oparty na prostej idei: odkrywanie ciekawych rzeczy w najbliższej okolicy powinno być łatwiejsze. Zamiast kolejnego niekończącego się feedu platforma stawia lokalne otoczenie użytkownika w centrum doświadczenia, pomagając odkrywać wydarzenia, miejsca i to, co dzieje się w pobliżu.",
			},

			challenge: {
				en: "Local information is often fragmented across social media, community groups, event pages, business profiles and word of mouth. The information may already exist, but discovering what is relevant nearby often requires knowing where to look. TakBlisko addresses that problem by bringing local discovery into one location-aware experience.",
				pl: "Informacje lokalne są często rozproszone pomiędzy mediami społecznościowymi, grupami lokalnymi, stronami wydarzeń, profilami firm i informacjami przekazywanymi bezpośrednio między ludźmi. Same informacje często już istnieją - problem polega na tym, że trzeba wiedzieć, gdzie ich szukać. TakBlisko odpowiada na ten problem, łącząc lokalne odkrywanie w jednym doświadczeniu uwzględniającym położenie użytkownika.",
			},

			approach: {
				en: "TakBlisko was designed around a map-first experience, where location provides the main context for discovery. Events, places and nearby activity can be explored around the area that matters to the user rather than through a traditional feed. The platform is developed as an evolving product, combining product strategy, UX, engineering, content structure and local growth into one continuous development process.",
				pl: "TakBlisko zostało zaprojektowane wokół podejścia map-first, w którym lokalizacja stanowi główny kontekst odkrywania. Wydarzenia, miejsca i lokalną aktywność można poznawać w odniesieniu do obszaru, który rzeczywiście interesuje użytkownika, zamiast przeszukiwać tradycyjny feed. Platforma jest rozwijana jako ewoluujący produkt, łączący strategię produktową, UX, inżynierię, strukturę treści i lokalny rozwój w jeden spójny proces.",
			},

			outcome: {
				en: "TakBlisko has progressed from an initial product idea into a working platform with a defined local-market direction and continued active development. For CCS, it demonstrates the complete product lifecycle in practice - from identifying a real problem and designing the experience, through architecture and implementation, to rollout, visibility and continuous improvement.",
				pl: "TakBlisko przeszło drogę od początkowej koncepcji do działającej platformy z określonym kierunkiem rozwoju na rynku lokalnym i dalszym aktywnym developmentem. Dla CCS projekt pokazuje w praktyce pełny cykl życia produktu - od zidentyfikowania rzeczywistego problemu i zaprojektowania doświadczenia użytkownika, przez architekturę i implementację, aż po wdrożenie, budowanie widoczności i dalsze doskonalenie.",
			},

			technologies: ["Next.js", "Supabase", "PostgreSQL", "Maps API"],

			technologyGroups: [
				{
					heading: {
						en: "Frontend",
						pl: "Frontend",
					},
					items: ["Next.js", "React", "TypeScript"],
				},
				{
					heading: {
						en: "Backend & Data",
						pl: "Backend i dane",
					},
					items: ["Supabase", "PostgreSQL", "Zod"],
				},
				{
					heading: {
						en: "Platform & Integrations",
						pl: "Platforma i integracje",
					},
					items: ["Maps", "Resend", "GA4"],
				},
				{
					heading: {
						en: "Infrastructure",
						pl: "Infrastruktura",
					},
					items: ["Vercel", "GitHub"],
				},
			],

			capabilities: [
				{
					en: "Product strategy & ownership",
					pl: "Strategia i rozwój własnego produktu",
				},
				{
					en: "Map-first UX design",
					pl: "Projektowanie UX opartego na mapie",
				},
				{
					en: "Location-aware local discovery",
					pl: "Lokalne odkrywanie oparte na lokalizacji",
				},
				{
					en: "Full-stack product engineering",
					pl: "Full-stack engineering produktu",
				},
				{
					en: "Iterative product development",
					pl: "Iteracyjny rozwój produktu",
				},
				{
					en: "Local rollout & growth",
					pl: "Lokalne wdrożenie i rozwój",
				},
			],

			cta: {
				label: {
					en: "Visit TakBlisko",
					pl: "Odwiedź TakBlisko",
				},
				href: "https://www.takblisko.pl",
				external: true,
			},
		},
	},
	{
		slug: "plms",
		name: "PLMS",
		type: "industry-project",
		projectLabel: { en: "INDUSTRY PROJECT", pl: "PROJEKT BRANŻOWY" },
		externalUrl: "https://icp-qho635.vercel.app/",
		visual: {
			kind: "image",
			src: "/work/plms-hero.png",
			width: 1600,
			height: 1000,
			alt: {
				en: "PLMS homepage: manage and convert property leads in one place",
				pl: "Strona główna PLMS: zarządzanie i konwersja leadów nieruchomości w jednym miejscu",
			},
		},
		shortDescription: {
			en: "A property lead management platform built to help real-estate teams organise, track and manage potential clients.",
			pl: "Platforma do zarządzania leadami, pomagająca zespołom nieruchomości organizować, śledzić i obsługiwać potencjalnych klientów.",
		},
		role: {
			en: "Project management · Full-stack development",
			pl: "Zarządzanie projektem · Rozwój full-stack",
		},
		tags: ["Next.js", "Firebase", "Firestore"],
		seo: {
			title: {
				en: "PLMS - Property Lead Management Platform | Code Consulting Studio",
				pl: "PLMS - platforma do zarządzania leadami nieruchomości | Code Consulting Studio",
			},
			description: {
				en: "How a 5-person CCS team delivered PLMS, a property lead management platform for real-estate teams, from requirements to a working MVP.",
				pl: "Jak 5-osobowy zespół CCS dostarczył PLMS - platformę do zarządzania leadami dla zespołów nieruchomości, od wymagań po działające MVP.",
			},
		},
		caseStudy: {
			headline: {
				en: "Turning a fragmented property lead process into one structured workflow.",
				pl: "Przekształcenie rozproszonego procesu obsługi leadów w jeden uporządkowany workflow.",
			},

			overview: {
				en: "PLMS is a property lead management platform developed as an industry project for a real-estate business. It was designed to replace fragmented spreadsheets and manual hand-offs with one shared, role-aware system for managing leads, responsibilities and progress across the sales process.",
				pl: "PLMS to platforma do zarządzania leadami nieruchomości, opracowana jako projekt branżowy dla firmy działającej na rynku nieruchomości. System został zaprojektowany tak, aby zastąpić rozproszone arkusze i ręczne przekazywanie informacji jednym wspólnym rozwiązaniem uwzględniającym role użytkowników, odpowiedzialność i postęp całego procesu sprzedażowego.",
			},

			challenge: {
				en: "Property leads and follow-ups were being managed across spreadsheets and ad-hoc tools, making it difficult to maintain a consistent view of each lead, understand who was responsible for the next action and track progress across the wider team. The real challenge was not simply replacing spreadsheets with a web interface, but translating an existing business process into a structured digital workflow.",
				pl: "Leady nieruchomości i dalsze działania były obsługiwane przy użyciu arkuszy kalkulacyjnych oraz doraźnych narzędzi, co utrudniało utrzymanie spójnego obrazu każdego leada, określenie osoby odpowiedzialnej za kolejny krok oraz śledzenie postępu w całym zespole. Wyzwanie nie polegało więc jedynie na zastąpieniu arkuszy interfejsem webowym, ale na przełożeniu istniejącego procesu biznesowego na uporządkowany workflow cyfrowy.",
			},

			approach: {
				en: "The project began with understanding how property leads moved through the business, what information was required at different stages and how responsibilities were distributed across the team. That process was then translated into a role-aware application designed around the client's real operational workflow rather than a generic CRM structure. PLMS was delivered by a five-person development team, with CCS contributing project management and full-stack development, while the implementation focused first on the complete core lead journey to deliver a usable end-to-end MVP.",
				pl: "Realizację rozpoczęto od zrozumienia sposobu, w jaki leady przechodzą przez proces biznesowy, jakie informacje są potrzebne na poszczególnych etapach oraz jak odpowiedzialność jest rozdzielona pomiędzy członków zespołu. Na tej podstawie proces został przełożony na aplikację uwzględniającą role użytkowników i zaprojektowaną wokół rzeczywistego sposobu działania klienta, zamiast narzucania generycznej struktury CRM. PLMS został zrealizowany przez pięcioosobowy zespół developerski, przy udziale CCS w obszarze zarządzania projektem i full-stack developmentu, a priorytetem było najpierw zbudowanie kompletnej podstawowej ścieżki obsługi leada i dostarczenie użytecznego MVP end-to-end.",
			},

			outcome: {
				en: "The project delivered a working MVP covering the core property lead-management workflow. Instead of relying on disconnected spreadsheets and manual hand-offs, the client gained a shared, role-aware system for managing leads, responsibilities and progress through one structured process.",
				pl: "Projekt zakończył się dostarczeniem działającego MVP obejmującego podstawowy proces zarządzania leadami nieruchomości. Zamiast polegać na rozproszonych arkuszach i ręcznym przekazywaniu informacji klient otrzymał wspólny system uwzględniający role użytkowników, pozwalający zarządzać leadami, odpowiedzialnością i postępem w ramach jednego uporządkowanego procesu.",
			},

			roleDetail: {
				en: "Project Management + Full-Stack Development",
				pl: "Zarządzanie projektem + Full-Stack Development",
			},

			team: {
				en: "5-person development team",
				pl: "5-osobowy zespół developerski",
			},

			delivery: {
				en: "Working MVP",
				pl: "Działające MVP",
			},

			technologies: ["Next.js", "Firebase", "Firestore"],

			technologyGroups: [
				{
					heading: {
						en: "Frontend",
						pl: "Frontend",
					},
					items: ["Next.js", "React", "TypeScript"],
				},
				{
					heading: {
						en: "Backend",
						pl: "Backend",
					},
					items: ["Next.js", "Firebase", "Cloud Firestore"],
				},
				{
					heading: {
						en: "Communication",
						pl: "Komunikacja",
					},
					items: ["Nodemailer", "Email workflows"],
				},
				{
					heading: {
						en: "Architecture",
						pl: "Architektura",
					},
					items: [
						"Role-based workflows",
						"Lead management",
						"Server-side logic",
					],
				},
			],

			capabilities: [
				{
					en: "Centralised lead management",
					pl: "Scentralizowane zarządzanie leadami",
				},
				{
					en: "Structured lead lifecycle",
					pl: "Uporządkowany cykl obsługi leada",
				},
				{
					en: "Lead status & progress tracking",
					pl: "Śledzenie statusu i postępu leadów",
				},
				{
					en: "Role-aware workflows",
					pl: "Workflow uwzględniający role użytkowników",
				},
				{
					en: "Role-based access control",
					pl: "Kontrola dostępu oparta na rolach",
				},
				{
					en: "User-specific views & functionality",
					pl: "Widoki i funkcjonalności dopasowane do użytkownika",
				},
			],

			cta: {
				label: {
					en: "View PLMS",
					pl: "Zobacz PLMS",
				},
				href: "https://icp-qho635.vercel.app/",
				external: true,
			},
		},
	},
	{
		slug: "dual-layer-vault",
		name: "Dual-Layer Vault",
		type: "research-project",
		status: "research",
		projectLabel: { en: "RESEARCH PROJECT", pl: "PROJEKT BADAWCZY" },
		externalUrl: "https://dual-layer-vault.vercel.app/",
		visual: {
			kind: "image",
			src: "/work/dual-layer-vault-hero.png",
			width: 1600,
			height: 1000,
			alt: {
				en: "Dual-Layer Personal Vault landing page with standard and protected access",
				pl: "Strona Dual-Layer Personal Vault z dostępem standardowym i chronionym",
			},
		},
		shortDescription: {
			en: "A dual-layer privacy system designed to control what information is revealed under coercion-prone access.",
			pl: "Dwuwarstwowy system prywatności pozwalający kontrolować zakres informacji ujawnianych w sytuacjach dostępu pod przymusem.",
		},
		role: {
			en: "Research · Architecture · Privacy engineering",
			pl: "Badania · Architektura · Inżynieria prywatności",
		},
		tags: ["Next.js", "Firebase", "Access Control"],
		seo: {
			title: {
				en: "Dual-Layer Vault - Coercion-Resistant Privacy Research | Code Consulting Studio",
				pl: "Dual-Layer Vault - badania nad prywatnością odporną na przymus | Code Consulting Studio",
			},
			description: {
				en: "A research project on controlled-disclosure architecture: what a system should reveal when refusing access isn't safe, accepted for SEEDA-CECNSM 2026.",
				pl: "Projekt badawczy nad architekturą kontrolowanego ujawniania danych - co system powinien pokazać, gdy odmowa dostępu jest niebezpieczna. Praca przyjęta na SEEDA-CECNSM 2026.",
			},
		},
		caseStudy: {
			headline: {
				en: "What should a system reveal when refusing access is unsafe?",
				pl: "Co powinien ujawnić system, gdy odmowa dostępu może być niebezpieczna?",
			},

			overview: {
				en: "Dual-Layer Vault is a research-driven software project exploring a limitation of conventional access control: what happens when a legitimate user is pressured to unlock a system and simply refusing is not a safe option? Instead of relying on encryption alone, the project investigates a controlled-disclosure architecture designed to reveal different, internally consistent layers of information under different access conditions.",
				pl: "Dual-Layer Vault to projekt badawczo-inżynierski analizujący jedno z ograniczeń tradycyjnej kontroli dostępu: co dzieje się wtedy, gdy prawowity użytkownik zostaje zmuszony do odblokowania systemu, a zwykła odmowa może nie być bezpieczna? Zamiast polegać wyłącznie na szyfrowaniu, projekt bada architekturę kontrolowanego ujawniania, która w zależności od sposobu dostępu może prezentować różne, wewnętrznie spójne warstwy informacji.",
			},

			challenge: {
				en: "Traditional authentication and access control are primarily designed to prevent unauthorised access. They generally assume that the legitimate user remains free to refuse when access is demanded. In a coercion-prone situation, that assumption can break down: refusal itself may increase risk. The challenge therefore becomes not only how to protect sensitive information, but how a system might provide a plausible and usable response to forced access without revealing the information the user is trying to protect.",
				pl: "Tradycyjne mechanizmy uwierzytelniania i kontroli dostępu są projektowane przede wszystkim po to, aby zapobiegać nieautoryzowanemu dostępowi. Zazwyczaj zakładają również, że prawowity użytkownik może swobodnie odmówić ujawnienia danych. W sytuacji przymusu to założenie może przestać być prawdziwe, ponieważ sama odmowa może zwiększać ryzyko. Wyzwanie polega więc nie tylko na ochronie poufnych informacji, ale również na tym, jak system może wiarygodnie i użytecznie zareagować na wymuszony dostęp bez ujawniania danych, które użytkownik chce chronić.",
			},

			approach: {
				en: "The project addresses this problem through a dual-layer controlled-disclosure architecture. Standard access presents a functional and internally consistent layer of information, while protected access reveals the protected layer. The standard state is designed to behave as a legitimate system experience rather than an obvious denial or empty decoy. The concept was implemented as a working prototype and evaluated within a defined threat model, combining privacy-oriented architecture, full-stack engineering and user research rather than treating the idea as a purely theoretical security proposal.",
				pl: "Projekt odpowiada na ten problem poprzez dwuwarstwową architekturę kontrolowanego ujawniania. Dostęp standardowy prezentuje funkcjonalną i wewnętrznie spójną warstwę informacji, natomiast dostęp chroniony umożliwia dostęp do właściwej warstwy chronionej. Stan standardowy został zaprojektowany tak, aby zachowywać się jak pełnoprawna część systemu, a nie oczywista odmowa dostępu czy pusta warstwa pozorna. Koncepcja została zaimplementowana jako działający prototyp i poddana ewaluacji w ramach jasno określonego modelu zagrożeń, łącząc projektowanie zorientowane na prywatność, full-stack engineering i badania z udziałem użytkowników.",
			},

			outcome: {
				en: "Dual-Layer Vault progressed from a security and privacy research question into a defined architecture, working prototype, user evaluation and peer-reviewed research contribution. The resulting paper was accepted for publication and presentation at SEEDA-CECNSM 2026, demonstrating how research, threat modelling, software architecture and implementation can be combined within one engineering process.",
				pl: "Dual-Layer Vault przeszedł drogę od pytania badawczego dotyczącego bezpieczeństwa i prywatności do zdefiniowanej architektury, działającego prototypu, ewaluacji z udziałem użytkowników oraz recenzowanego rezultatu naukowego. Powstały na podstawie projektu artykuł został przyjęty do publikacji i prezentacji podczas SEEDA-CECNSM 2026, pokazując, jak badania, modelowanie zagrożeń, architektura oprogramowania i implementacja mogą zostać połączone w jednym procesie inżynierskim.",
			},

			researchOutcome: {
				en: "Accepted for publication and presentation - SEEDA-CECNSM 2026 - IEEE conference proceedings.",
				pl: "Przyjęte do publikacji i prezentacji - SEEDA-CECNSM 2026 - materiały konferencyjne IEEE.",
			},

			technologies: ["Next.js", "Firebase", "Access Control"],

			technologyGroups: [
				{
					heading: {
						en: "Application",
						pl: "Aplikacja",
					},
					items: ["Next.js", "React", "TypeScript"],
				},
				{
					heading: {
						en: "Data",
						pl: "Dane",
					},
					items: ["Firebase", "Cloud Firestore"],
				},
				{
					heading: {
						en: "Security Architecture",
						pl: "Architektura bezpieczeństwa",
					},
					items: [
						"HMAC",
						"HTTP Cookies",
						"Server-Side Access Checks",
						"Dual-Layer Access Control",
					],
				},
				{
					heading: {
						en: "Research & Evaluation",
						pl: "Badania i ewaluacja",
					},
					items: [
						"Design Science Research",
						"Usability Evaluation",
						"Statistical Analysis",
					],
				},
				{
					heading: {
						en: "Infrastructure",
						pl: "Infrastruktura",
					},
					items: ["Vercel", "GitHub"],
				},
			],

			capabilities: [
				{
					en: "Privacy-oriented system design",
					pl: "Projektowanie systemów zorientowane na prywatność",
				},
				{
					en: "Controlled disclosure architecture",
					pl: "Architektura kontrolowanego ujawniania",
				},
				{
					en: "Dual-layer access design",
					pl: "Projektowanie dwuwarstwowego modelu dostępu",
				},
				{
					en: "Threat modelling",
					pl: "Modelowanie zagrożeń",
				},
				{
					en: "Research-driven engineering",
					pl: "Inżynieria oparta na badaniach",
				},
				{
					en: "User evaluation & analysis",
					pl: "Ewaluacja użytkowników i analiza wyników",
				},
			],

			sections: [
				{
					heading: {
						en: "Threat model",
						pl: "Model zagrożeń",
					},
					body: {
						en: "The project focuses on interpersonal coercion and observed interaction: a scenario in which an adversary can pressure the legitimate user to access the system and may know that a controlled-disclosure mechanism exists. The model does not assume compromise of the backend, source code, network infrastructure, administrative access or forensic extraction. This boundary is intentional - the architecture is evaluated against a defined coercion scenario rather than presented as a universal defence against every form of system compromise.",
						pl: "Projekt koncentruje się na przymusie interpersonalnym i obserwowanej interakcji - sytuacji, w której osoba wywierająca presję może zmusić prawowitego użytkownika do uzyskania dostępu do systemu i może wiedzieć o istnieniu mechanizmu kontrolowanego ujawniania. Model nie zakłada kompromitacji backendu, kodu źródłowego, infrastruktury sieciowej, dostępu administracyjnego ani analizy forensycznej. Granica ta jest celowa - architektura jest oceniana względem jasno określonego scenariusza przymusu, a nie przedstawiana jako uniwersalna ochrona przed każdym możliwym sposobem kompromitacji systemu.",
					},
				},
				{
					heading: {
						en: "Implementation",
						pl: "Implementacja",
					},
					body: {
						en: "The controlled-disclosure architecture was implemented as an end-to-end web application with separate standard and protected access states. Access mode is determined server-side and the application maintains separation between the information available through each state. This allowed the proposed architecture to be evaluated as a working interactive system rather than only as a conceptual security model.",
						pl: "Architektura kontrolowanego ujawniania została zaimplementowana jako kompletna aplikacja webowa z oddzielnymi standardowymi i chronionymi stanami dostępu. Tryb dostępu jest określany po stronie serwera, a aplikacja utrzymuje rozdzielenie informacji dostępnych w poszczególnych stanach. Dzięki temu proponowana architektura mogła zostać oceniona jako działający, interaktywny system, a nie wyłącznie jako koncepcyjny model bezpieczeństwa.",
					},
				},
				{
					heading: {
						en: "Evaluation",
						pl: "Ewaluacja",
					},
					body: {
						en: "The prototype was evaluated through user studies examining usability, interface clarity and interaction with the dual-layer access model. Post-development evaluation included 33 participants and showed strong overall usability, while mode switching emerged as the comparatively weakest aspect of the interaction and an important area for future refinement. The evaluation complements the architectural work by examining whether the controlled-disclosure concept remains understandable and usable in practice.",
						pl: "Prototyp został poddany ewaluacji z udziałem użytkowników, obejmującej użyteczność, czytelność interfejsu oraz sposób interakcji z dwuwarstwowym modelem dostępu. W ewaluacji po zakończeniu developmentu uczestniczyły 33 osoby. Wyniki wskazały na wysoką ogólną użyteczność, natomiast przełączanie pomiędzy trybami okazało się relatywnie najsłabszym elementem interakcji i ważnym obszarem dalszego doskonalenia. Ewaluacja uzupełnia część architektoniczną, sprawdzając, czy koncepcja kontrolowanego ujawniania pozostaje zrozumiała i użyteczna w praktyce.",
					},
				},
			],

			cta: {
				label: {
					en: "View research prototype",
					pl: "Zobacz prototyp badawczy",
				},
				href: "https://dual-layer-vault.vercel.app/",
				external: true,
			},
		},
	},
];

export function getAllProjects(): Project[] {
	return projects;
}

export function getProject(slug: string): Project | undefined {
	return projects.find((p) => p.slug === slug);
}

export function getProjectSlugs(): string[] {
	return projects.map((p) => p.slug);
}

export function localized(text: LocalizedText, locale: Locale): string {
	return text[locale];
}
