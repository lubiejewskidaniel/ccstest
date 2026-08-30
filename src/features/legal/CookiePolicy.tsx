import { PageHero } from "@/components/PageHero";

import { LegalNotice } from "./LegalNotice";

import type { Locale } from "@/lib/routes";

const COPY = {
	en: {
		heroEyebrow: "Cookies",
		heroTitle: "Cookie & Storage Policy",

		meta: "Last updated: 30 August 2026 · Version 2026-08-3",

		introTitle: "About this policy",
		introText:
			"This policy explains how Code Consulting Studio uses cookies, browser storage and similar storage or access technologies on this website. It should be read together with our Privacy Notice.",

		lawTitle: "Cookies, storage and the law",
		lawText:
			"Our use of cookies and similar technologies is intended to comply with applicable UK privacy and electronic communications law, including the Privacy and Electronic Communications Regulations (PECR). Where information collected through these technologies is personal information, UK data protection law may also apply.",
		lawText2:
			"These rules are not limited to traditional cookies. They can also apply to technologies such as local browser storage, scripts, tags and other mechanisms that store information on, or access information from, a user's device.",

		consentTitle: "How consent works",
		consentText:
			'Technologies are grouped according to their purpose. Technologies that are strictly necessary for a service requested by the user may be used without optional consent where the law permits this. Optional analytics and marketing technologies are disabled by default and are not intended to be activated until the required choice has been made. You can change your preferences through "Manage preferences".',

		categoriesTitle: "Categories",

		table: {
			category: "Category",
			purpose: "Purpose",
			default: "Default",
			rows: [
				{
					category: "Strictly necessary",
					purpose:
						"Technologies required for essential website functionality or to remember choices necessary for the service, including consent preferences where applicable.",
					default: "Available where necessary",
				},
				{
					category: "Analytics",
					purpose:
						"Technologies used to understand how visitors use the website and to improve performance, content and user experience. This currently includes Google Analytics 4 where analytics consent has been given.",
					default: "Off until accepted",
				},
				{
					category: "Marketing",
					purpose:
						"Reserved for optional technologies that may in future support advertising, campaign measurement or similar marketing activity. CCS does not currently use this category to serve behavioural advertising.",
					default: "Off until accepted",
				},
			],
		},

		storageTitle: "What we store and where",
		storageItems: [
			"Some website preferences may be stored locally in your browser using technologies such as localStorage rather than traditional cookies.",
			"Your consent preferences may be stored so that the website can remember the choices you have made.",
			"If analytics is accepted, Google Analytics 4 may set or access first-party cookies or related identifiers used to measure website usage.",
			"The technologies used by the website may change as functionality develops. Material changes will be reflected in this policy.",
		],

		gaTitle: "Google Analytics 4",
		gaText:
			"Where analytics consent has been given, CCS uses Google Analytics 4 to understand how visitors interact with the website. Google Analytics may use cookies or similar identifiers to distinguish users and sessions and generate usage information. Analytics technologies are not intended to operate before the relevant consent has been provided.",

		durationTitle: "How long technologies remain",
		durationText:
			"Retention depends on the technology and its purpose. Session-based information may disappear when a browsing session ends, while persistent cookies or browser storage may remain until they expire, are replaced or are removed. Some browser storage does not automatically expire. CCS aims to keep stored information only for a period proportionate to its purpose.",

		thirdPartyTitle: "Third-party technologies",
		thirdPartyText:
			"Some technologies used by this website may be provided by third parties, such as analytics providers. Those providers may process information under their own privacy terms and their contractual arrangements with CCS. Optional third-party technologies are intended to be enabled only where the appropriate consent or other legal permission applies.",

		choicesTitle: "Managing your choices",
		choicesText:
			'You can accept or reject optional categories through the cookie controls and change your decision later through "Manage preferences". You can also remove cookies or browser storage through your browser settings. Removing stored preferences may cause the website to ask for your choices again.',

		browserTitle: "Browser controls",
		browserText:
			"Most browsers allow you to view, block or delete cookies and site data. Browser settings are separate from the choices provided by CCS and may affect how websites function if storage required for essential features is blocked.",

		changesTitle: "Changes to this policy",
		changesText:
			"We may update this policy when functionality, service providers, technologies, regulatory guidance or legal requirements change. The current version will be published on this page.",

		contactTitle: "Contact",
		contactText:
			"If you have questions about cookies, browser storage or similar technologies used by CCS, please contact us using the details provided on the Contact page.",
	},

	pl: {
		heroEyebrow: "Cookies",
		heroTitle: "Polityka cookies i przechowywania danych",

		meta: "Ostatnia aktualizacja: 30 sierpnia 2026 · Wersja 2026-08-3",

		introTitle: "O tej polityce",
		introText:
			"Niniejsza polityka wyjaśnia, w jaki sposób Code Consulting Studio wykorzystuje pliki cookies, pamięć przeglądarki oraz podobne technologie zapisu lub odczytu informacji. Należy ją czytać łącznie z naszą Polityką prywatności.",

		lawTitle: "Cookies, przechowywanie danych i prawo",
		lawText:
			"Korzystanie przez nas z cookies i podobnych technologii jest projektowane z uwzględnieniem obowiązujących w Wielkiej Brytanii przepisów dotyczących prywatności i komunikacji elektronicznej, w tym Privacy and Electronic Communications Regulations (PECR). Jeżeli informacje pozyskiwane za pomocą tych technologii stanowią dane osobowe, zastosowanie mogą mieć również brytyjskie przepisy o ochronie danych.",
		lawText2:
			"Zasady te nie ograniczają się do tradycyjnych plików cookies. Mogą obejmować również pamięć lokalną przeglądarki, skrypty, tagi i inne mechanizmy zapisujące informacje na urządzeniu użytkownika lub uzyskujące do nich dostęp.",

		consentTitle: "Jak działa zgoda",
		consentText:
			'Technologie są grupowane według ich przeznaczenia. Technologie ściśle niezbędne do świadczenia usługi żądanej przez użytkownika mogą być wykorzystywane bez opcjonalnej zgody, jeżeli pozwalają na to przepisy. Opcjonalne technologie analityczne i marketingowe są domyślnie wyłączone i nie powinny być uruchamiane przed dokonaniem wymaganego wyboru. Preferencje możesz zmienić poprzez opcję "Zarządzaj preferencjami".',

		categoriesTitle: "Kategorie",

		table: {
			category: "Kategoria",
			purpose: "Cel",
			default: "Domyślnie",
			rows: [
				{
					category: "Niezbędne",
					purpose:
						"Technologie wymagane do podstawowego działania strony lub zapamiętania ustawień niezbędnych do świadczenia usługi, w tym preferencji dotyczących zgody, jeśli ma to zastosowanie.",
					default: "Dostępne, gdy są niezbędne",
				},
				{
					category: "Analityka",
					purpose:
						"Technologie pomagające zrozumieć, w jaki sposób użytkownicy korzystają ze strony, oraz ulepszać jej działanie, treści i doświadczenie użytkownika. Obecnie obejmuje to Google Analytics 4 po wyrażeniu zgody na analitykę.",
					default: "Wyłączona do momentu zgody",
				},
				{
					category: "Marketing",
					purpose:
						"Kategoria przeznaczona dla opcjonalnych technologii, które mogą w przyszłości wspierać reklamę, pomiar kampanii lub podobne działania marketingowe. CCS obecnie nie wykorzystuje tej kategorii do reklam behawioralnych.",
					default: "Wyłączony do momentu zgody",
				},
			],
		},

		storageTitle: "Co i gdzie przechowujemy",
		storageItems: [
			"Niektóre preferencje strony mogą być zapisywane lokalnie w przeglądarce przy użyciu technologii takich jak localStorage, a nie tradycyjnych plików cookies.",
			"Preferencje dotyczące zgody mogą być przechowywane, aby strona pamiętała dokonany przez Ciebie wybór.",
			"Jeżeli zaakceptujesz analitykę, Google Analytics 4 może ustawiać lub odczytywać własne pliki cookies albo powiązane identyfikatory wykorzystywane do pomiaru korzystania ze strony.",
			"Technologie wykorzystywane przez stronę mogą zmieniać się wraz z rozwojem funkcjonalności. Istotne zmiany będą odzwierciedlane w tej polityce.",
		],

		gaTitle: "Google Analytics 4",
		gaText:
			"Po wyrażeniu zgody na analitykę CCS korzysta z Google Analytics 4, aby lepiej rozumieć sposób korzystania ze strony. Google Analytics może wykorzystywać cookies lub podobne identyfikatory do rozróżniania użytkowników i sesji oraz tworzenia informacji analitycznych. Technologie analityczne nie powinny działać przed udzieleniem odpowiedniej zgody.",

		durationTitle: "Jak długo technologie pozostają aktywne",
		durationText:
			"Okres przechowywania zależy od rodzaju technologii i jej celu. Dane sesyjne mogą zniknąć po zakończeniu sesji, natomiast trwałe cookies lub dane w pamięci przeglądarki mogą pozostawać do czasu wygaśnięcia, zastąpienia albo usunięcia. Niektóre mechanizmy pamięci przeglądarki nie mają automatycznego terminu wygaśnięcia. CCS dąży do przechowywania informacji tylko przez okres proporcjonalny do ich celu.",

		thirdPartyTitle: "Technologie podmiotów trzecich",
		thirdPartyText:
			"Niektóre technologie wykorzystywane na stronie mogą być dostarczane przez podmioty trzecie, takie jak dostawcy analityki. Mogą one przetwarzać informacje zgodnie z własnymi zasadami prywatności oraz ustaleniami umownymi z CCS. Opcjonalne technologie podmiotów trzecich powinny być uruchamiane wyłącznie wtedy, gdy istnieje odpowiednia zgoda lub inna właściwa podstawa prawna.",

		choicesTitle: "Zarządzanie preferencjami",
		choicesText:
			'Opcjonalne kategorie możesz zaakceptować lub odrzucić za pomocą ustawień cookies, a później zmienić decyzję poprzez opcję "Zarządzaj preferencjami". Możesz również usuwać cookies i dane strony w ustawieniach swojej przeglądarki. Usunięcie zapisanych preferencji może spowodować ponowne wyświetlenie prośby o dokonanie wyboru.',

		browserTitle: "Ustawienia przeglądarki",
		browserText:
			"Większość przeglądarek umożliwia przeglądanie, blokowanie i usuwanie cookies oraz danych stron. Ustawienia przeglądarki działają niezależnie od ustawień oferowanych przez CCS, a zablokowanie danych niezbędnych do podstawowych funkcji może wpływać na działanie witryny.",

		changesTitle: "Zmiany w tej polityce",
		changesText:
			"Możemy aktualizować tę politykę wraz ze zmianami funkcjonalności, dostawców usług, stosowanych technologii, wytycznych regulacyjnych lub obowiązujących przepisów. Aktualna wersja będzie publikowana na tej stronie.",

		contactTitle: "Kontakt",
		contactText:
			"Jeśli masz pytania dotyczące cookies, pamięci przeglądarki lub podobnych technologii wykorzystywanych przez CCS, skontaktuj się z nami za pomocą danych dostępnych na stronie Kontakt.",
	},
};

export function CookiePolicy({ locale }: { locale: Locale }) {
	const t = COPY[locale];

	return (
		<main>
			<PageHero eyebrow={t.heroEyebrow} title={t.heroTitle} />

			<section className="tight">
				<div className="wrap prose">
					<LegalNotice locale={locale} />

					<p className="prose-meta">{t.meta}</p>

					<h2>{t.introTitle}</h2>
					<p>{t.introText}</p>

					<h2>{t.lawTitle}</h2>
					<p>{t.lawText}</p>
					<p>{t.lawText2}</p>

					<h2>{t.consentTitle}</h2>
					<p>{t.consentText}</p>

					<h2>{t.categoriesTitle}</h2>

					<table>
						<thead>
							<tr>
								<th>{t.table.category}</th>
								<th>{t.table.purpose}</th>
								<th>{t.table.default}</th>
							</tr>
						</thead>

						<tbody>
							{t.table.rows.map((row) => (
								<tr key={row.category}>
									<td>{row.category}</td>
									<td>{row.purpose}</td>
									<td>{row.default}</td>
								</tr>
							))}
						</tbody>
					</table>

					<h2>{t.storageTitle}</h2>
					<ul>
						{t.storageItems.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>

					<h2>{t.gaTitle}</h2>
					<p>{t.gaText}</p>

					<h2>{t.durationTitle}</h2>
					<p>{t.durationText}</p>

					<h2>{t.thirdPartyTitle}</h2>
					<p>{t.thirdPartyText}</p>

					<h2>{t.choicesTitle}</h2>
					<p>{t.choicesText}</p>

					<h2>{t.browserTitle}</h2>
					<p>{t.browserText}</p>

					<h2>{t.changesTitle}</h2>
					<p>{t.changesText}</p>

					<h2>{t.contactTitle}</h2>
					<p>{t.contactText}</p>
				</div>
			</section>
		</main>
	);
}
