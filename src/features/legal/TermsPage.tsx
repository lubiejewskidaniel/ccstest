import { PageHero } from "@/components/PageHero";

import { LegalNotice } from "./LegalNotice";

import type { Locale } from "@/lib/routes";

const COPY = {
	en: {
		heroEyebrow: "Terms",
		heroTitle: "Website Terms of Use",

		meta: "Last updated: 30 August 2026 · Version 2026-08-3",

		aboutTitle: "About these terms",
		aboutText:
			"These terms govern your use of the Code Consulting Studio website. By using the website, you agree to use it lawfully and in accordance with these terms. Separate terms may apply if you later enter into a paid project, mentoring arrangement or other service agreement with CCS.",

		useTitle: "Using this website",
		useText:
			"You may browse the website, read its content and use available contact or enquiry features for legitimate purposes. You must not use the website in a way that is unlawful, fraudulent, harmful or intended to interfere with its operation, security or availability.",

		prohibitedTitle: "Prohibited use",
		prohibitedItems: [
			"Attempting to gain unauthorised access to the website, server, accounts or connected systems",
			"Introducing malware, malicious code or intentionally harmful requests",
			"Attempting to disrupt, overload or interfere with the website or its infrastructure",
			"Using automated extraction, scraping or similar techniques at a scale or in a manner that materially interferes with the service or infringes applicable rights",
			"Using website content or systems for fraudulent, unlawful or misleading purposes",
			"Impersonating another person or misrepresenting your relationship with CCS",
		],

		enquiriesTitle: "Enquiries are not a contract",
		enquiriesText:
			"Submitting a project, growth, mentoring or general enquiry does not by itself create a contract, guarantee acceptance of work or commit either party to proceed. Any paid engagement, including its scope, price, payment terms, responsibilities, deliverables and timetable, must be agreed separately.",

		estimatesTitle: "Quotes, estimates and availability",
		estimatesText:
			"Information shown on the website about services, capabilities or potential ways of working is general information unless expressly stated otherwise. Any quotation, proposal, availability estimate or project timetable provided in response to an enquiry may be subject to separate written terms.",

		ipTitle: "Intellectual property",
		ipText:
			"Unless otherwise stated, the website's original text, visual design, CCS branding, graphics and other original materials are owned by or licensed to Code Consulting Studio and are protected by applicable intellectual property law.",
		ipText2:
			"You may view the website and make reasonable personal or internal business use of its content. You may not reproduce, republish, sell, misrepresent or commercially exploit substantial parts of the website or CCS branding without permission, except where the law permits otherwise.",

		portfolioTitle: "Projects, products and third-party material",
		portfolioText:
			"Examples of work, products, technologies and third-party brands may appear on the website for information or portfolio purposes. Rights in third-party names, logos, screenshots, content or other assets remain with their respective owners. Client-specific publication and intellectual property arrangements are governed by the relevant agreement or permission.",

		informationTitle: "Educational and informational content",
		informationText:
			"Articles, technical explanations, examples and other educational material on the website are provided for general information and learning. They should not be treated as legal, financial, tax, medical or other regulated professional advice. Technical information may also become outdated as technologies and standards change.",

		linksTitle: "Third-party websites",
		linksText:
			"The website may contain links to third-party websites or services. CCS does not control those services and is not responsible for their content, availability, security or privacy practices. A link does not necessarily mean that CCS endorses the third party.",

		availabilityTitle: "Website availability",
		availabilityText:
			"We aim to keep the website accurate, secure and available, but we do not promise uninterrupted or error-free access. We may modify, suspend, restrict or remove parts of the website where reasonably necessary, including for maintenance, security or development.",

		liabilityTitle: "Liability",
		liabilityText:
			"Nothing in these terms excludes or limits liability where doing so would be unlawful, including liability that cannot legally be excluded or restricted. Subject to those limits, CCS is not responsible for losses caused solely by reliance on general website information where a specific professional or contractual assessment would reasonably be required.",
		liabilityText2:
			"If you use the website as a consumer, nothing in these terms affects any mandatory consumer rights you have under applicable law.",

		changesTitle: "Changes to the website and these terms",
		changesText:
			"We may update the website and these terms when our services, technology or legal requirements change. The current version will be published on this page. Changes do not retrospectively alter a separate contract already agreed with a client unless that contract allows it.",

		lawTitle: "Applicable law",
		lawText:
			"These website terms are intended to operate under the laws applicable to the operator of CCS in the United Kingdom. Nothing in these terms is intended to remove mandatory rights or protections that apply to you under applicable consumer or other law.",

		contactTitle: "Contact",
		contactText:
			"If you have questions about these Website Terms of Use, please contact Code Consulting Studio using the details on the Contact page.",
	},

	pl: {
		heroEyebrow: "Regulamin",
		heroTitle: "Warunki korzystania z serwisu",

		meta: "Ostatnia aktualizacja: 30 sierpnia 2026 · Wersja 2026-08-3",

		aboutTitle: "O tych warunkach",
		aboutText:
			"Niniejsze warunki określają zasady korzystania ze strony internetowej Code Consulting Studio. Korzystając ze strony, zobowiązujesz się używać jej zgodnie z prawem i niniejszymi zasadami. Jeżeli później zawrzesz z CCS umowę dotyczącą płatnego projektu, mentoringu lub innej usługi, zastosowanie mogą mieć osobne warunki.",

		useTitle: "Korzystanie z serwisu",
		useText:
			"Możesz przeglądać stronę, korzystać z jej treści oraz dostępnych formularzy kontaktowych i zapytań w uzasadnionych celach. Nie wolno korzystać ze strony w sposób niezgodny z prawem, oszukańczy, szkodliwy ani mający na celu zakłócenie jej działania, bezpieczeństwa lub dostępności.",

		prohibitedTitle: "Niedozwolone korzystanie",
		prohibitedItems: [
			"Próby uzyskania nieuprawnionego dostępu do strony, serwera, kont lub połączonych systemów",
			"Wprowadzanie złośliwego oprogramowania, szkodliwego kodu lub celowo niebezpiecznych żądań",
			"Próby zakłócania, przeciążania lub ingerowania w działanie strony lub jej infrastruktury",
			"Automatyczne pobieranie danych, scraping lub podobne działania prowadzone w skali lub w sposób istotnie zakłócający usługę albo naruszający obowiązujące prawa",
			"Wykorzystywanie strony lub jej systemów do celów oszukańczych, niezgodnych z prawem lub wprowadzających w błąd",
			"Podszywanie się pod inną osobę albo nieprawdziwe przedstawianie swojej relacji z CCS",
		],

		enquiriesTitle: "Wysłanie zapytania nie oznacza zawarcia umowy",
		enquiriesText:
			"Wysłanie zapytania dotyczącego projektu, marketingu, mentoringu lub innej sprawy nie prowadzi samo w sobie do zawarcia umowy, nie gwarantuje przyjęcia zlecenia ani nie zobowiązuje żadnej ze stron do rozpoczęcia współpracy. Każda płatna współpraca, w tym jej zakres, cena, warunki płatności, obowiązki, rezultaty i harmonogram, jest uzgadniana osobno.",

		estimatesTitle: "Oferty, wyceny i dostępność",
		estimatesText:
			"Informacje dostępne na stronie dotyczące usług, kompetencji lub sposobów współpracy mają charakter ogólny, chyba że wyraźnie wskazano inaczej. Wycena, propozycja, informacja o dostępności lub harmonogram przekazany w odpowiedzi na zapytanie może podlegać osobnym pisemnym warunkom.",

		ipTitle: "Własność intelektualna",
		ipText:
			"O ile nie wskazano inaczej, oryginalne teksty strony, projekt wizualny, identyfikacja CCS, grafiki i inne oryginalne materiały należą do Code Consulting Studio lub są wykorzystywane na podstawie odpowiednich uprawnień i podlegają właściwym przepisom dotyczącym własności intelektualnej.",
		ipText2:
			"Możesz przeglądać stronę oraz korzystać z jej treści w rozsądnym zakresie prywatnym lub wewnętrznym w swojej działalności. Bez odpowiedniego zezwolenia nie wolno kopiować, ponownie publikować, sprzedawać, przedstawiać jako własnych ani komercyjnie wykorzystywać istotnych części serwisu lub identyfikacji CCS, chyba że przepisy stanowią inaczej.",

		portfolioTitle: "Projekty, produkty i materiały podmiotów trzecich",
		portfolioText:
			"Na stronie mogą pojawiać się przykłady projektów, produktów, technologii oraz marek podmiotów trzecich w celach informacyjnych lub portfolio. Prawa do nazw, znaków, zrzutów ekranu, treści i innych materiałów podmiotów trzecich pozostają przy ich właścicielach. Zasady publikacji materiałów klientów i prawa własności intelektualnej wynikają z odpowiedniej umowy lub udzielonej zgody.",

		informationTitle: "Treści edukacyjne i informacyjne",
		informationText:
			"Artykuły, wyjaśnienia techniczne, przykłady i pozostałe materiały edukacyjne są udostępniane w celach informacyjnych i edukacyjnych. Nie należy traktować ich jako porady prawnej, finansowej, podatkowej, medycznej ani innej regulowanej porady profesjonalnej. Informacje techniczne mogą również tracić aktualność wraz ze zmianami technologii i standardów.",

		linksTitle: "Strony podmiotów trzecich",
		linksText:
			"Serwis może zawierać odnośniki do stron lub usług podmiotów trzecich. CCS nie kontroluje tych usług i nie odpowiada za ich treść, dostępność, bezpieczeństwo ani praktyki dotyczące prywatności. Samo umieszczenie linku nie musi oznaczać rekomendacji danego podmiotu.",

		availabilityTitle: "Dostępność serwisu",
		availabilityText:
			"Dążymy do tego, aby strona była dokładna, bezpieczna i dostępna, ale nie gwarantujemy nieprzerwanego ani całkowicie bezbłędnego działania. Możemy zmieniać, czasowo ograniczać lub usuwać części strony, gdy jest to rozsądnie potrzebne, między innymi ze względów technicznych, bezpieczeństwa lub dalszego rozwoju.",

		liabilityTitle: "Odpowiedzialność",
		liabilityText:
			"Żadne postanowienie tych warunków nie wyłącza ani nie ogranicza odpowiedzialności w zakresie, w którym byłoby to niezgodne z prawem. Z zastrzeżeniem tych ograniczeń CCS nie odpowiada za straty wynikające wyłącznie z polegania na ogólnych informacjach zamieszczonych na stronie, jeżeli w danych okolicznościach rozsądnie wymagane byłoby uzyskanie indywidualnej oceny lub profesjonalnej porady.",
		liabilityText2:
			"Jeżeli korzystasz ze strony jako konsument, żadne postanowienie niniejszych warunków nie ogranicza obowiązkowych praw konsumenckich przysługujących Ci na podstawie właściwych przepisów.",

		changesTitle: "Zmiany serwisu i warunków",
		changesText:
			"Możemy aktualizować stronę i niniejsze warunki wraz ze zmianami usług, technologii lub wymagań prawnych. Aktualna wersja będzie publikowana na tej stronie. Zmiany nie modyfikują wstecznie osobnej umowy zawartej z klientem, chyba że dana umowa wyraźnie na to pozwala.",

		lawTitle: "Prawo właściwe",
		lawText:
			"Niniejsze warunki korzystania ze strony są przeznaczone do stosowania zgodnie z prawem właściwym dla podmiotu prowadzącego CCS w Wielkiej Brytanii. Żadne ich postanowienie nie ma na celu pozbawienia użytkownika obowiązkowych praw lub ochrony wynikających z właściwego prawa konsumenckiego lub innych przepisów.",

		contactTitle: "Kontakt",
		contactText:
			"Jeśli masz pytania dotyczące Warunków korzystania z serwisu, skontaktuj się z Code Consulting Studio za pomocą danych dostępnych na stronie Kontakt.",
	},
};

export function TermsPage({ locale }: { locale: Locale }) {
	const t = COPY[locale];

	return (
		<main>
			<PageHero eyebrow={t.heroEyebrow} title={t.heroTitle} />

			<section className="tight">
				<div className="wrap prose">
					<LegalNotice locale={locale} />

					<p className="prose-meta">{t.meta}</p>

					<h2>{t.aboutTitle}</h2>
					<p>{t.aboutText}</p>

					<h2>{t.useTitle}</h2>
					<p>{t.useText}</p>

					<h2>{t.prohibitedTitle}</h2>
					<ul>
						{t.prohibitedItems.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>

					<h2>{t.enquiriesTitle}</h2>
					<p>{t.enquiriesText}</p>

					<h2>{t.estimatesTitle}</h2>
					<p>{t.estimatesText}</p>

					<h2>{t.ipTitle}</h2>
					<p>{t.ipText}</p>
					<p>{t.ipText2}</p>

					<h2>{t.portfolioTitle}</h2>
					<p>{t.portfolioText}</p>

					<h2>{t.informationTitle}</h2>
					<p>{t.informationText}</p>

					<h2>{t.linksTitle}</h2>
					<p>{t.linksText}</p>

					<h2>{t.availabilityTitle}</h2>
					<p>{t.availabilityText}</p>

					<h2>{t.liabilityTitle}</h2>
					<p>{t.liabilityText}</p>
					<p>{t.liabilityText2}</p>

					<h2>{t.changesTitle}</h2>
					<p>{t.changesText}</p>

					<h2>{t.lawTitle}</h2>
					<p>{t.lawText}</p>

					<h2>{t.contactTitle}</h2>
					<p>{t.contactText}</p>
				</div>
			</section>
		</main>
	);
}
