import { PageHero } from "@/components/PageHero";

import { LegalNotice } from "./LegalNotice";

import type { Locale } from "@/lib/routes";

const COPY = {
	en: {
		heroEyebrow: "Privacy",
		heroTitle: "Privacy Notice",

		meta: "Last updated: 30 August 2026 · Version 2026-08-3",

		whoTitle: "Who we are",
		whoText:
			'Code Consulting Studio ("CCS", "we", "us") operates this website and provides software development, digital growth and mentoring services. For personal information collected directly through this website, the operator of CCS is responsible for determining how and why that information is used. Current contact details are available on the Contact page.',
		whoProcessorText:
			"Where CCS processes personal information on behalf of a client as part of a contracted service, CCS may act as a processor rather than a controller. Those responsibilities are dealt with separately in the relevant client agreement and, where required, a data processing agreement.",

		collectTitle: "What information we collect",
		collectIntro:
			"We aim to collect only information that is reasonably necessary to understand your request, communicate with you and provide the services you ask us about.",

		table: {
			form: "Context",
			data: "Information we may collect",
			why: "Purpose",
			rows: [
				{
					form: "Project enquiry",
					data: "Name, email address, optional company, project stage, type of support required, optional budget range and your message",
					why: "To understand your project, assess how we may be able to help and respond to your enquiry",
				},
				{
					form: "Growth enquiry",
					data: "Name, email address, optional company, areas of interest, preferred type of engagement and your message",
					why: "To understand your marketing or growth requirements and discuss suitable services",
				},
				{
					form: "Mentoring enquiry",
					data: "Name, email address, learning area, experience level, goals and, where appropriate for a learner under 18, parent or guardian contact details",
					why: "To understand learning needs, arrange suitable mentoring and involve a parent or guardian where appropriate",
				},
				{
					form: "General contact",
					data: "Contact details and any information you choose to include in your message",
					why: "To respond to your question or request",
				},
			],
		},

		sensitiveText:
			"Please do not submit passwords, payment card details, health information or other sensitive personal information through our general public forms unless we specifically ask for particular information through an appropriate channel. Sending an enquiry does not automatically subscribe you to marketing communications.",

		useTitle: "How we use your information",
		useItems: [
			"Respond to enquiries and communicate with you",
			"Understand your requirements and discuss suitable services",
			"Take steps requested by you before entering into an agreement",
			"Provide and administer services where an agreement is in place",
			"Maintain appropriate operational, accounting and security records",
			"Protect the website, our systems and our legitimate business interests",
			"Improve our website and services where we have an appropriate legal basis to do so",
			"Comply with applicable legal and regulatory obligations",
		],

		basisTitle: "Legal bases for processing",
		basisIntro:
			"We process personal information only where we have an appropriate legal basis. The basis depends on why the information is being used.",

		basisTable: {
			purpose: "Purpose",
			basis: "Typical legal basis",
			rows: [
				{
					purpose: "Responding to enquiries and discussing potential work",
					basis:
						"Taking steps at your request before entering into a contract and, where appropriate, our legitimate interests in responding to genuine enquiries",
				},
				{
					purpose: "Providing an agreed service",
					basis:
						"Performance of a contract or taking steps connected with that contract",
				},
				{
					purpose: "Business, security and fraud-prevention records",
					basis:
						"Our legitimate interests in operating and protecting CCS, provided those interests are not overridden by your rights",
				},
				{
					purpose: "Accounting, tax and other mandatory records",
					basis: "Compliance with a legal obligation",
				},
				{
					purpose: "Optional analytics technologies",
					basis: "Consent where consent is required",
				},
				{
					purpose: "Optional marketing communications",
					basis:
						"Consent or another lawful basis permitted by applicable data protection and electronic communications law",
				},
			],
		},

		lawText:
			"Our handling of personal information is intended to comply with applicable UK data protection law, including the UK GDPR and the Data Protection Act 2018. Rules relating to cookies and similar technologies are also governed by the Privacy and Electronic Communications Regulations (PECR). Where another data protection regime applies to a particular person or service, we aim to comply with the obligations that apply in that context.",

		analyticsTitle: "Analytics and cookies",
		analyticsText:
			'We use Google Analytics 4 only where the relevant analytics preference permits it. Optional analytics technologies are not intended to be activated before the required consent has been given. Rejecting optional analytics does not prevent normal use of the website. You can change your choice through "Manage preferences". More information is available in our Cookie & Storage Policy.',

		sharingTitle: "Who we may share information with",
		sharingText:
			"We may use trusted service providers to operate our website and deliver our services, including hosting, infrastructure, email and analytics providers. Where a provider processes personal information on our behalf, we aim to provide only the information necessary for the relevant purpose and to use appropriate contractual and security safeguards.",
		sharingText2:
			"We may also disclose information where required by law, to professional advisers where reasonably necessary, or where necessary to establish, exercise or defend legal rights. We do not sell personal information.",

		transfersTitle: "International data transfers",
		transfersText:
			"Some technology or service providers may process information outside the United Kingdom. Where personal information is transferred internationally, we aim to use a transfer mechanism and safeguards required by applicable data protection law. The exact arrangements depend on the provider and service in use at the relevant time.",

		retentionTitle: "How long we keep information",
		retentionText:
			"We keep personal information only for as long as reasonably necessary for the purpose for which it was collected and for any applicable contractual, accounting, tax, security or legal requirements. Enquiries that do not lead to an ongoing relationship are retained only for an appropriate period to allow us to respond and manage reasonable follow-up. Records connected with an actual service or client relationship may need to be retained for longer.",
		retentionText2:
			"Where no fixed retention period is stated, we consider the purpose of the information, whether it remains necessary, the sensitivity of the information and any legal or contractual record-keeping requirements.",

		childrenTitle: "Children and mentoring",
		childrenText:
			"Some mentoring enquiries may relate to learners under 18. Where appropriate, CCS may require the involvement and contact details of a parent or guardian before arranging a service. We aim to collect only the information necessary for the enquiry, communication and safe delivery of the mentoring service.",

		securityTitle: "Security",
		securityText:
			"We use reasonable technical and organisational measures designed to protect personal information against unauthorised access, loss, misuse, alteration or disclosure. No website or internet transmission can be guaranteed to be completely secure, so please avoid sending sensitive information through general contact forms unless specifically requested.",

		rightsTitle: "Your data protection rights",
		rightsIntro:
			"Depending on the circumstances and the legal basis used, you may have rights including:",
		rights: [
			"Access to personal information we hold about you",
			"Correction of inaccurate or incomplete information",
			"Deletion of personal information in circumstances where the right to erasure applies",
			"Restriction of processing in circumstances where that right applies",
			"Objection to certain processing, including processing based on legitimate interests",
			"Data portability where the relevant legal conditions are met",
			"Withdrawal of consent at any time where processing relies on consent",
		],
		rightsNote:
			"These rights are not absolute and do not all apply in every situation. Withdrawing consent does not affect processing that was lawful before consent was withdrawn.",

		objectionTitle: "Your right to object",
		objectionText:
			"Where we rely on legitimate interests to process your personal information, you may have the right to object to that processing. If you object, we will consider your circumstances and whether there are compelling legitimate grounds for the processing to continue.",

		complaintTitle: "Complaints",
		complaintText:
			"If you are concerned about how we handle your personal information, please contact us first so that we can review the issue. You also have the right to raise a complaint with the UK Information Commissioner's Office (ICO) where UK data protection law applies.",

		automatedTitle: "Automated decision-making",
		automatedText:
			"We do not currently use information submitted through the public CCS enquiry forms to make solely automated decisions that produce legal or similarly significant effects about you.",

		changesTitle: "Changes to this notice",
		changesText:
			"We may update this Privacy Notice when our services, technology, providers, processing activities or legal obligations change. The latest version will be published on this page with an updated date and version number.",

		contactTitle: "Contact",
		contactText:
			"If you have questions about this Privacy Notice, want to exercise a data protection right or have concerns about how your information is handled, please contact Code Consulting Studio using the details provided on the Contact page.",
	},

	pl: {
		heroEyebrow: "Prywatność",
		heroTitle: "Polityka prywatności",

		meta: "Ostatnia aktualizacja: 30 sierpnia 2026 · Wersja 2026-08-3",

		whoTitle: "Kim jesteśmy",
		whoText:
			'Code Consulting Studio ("CCS", "my", "nas") prowadzi tę stronę internetową i świadczy usługi związane z tworzeniem oprogramowania, rozwojem online oraz mentoringiem. W odniesieniu do danych osobowych zbieranych bezpośrednio za pośrednictwem tej strony podmiot prowadzący CCS odpowiada za określenie celów i sposobów ich przetwarzania. Aktualne dane kontaktowe są dostępne na stronie Kontakt.',
		whoProcessorText:
			"Jeżeli CCS przetwarza dane osobowe w imieniu klienta w ramach uzgodnionej usługi, może występować jako podmiot przetwarzający, a nie administrator danych. Odpowiednie obowiązki są wówczas regulowane osobno w umowie z klientem oraz, jeśli jest to wymagane, w umowie powierzenia przetwarzania danych.",

		collectTitle: "Jakie informacje zbieramy",
		collectIntro:
			"Dążymy do zbierania wyłącznie informacji, które są rozsądnie potrzebne do zrozumienia Twojej potrzeby, komunikacji z Tobą i świadczenia usług, o które pytasz.",

		table: {
			form: "Kontekst",
			data: "Informacje, które możemy zbierać",
			why: "Cel",
			rows: [
				{
					form: "Zapytanie o projekt",
					data: "Imię i nazwisko, adres email, opcjonalnie firma, etap projektu, rodzaj potrzebnego wsparcia, opcjonalny zakres budżetu oraz wiadomość",
					why: "Aby zrozumieć Twój projekt, ocenić, w jaki sposób możemy pomóc, i odpowiedzieć na zapytanie",
				},
				{
					form: "Zapytanie o marketing",
					data: "Imię i nazwisko, adres email, opcjonalnie firma, obszary zainteresowania, preferowana forma współpracy oraz wiadomość",
					why: "Aby poznać Twoje potrzeby związane z marketingiem lub rozwojem online i omówić odpowiednie usługi",
				},
				{
					form: "Zapytanie o mentoring",
					data: "Imię i nazwisko, adres email, obszar nauki, poziom doświadczenia, cele oraz, gdy jest to odpowiednie w przypadku osoby poniżej 18 lat, dane kontaktowe rodzica lub opiekuna",
					why: "Aby poznać potrzeby związane z nauką, dobrać odpowiedni mentoring i zaangażować rodzica lub opiekuna, gdy jest to właściwe",
				},
				{
					form: "Kontakt ogólny",
					data: "Dane kontaktowe oraz informacje, które zdecydujesz się umieścić w wiadomości",
					why: "Aby odpowiedzieć na Twoje pytanie lub prośbę",
				},
			],
		},

		sensitiveText:
			"Prosimy, aby nie przesyłać przez ogólnodostępne formularze haseł, danych kart płatniczych, informacji o zdrowiu ani innych wrażliwych danych osobowych, chyba że wyraźnie poprosimy o przekazanie konkretnych informacji odpowiednim kanałem. Wysłanie zapytania nie oznacza automatycznego zapisania się na komunikację marketingową.",

		useTitle: "Jak wykorzystujemy Twoje informacje",
		useItems: [
			"Odpowiadanie na zapytania i komunikacja z Tobą",
			"Poznanie Twoich potrzeb i omawianie odpowiednich usług",
			"Podejmowanie działań na Twoją prośbę przed zawarciem umowy",
			"Świadczenie i obsługa uzgodnionych usług",
			"Prowadzenie odpowiedniej dokumentacji operacyjnej, księgowej i dotyczącej bezpieczeństwa",
			"Ochrona strony, naszych systemów i uzasadnionych interesów biznesowych",
			"Ulepszanie strony i usług, gdy posiadamy odpowiednią podstawę prawną",
			"Wypełnianie obowiązków prawnych i regulacyjnych",
		],

		basisTitle: "Podstawy prawne przetwarzania",
		basisIntro:
			"Przetwarzamy dane osobowe wyłącznie wtedy, gdy istnieje odpowiednia podstawa prawna. Zależy ona od celu, w jakim dane są wykorzystywane.",

		basisTable: {
			purpose: "Cel",
			basis: "Typowa podstawa prawna",
			rows: [
				{
					purpose:
						"Odpowiadanie na zapytania i omawianie potencjalnej współpracy",
					basis:
						"Działania podejmowane na Twoje żądanie przed zawarciem umowy oraz, w odpowiednich przypadkach, nasz uzasadniony interes polegający na obsłudze rzeczywistych zapytań",
				},
				{
					purpose: "Realizacja uzgodnionej usługi",
					basis:
						"Wykonanie umowy lub podjęcie działań związanych z jej zawarciem",
				},
				{
					purpose:
						"Dokumentacja biznesowa, bezpieczeństwo i zapobieganie nadużyciom",
					basis:
						"Nasz uzasadniony interes w prowadzeniu i ochronie CCS, o ile nie jest nadrzędny wobec Twoich praw i interesów",
				},
				{
					purpose: "Dokumentacja księgowa, podatkowa i obowiązkowa",
					basis: "Wypełnienie obowiązku prawnego",
				},
				{
					purpose: "Opcjonalna analityka",
					basis: "Zgoda, gdy jest wymagana",
				},
				{
					purpose: "Opcjonalna komunikacja marketingowa",
					basis:
						"Zgoda lub inna podstawa dozwolona przez właściwe przepisy dotyczące ochrony danych i komunikacji elektronicznej",
				},
			],
		},

		lawText:
			"Nasze zasady przetwarzania danych są tworzone z uwzględnieniem obowiązujących w Wielkiej Brytanii przepisów o ochronie danych, w tym UK GDPR oraz Data Protection Act 2018. Korzystanie z cookies i podobnych technologii podlega również Privacy and Electronic Communications Regulations (PECR). Jeżeli w konkretnym przypadku zastosowanie ma inny system ochrony danych, dążymy do przestrzegania obowiązków właściwych dla tej sytuacji.",

		analyticsTitle: "Analityka i cookies",
		analyticsText:
			'Korzystamy z Google Analytics 4 tylko wtedy, gdy pozwalają na to odpowiednie preferencje dotyczące analityki. Opcjonalne technologie analityczne nie powinny być uruchamiane przed uzyskaniem wymaganej zgody. Odrzucenie opcjonalnej analityki nie ogranicza normalnego korzystania ze strony. Swoją decyzję możesz zmienić poprzez opcję "Zarządzaj preferencjami". Więcej informacji znajdziesz w naszej Polityce cookies i przechowywania danych.',

		sharingTitle: "Komu możemy przekazywać informacje",
		sharingText:
			"Możemy korzystać z zaufanych dostawców usług potrzebnych do działania strony i świadczenia naszych usług, w tym dostawców hostingu, infrastruktury, poczty elektronicznej i analityki. Jeżeli dostawca przetwarza dane osobowe w naszym imieniu, dążymy do przekazywania mu wyłącznie informacji niezbędnych do danego celu oraz stosowania odpowiednich zabezpieczeń umownych i technicznych.",
		sharingText2:
			"Możemy również ujawnić informacje, jeżeli wymagają tego przepisy prawa, profesjonalnym doradcom, gdy jest to rozsądnie konieczne, albo w celu ustalenia, dochodzenia lub obrony roszczeń. Nie sprzedajemy danych osobowych.",

		transfersTitle: "Międzynarodowe przekazywanie danych",
		transfersText:
			"Niektórzy dostawcy technologii lub usług mogą przetwarzać informacje poza Wielką Brytanią. Jeżeli dane osobowe są przekazywane za granicę, dążymy do stosowania mechanizmów transferu i zabezpieczeń wymaganych przez obowiązujące przepisy o ochronie danych. Dokładne rozwiązanie zależy od dostawcy i usługi używanej w danym czasie.",

		retentionTitle: "Jak długo przechowujemy informacje",
		retentionText:
			"Przechowujemy dane osobowe tylko tak długo, jak jest to rozsądnie potrzebne do celu, w którym zostały zebrane, oraz przez okres wymagany ze względów umownych, księgowych, podatkowych, bezpieczeństwa lub prawnych. Zapytania, które nie prowadzą do dalszej współpracy, przechowujemy tylko przez odpowiedni okres potrzebny do udzielenia odpowiedzi i obsługi uzasadnionego dalszego kontaktu. Dokumentacja związana z rzeczywistą usługą lub relacją z klientem może wymagać dłuższego przechowywania.",
		retentionText2:
			"Jeżeli nie określono stałego okresu przechowywania, bierzemy pod uwagę cel przetwarzania, dalszą potrzebę posiadania informacji, ich charakter i wrażliwość oraz obowiązujące wymagania prawne lub umowne dotyczące dokumentacji.",

		childrenTitle: "Osoby niepełnoletnie i mentoring",
		childrenText:
			"Niektóre zapytania dotyczące mentoringu mogą odnosić się do osób poniżej 18 roku życia. W odpowiednich przypadkach CCS może wymagać udziału oraz danych kontaktowych rodzica lub opiekuna przed zorganizowaniem usługi. Dążymy do zbierania wyłącznie informacji niezbędnych do obsługi zapytania, komunikacji i bezpiecznej realizacji mentoringu.",

		securityTitle: "Bezpieczeństwo",
		securityText:
			"Stosujemy rozsądne środki techniczne i organizacyjne mające chronić dane osobowe przed nieuprawnionym dostępem, utratą, niewłaściwym wykorzystaniem, zmianą lub ujawnieniem. Żadna strona internetowa ani transmisja internetowa nie może zagwarantować całkowitego bezpieczeństwa, dlatego prosimy, aby nie przesyłać wrażliwych informacji przez ogólne formularze, chyba że zostaniesz o to wyraźnie poproszony.",

		rightsTitle: "Twoje prawa dotyczące ochrony danych",
		rightsIntro:
			"W zależności od okoliczności i podstawy prawnej mogą przysługiwać Ci między innymi następujące prawa:",
		rights: [
			"Dostęp do danych osobowych, które przechowujemy na Twój temat",
			"Poprawienie nieprawidłowych lub niekompletnych informacji",
			"Usunięcie danych w przypadkach, w których ma zastosowanie prawo do usunięcia",
			"Ograniczenie przetwarzania, gdy spełnione są odpowiednie warunki",
			"Sprzeciw wobec określonych sposobów przetwarzania, w tym przetwarzania opartego na uzasadnionym interesie",
			"Przeniesienie danych, jeżeli spełnione są odpowiednie warunki prawne",
			"Wycofanie zgody w dowolnym momencie, jeżeli przetwarzanie opiera się na zgodzie",
		],
		rightsNote:
			"Prawa te nie są bezwzględne i nie wszystkie mają zastosowanie w każdej sytuacji. Wycofanie zgody nie wpływa na zgodność z prawem przetwarzania dokonanego przed jej wycofaniem.",

		objectionTitle: "Prawo do sprzeciwu",
		objectionText:
			"Jeżeli opieramy przetwarzanie danych na uzasadnionym interesie, możesz mieć prawo wnieść sprzeciw wobec takiego przetwarzania. Po otrzymaniu sprzeciwu rozpatrzymy Twoją sytuację oraz to, czy istnieją nadrzędne uzasadnione podstawy do dalszego przetwarzania.",

		complaintTitle: "Skargi",
		complaintText:
			"Jeżeli masz zastrzeżenia dotyczące sposobu przetwarzania Twoich danych, prosimy najpierw o kontakt z nami, abyśmy mogli przeanalizować sprawę. Jeżeli zastosowanie ma brytyjskie prawo ochrony danych, masz również prawo złożyć skargę do brytyjskiego Information Commissioner's Office (ICO).",

		automatedTitle: "Zautomatyzowane podejmowanie decyzji",
		automatedText:
			"Obecnie nie wykorzystujemy informacji przesyłanych przez publiczne formularze CCS do podejmowania wyłącznie zautomatyzowanych decyzji wywołujących wobec Ciebie skutki prawne lub podobnie istotne skutki.",

		changesTitle: "Zmiany w tej polityce",
		changesText:
			"Możemy aktualizować tę Politykę prywatności, gdy zmieniają się nasze usługi, technologie, dostawcy, sposoby przetwarzania danych lub obowiązki prawne. Najnowsza wersja będzie publikowana na tej stronie wraz z aktualną datą i numerem wersji.",

		contactTitle: "Kontakt",
		contactText:
			"Jeśli masz pytania dotyczące tej Polityki prywatności, chcesz skorzystać ze swoich praw dotyczących ochrony danych lub masz zastrzeżenia dotyczące sposobu przetwarzania Twoich informacji, skontaktuj się z Code Consulting Studio za pomocą danych dostępnych na stronie Kontakt.",
	},
};

export function PrivacyPolicy({ locale }: { locale: Locale }) {
	const t = COPY[locale];

	return (
		<main>
			<PageHero eyebrow={t.heroEyebrow} title={t.heroTitle} />

			<section className="tight">
				<div className="wrap prose">
					<LegalNotice locale={locale} />

					<p className="prose-meta">{t.meta}</p>

					<h2>{t.whoTitle}</h2>
					<p>{t.whoText}</p>
					<p>{t.whoProcessorText}</p>

					<h2>{t.collectTitle}</h2>
					<p>{t.collectIntro}</p>

					<table>
						<thead>
							<tr>
								<th>{t.table.form}</th>
								<th>{t.table.data}</th>
								<th>{t.table.why}</th>
							</tr>
						</thead>

						<tbody>
							{t.table.rows.map((row) => (
								<tr key={row.form}>
									<td>{row.form}</td>
									<td>{row.data}</td>
									<td>{row.why}</td>
								</tr>
							))}
						</tbody>
					</table>

					<p>{t.sensitiveText}</p>

					<h2>{t.useTitle}</h2>
					<ul>
						{t.useItems.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>

					<h2>{t.basisTitle}</h2>
					<p>{t.basisIntro}</p>

					<table>
						<thead>
							<tr>
								<th>{t.basisTable.purpose}</th>
								<th>{t.basisTable.basis}</th>
							</tr>
						</thead>

						<tbody>
							{t.basisTable.rows.map((row) => (
								<tr key={row.purpose}>
									<td>{row.purpose}</td>
									<td>{row.basis}</td>
								</tr>
							))}
						</tbody>
					</table>

					<p>{t.lawText}</p>

					<h2>{t.analyticsTitle}</h2>
					<p>{t.analyticsText}</p>

					<h2>{t.sharingTitle}</h2>
					<p>{t.sharingText}</p>
					<p>{t.sharingText2}</p>

					<h2>{t.transfersTitle}</h2>
					<p>{t.transfersText}</p>

					<h2>{t.retentionTitle}</h2>
					<p>{t.retentionText}</p>
					<p>{t.retentionText2}</p>

					<h2>{t.childrenTitle}</h2>
					<p>{t.childrenText}</p>

					<h2>{t.securityTitle}</h2>
					<p>{t.securityText}</p>

					<h2>{t.rightsTitle}</h2>
					<p>{t.rightsIntro}</p>

					<ul>
						{t.rights.map((right) => (
							<li key={right}>{right}</li>
						))}
					</ul>

					<p>{t.rightsNote}</p>

					<h2>{t.objectionTitle}</h2>
					<p>{t.objectionText}</p>

					<h2>{t.complaintTitle}</h2>
					<p>{t.complaintText}</p>

					<h2>{t.automatedTitle}</h2>
					<p>{t.automatedText}</p>

					<h2>{t.changesTitle}</h2>
					<p>{t.changesText}</p>

					<h2>{t.contactTitle}</h2>
					<p>{t.contactText}</p>
				</div>
			</section>
		</main>
	);
}
