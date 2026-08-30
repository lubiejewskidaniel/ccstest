import { PageHero } from "@/components/PageHero";

import { LegalNotice } from "./LegalNotice";

import type { Locale } from "@/lib/routes";

const COPY = {
	en: {
		heroEyebrow: "Accessibility",
		heroTitle: "Accessibility Statement",

		meta: "Last updated: 30 August 2026 · Accessibility target: WCAG 2.2 AA",

		commitmentTitle: "Our commitment",
		commitmentText:
			"Code Consulting Studio aims to make this website usable by as many people as reasonably possible, including people who use keyboards, screen readers, zoom, alternative input methods or reduced-motion settings.",
		commitmentText2:
			"We use the Web Content Accessibility Guidelines (WCAG) 2.2 Level AA as our technical accessibility target. This is an ongoing design and testing objective rather than a claim that every page has been independently certified as fully conformant.",

		lawTitle: "Accessibility and equality",
		lawText:
			"Accessibility is considered as part of the design and development of CCS services. Where applicable, we also consider obligations relating to disabled users and reasonable adjustments under the Equality Act 2010.",

		measuresTitle: "Measures we take",
		measures: [
			"Use semantic HTML and meaningful page structure where practical",
			"Maintain a logical heading hierarchy",
			'Provide a "Skip to content" mechanism for keyboard navigation',
			"Design interactive controls to be usable with a keyboard and provide visible focus states",
			"Associate form controls with meaningful labels and provide understandable validation feedback",
			"Avoid relying on colour alone to communicate important meaning",
			"Support reduced-motion preferences for non-essential animation where implemented",
			"Design responsive layouts intended to work across common viewport sizes and zoom levels",
			"Use alternative text for meaningful images where appropriate",
			"Review accessibility as components and pages are changed or added",
		],

		testingTitle: "Testing",
		testingText:
			"Accessibility is reviewed through a combination of development practices, browser testing and automated or manual checks where appropriate. Automated tools cannot identify every accessibility issue, so they are treated as one part of the review process rather than proof of full compliance.",

		limitationsTitle: "Known limitations",
		limitationsText:
			"CCS is actively developing the website, and newer or substantially changed pages may not yet have received the same level of manual accessibility review as established parts of the site. Third-party content or services may also have accessibility characteristics outside our direct control.",

		adjustmentsTitle: "Reasonable adjustments",
		adjustmentsText:
			"If a feature or format prevents you from accessing information or using a CCS service because of a disability, please contact us. Where reasonably possible, we will look for an accessible alternative or an appropriate adjustment.",

		feedbackTitle: "Accessibility feedback",
		feedbackText:
			"If you encounter an accessibility barrier, please contact Code Consulting Studio through the Contact page. It helps if you tell us which page or feature caused the problem, what you were trying to do and, if relevant, which browser or assistive technology you were using.",

		changesTitle: "Reviewing this statement",
		changesText:
			"We review this statement as the website develops and may update it following accessibility testing, user feedback, changes to the site or changes in applicable standards and guidance.",
	},

	pl: {
		heroEyebrow: "Dostępność",
		heroTitle: "Deklaracja dostępności",

		meta: "Ostatnia aktualizacja: 30 sierpnia 2026 · Cel dostępności: WCAG 2.2 AA",

		commitmentTitle: "Nasze podejście",
		commitmentText:
			"Code Consulting Studio dąży do tego, aby strona była możliwie dostępna dla szerokiego grona użytkowników, w tym osób korzystających z klawiatury, czytników ekranu, powiększenia, alternatywnych metod wprowadzania danych lub ustawień ograniczających ruch.",
		commitmentText2:
			"Web Content Accessibility Guidelines (WCAG) 2.2 na poziomie AA traktujemy jako techniczny cel dostępności. Jest to ciągły cel projektowania i testowania, a nie deklaracja, że każda podstrona została niezależnie certyfikowana jako w pełni zgodna ze standardem.",

		lawTitle: "Dostępność i równe traktowanie",
		lawText:
			"Dostępność uwzględniamy w projektowaniu i rozwijaniu usług CCS. Tam, gdzie ma to zastosowanie, bierzemy również pod uwagę obowiązki dotyczące osób z niepełnosprawnościami i racjonalnych usprawnień wynikające z Equality Act 2010.",

		measuresTitle: "Stosowane rozwiązania",
		measures: [
			"Stosowanie semantycznego HTML i czytelnej struktury stron tam, gdzie jest to praktyczne",
			"Utrzymywanie logicznej hierarchii nagłówków",
			'Udostępnienie mechanizmu "Przejdź do treści" ułatwiającego nawigację klawiaturą',
			"Projektowanie elementów interaktywnych z myślą o obsłudze klawiaturą i widocznych stanach fokusu",
			"Łączenie pól formularzy z odpowiednimi etykietami i wyświetlanie zrozumiałych komunikatów walidacyjnych",
			"Unikanie przekazywania istotnych informacji wyłącznie za pomocą koloru",
			"Uwzględnianie preferencji ograniczonego ruchu dla nieistotnych animacji, tam gdzie są stosowane",
			"Projektowanie responsywnego układu przeznaczonego do działania na typowych rozmiarach ekranów i poziomach powiększenia",
			"Stosowanie tekstów alternatywnych dla istotnych obrazów, gdy jest to właściwe",
			"Ponowna ocena dostępności przy zmianach i dodawaniu komponentów lub podstron",
		],

		testingTitle: "Testowanie",
		testingText:
			"Dostępność jest oceniana poprzez praktyki developerskie, testowanie w przeglądarkach oraz, tam gdzie jest to odpowiednie, kontrole automatyczne i ręczne. Narzędzia automatyczne nie wykrywają wszystkich problemów dostępności, dlatego traktujemy je jako część procesu, a nie potwierdzenie pełnej zgodności.",

		limitationsTitle: "Znane ograniczenia",
		limitationsText:
			"CCS aktywnie rozwija stronę, dlatego nowe lub znacząco zmienione podstrony mogą jeszcze nie mieć takiego samego poziomu ręcznej weryfikacji dostępności jak bardziej dojrzałe części serwisu. Materiały lub usługi podmiotów trzecich mogą również posiadać cechy dostępności pozostające poza naszą bezpośrednią kontrolą.",

		adjustmentsTitle: "Racjonalne usprawnienia",
		adjustmentsText:
			"Jeżeli z powodu niepełnosprawności dana funkcja lub format uniemożliwia Ci dostęp do informacji albo skorzystanie z usługi CCS, skontaktuj się z nami. Tam, gdzie jest to rozsądnie możliwe, postaramy się zapewnić dostępne rozwiązanie alternatywne lub odpowiednie usprawnienie.",

		feedbackTitle: "Zgłaszanie problemów z dostępnością",
		feedbackText:
			"Jeżeli napotkasz barierę dostępności, skontaktuj się z Code Consulting Studio poprzez stronę Kontakt. Pomocne będzie wskazanie strony lub funkcji, której dotyczy problem, czynności, którą próbujesz wykonać, oraz - jeśli ma to znaczenie - używanej przeglądarki lub technologii wspomagającej.",

		changesTitle: "Przegląd deklaracji",
		changesText:
			"Przeglądamy tę deklarację wraz z rozwojem strony i możemy ją aktualizować po testach dostępności, otrzymaniu opinii użytkowników, zmianach serwisu lub zmianach właściwych standardów i wytycznych.",
	},
};

export function AccessibilityStatement({ locale }: { locale: Locale }) {
	const t = COPY[locale];

	return (
		<main>
			<PageHero eyebrow={t.heroEyebrow} title={t.heroTitle} />

			<section className="tight">
				<div className="wrap prose">
					<LegalNotice locale={locale} />

					<p className="prose-meta">{t.meta}</p>

					<h2>{t.commitmentTitle}</h2>
					<p>{t.commitmentText}</p>
					<p>{t.commitmentText2}</p>

					<h2>{t.lawTitle}</h2>
					<p>{t.lawText}</p>

					<h2>{t.measuresTitle}</h2>
					<ul>
						{t.measures.map((measure) => (
							<li key={measure}>{measure}</li>
						))}
					</ul>

					<h2>{t.testingTitle}</h2>
					<p>{t.testingText}</p>

					<h2>{t.limitationsTitle}</h2>
					<p>{t.limitationsText}</p>

					<h2>{t.adjustmentsTitle}</h2>
					<p>{t.adjustmentsText}</p>

					<h2>{t.feedbackTitle}</h2>
					<p>{t.feedbackText}</p>

					<h2>{t.changesTitle}</h2>
					<p>{t.changesText}</p>
				</div>
			</section>
		</main>
	);
}
