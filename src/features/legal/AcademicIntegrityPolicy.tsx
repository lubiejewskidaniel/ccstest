import { PageHero } from "@/components/PageHero";

import { LegalNotice } from "./LegalNotice";

import type { Locale } from "@/lib/routes";

const COPY = {
	en: {
		heroEyebrow: "Academic integrity",
		heroTitle: "Academic Integrity Policy",

		meta: "Last updated: 30 August 2026 · Version 2026-08-3",

		purposeTitle: "Purpose of this policy",
		purposeText:
			"CCS mentoring is intended to support genuine learning, understanding and independent skill development. This policy explains the boundary between legitimate educational support and work that must remain the learner's own responsibility.",

		mentoringTitle: "What mentoring is",
		mentoringText:
			"Mentoring can explain concepts, demonstrate techniques, discuss possible approaches, review work created by the learner and help identify errors or areas for improvement. The aim is to help you understand how to solve problems independently.",

		allowedTitle: "Examples of support we can provide",
		allowedItems: [
			"Explaining programming, software engineering, DevOps and related technical concepts",
			"Working through practice examples that are not being submitted as assessed work",
			"Helping you understand errors and debug your own code",
			"Reviewing learner-created work and providing feedback",
			"Discussing alternative approaches and design decisions",
			"Helping you understand assignment requirements without completing the assessed task for you",
			"Preparing for interviews, technical discussions or non-assessed practice",
			"Discussing responsible use of AI and other development tools",
		],

		notTitle: "What mentoring is not",
		notItems: [
			"Writing or completing an assessed assignment, dissertation, examination or coursework on a learner's behalf",
			"Producing work intended to be submitted as if it were created independently by the learner",
			"Completing a live examination, test or other controlled assessment",
			"Impersonating a learner in an academic system, assessment or communication",
			"Submitting academic work on another person's behalf",
			"Helping conceal plagiarism, contract cheating or another breach of academic integrity rules",
			"Helping bypass controls where the purpose is to misrepresent the authorship or originality of assessed work",
		],

		lawTitle: "Academic integrity and the law",
		lawText:
			"CCS does not provide commercial contract-cheating services. In England, legislation prohibits certain commercial services that complete or arrange completion of relevant academic work for post-16 students where the statutory conditions are met. Our mentoring model is designed around teaching, explanation, review and skills development rather than producing assessed work for submission.",

		aiTitle: "AI tools and assessed work",
		aiText:
			"AI tools can be useful for learning, development and experimentation, but educational institutions set their own rules about when and how they may be used in assessed work. We will not help a learner use AI to disguise prohibited assistance, fabricate authorship or circumvent an institution's academic integrity requirements.",
		aiText2:
			"Where your institution has specific rules for AI use, those rules take priority for your assessed work. If you are unsure, we may help you interpret the technical or learning implications, but responsibility for complying with your institution's rules remains with you.",

		minorsTitle: "Learners under 18",
		minorsText:
			"Where a learner is under 18, CCS may require a parent or guardian to be involved in the enquiry and communication process before mentoring is arranged. Sessions should be organised in a way that is appropriate to the learner's age and circumstances, with safeguarding and privacy in mind.",

		responsibilityTitle: "Your responsibility",
		responsibilityText:
			"You remain responsible for ensuring that work submitted to a school, college, university, certification provider or other assessment body complies with its rules. Receiving mentoring from CCS does not replace your responsibility to follow those requirements and accurately represent your own contribution.",

		boundariesTitle: "If a request crosses the boundary",
		boundariesText:
			"If a request appears to involve prohibited academic assistance, we may refuse that part of the request. Where possible, we will redirect the session toward legitimate learning - for example by explaining the underlying concept, creating a separate practice example or reviewing work you have already produced yourself.",

		changesTitle: "Changes to this policy",
		changesText:
			"We may update this policy as mentoring services develop or when relevant educational practices, institutional expectations or legal requirements change.",

		contactTitle: "Questions",
		contactText:
			"If you are unsure whether the type of support you need is appropriate, contact CCS before a session or explain the situation in your mentoring enquiry.",
	},

	pl: {
		heroEyebrow: "Rzetelność akademicka",
		heroTitle: "Polityka rzetelności akademickiej",

		meta: "Ostatnia aktualizacja: 30 sierpnia 2026 · Wersja 2026-08-3",

		purposeTitle: "Cel tej polityki",
		purposeText:
			"Mentoring CCS ma wspierać rzeczywistą naukę, zrozumienie zagadnień i samodzielny rozwój umiejętności. Niniejsza polityka określa granicę pomiędzy dozwolonym wsparciem edukacyjnym a pracą, która musi pozostać samodzielnym obowiązkiem osoby uczącej się.",

		mentoringTitle: "Czym jest mentoring",
		mentoringText:
			"W ramach mentoringu możemy wyjaśniać zagadnienia, prezentować techniki, omawiać możliwe podejścia, analizować pracę wykonaną przez osobę uczącą się oraz pomagać w znajdowaniu błędów i obszarów wymagających poprawy. Celem jest pomoc w zrozumieniu sposobu samodzielnego rozwiązywania problemów.",

		allowedTitle: "Przykłady dozwolonego wsparcia",
		allowedItems: [
			"Wyjaśnianie zagadnień z programowania, inżynierii oprogramowania, DevOps i pokrewnych obszarów technicznych",
			"Praca na przykładach ćwiczeniowych, które nie są przeznaczone do oddania jako praca oceniana",
			"Pomoc w zrozumieniu błędów i debugowaniu własnego kodu",
			"Przegląd pracy stworzonej przez osobę uczącą się i udzielanie informacji zwrotnej",
			"Omawianie alternatywnych podejść i decyzji projektowych",
			"Pomoc w zrozumieniu wymagań zadania bez wykonywania ocenianej pracy za osobę uczącą się",
			"Przygotowanie do rozmów rekrutacyjnych, dyskusji technicznych lub nieocenianych ćwiczeń",
			"Omawianie odpowiedzialnego korzystania z AI i innych narzędzi developerskich",
		],

		notTitle: "Czym mentoring nie jest",
		notItems: [
			"Pisaniem lub wykonywaniem ocenianego zadania, pracy dyplomowej, egzaminu lub coursework w imieniu osoby uczącej się",
			"Tworzeniem pracy przeznaczonej do oddania w sposób sugerujący, że została wykonana samodzielnie przez ucznia lub studenta",
			"Rozwiązywaniem trwającego egzaminu, testu lub innej kontrolowanej formy oceny",
			"Podszywaniem się pod osobę uczącą się w systemie akademickim, podczas oceny lub w komunikacji",
			"Przesyłaniem pracy akademickiej w imieniu innej osoby",
			"Pomaganiem w ukrywaniu plagiatu, contract cheating lub innych naruszeń zasad rzetelności akademickiej",
			"Pomaganiem w obchodzeniu zabezpieczeń w celu fałszywego przedstawienia autorstwa lub oryginalności ocenianej pracy",
		],

		lawTitle: "Rzetelność akademicka i prawo",
		lawText:
			"CCS nie świadczy komercyjnych usług polegających na wykonywaniu ocenianych prac za studentów. W Anglii przepisy zakazują określonych komercyjnych usług polegających na wykonywaniu lub organizowaniu wykonania określonych prac akademickich dla osób uczących się po ukończeniu obowiązkowego etapu edukacji, jeżeli spełnione są warunki przewidziane w ustawie. Model mentoringu CCS opiera się na nauczaniu, wyjaśnianiu, recenzowaniu i rozwijaniu umiejętności, a nie na tworzeniu ocenianych prac do oddania.",

		aiTitle: "Narzędzia AI i prace oceniane",
		aiText:
			"Narzędzia AI mogą być wartościowym wsparciem w nauce, programowaniu i eksperymentowaniu, jednak szkoły i uczelnie ustalają własne zasady ich używania w pracach ocenianych. Nie pomagamy wykorzystywać AI do ukrywania niedozwolonej pomocy, fałszywego przedstawiania autorstwa ani obchodzenia zasad rzetelności akademickiej.",
		aiText2:
			"Jeżeli Twoja szkoła lub uczelnia posiada szczegółowe zasady korzystania z AI, mają one pierwszeństwo w odniesieniu do Twojej pracy ocenianej. Możemy pomóc Ci zrozumieć techniczne lub edukacyjne konsekwencje tych zasad, ale odpowiedzialność za ich przestrzeganie pozostaje po Twojej stronie.",

		minorsTitle: "Osoby poniżej 18 roku życia",
		minorsText:
			"Jeżeli osoba ucząca się ma mniej niż 18 lat, CCS może wymagać udziału rodzica lub opiekuna w procesie zapytania i komunikacji przed zorganizowaniem mentoringu. Sesje powinny być organizowane w sposób odpowiedni do wieku i sytuacji uczestnika, z uwzględnieniem bezpieczeństwa i prywatności.",

		responsibilityTitle: "Twoja odpowiedzialność",
		responsibilityText:
			"To Ty odpowiadasz za to, aby prace przekazywane szkole, uczelni, organizacji certyfikującej lub innemu podmiotowi oceniającemu były zgodne z jego zasadami. Korzystanie z mentoringu CCS nie zastępuje obowiązku przestrzegania tych wymagań ani prawidłowego przedstawienia własnego wkładu w pracę.",

		boundariesTitle: "Jeżeli prośba przekracza dozwoloną granicę",
		boundariesText:
			"Jeżeli uznamy, że prośba może oznaczać niedozwoloną pomoc akademicką, możemy odmówić realizacji tej części. Tam, gdzie jest to możliwe, przekierujemy sesję na dozwoloną naukę - na przykład wyjaśnienie koncepcji, przygotowanie osobnego przykładu ćwiczeniowego albo omówienie pracy, którą wykonałeś samodzielnie.",

		changesTitle: "Zmiany w tej polityce",
		changesText:
			"Możemy aktualizować tę politykę wraz z rozwojem usług mentoringowych oraz zmianami praktyk edukacyjnych, wymagań instytucji lub właściwych przepisów.",

		contactTitle: "Pytania",
		contactText:
			"Jeżeli nie masz pewności, czy potrzebny Ci rodzaj wsparcia mieści się w zakresie mentoringu CCS, skontaktuj się z nami przed sesją lub opisz sytuację w formularzu zapytania o mentoring.",
	},
};

export function AcademicIntegrityPolicy({ locale }: { locale: Locale }) {
	const t = COPY[locale];

	return (
		<main>
			<PageHero eyebrow={t.heroEyebrow} title={t.heroTitle} />

			<section className="tight">
				<div className="wrap prose">
					<LegalNotice locale={locale} />

					<p className="prose-meta">{t.meta}</p>

					<h2>{t.purposeTitle}</h2>
					<p>{t.purposeText}</p>

					<h2>{t.mentoringTitle}</h2>
					<p>{t.mentoringText}</p>

					<h2>{t.allowedTitle}</h2>
					<ul>
						{t.allowedItems.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>

					<h2>{t.notTitle}</h2>
					<ul>
						{t.notItems.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>

					<h2>{t.lawTitle}</h2>
					<p>{t.lawText}</p>

					<h2>{t.aiTitle}</h2>
					<p>{t.aiText}</p>
					<p>{t.aiText2}</p>

					<h2>{t.minorsTitle}</h2>
					<p>{t.minorsText}</p>

					<h2>{t.responsibilityTitle}</h2>
					<p>{t.responsibilityText}</p>

					<h2>{t.boundariesTitle}</h2>
					<p>{t.boundariesText}</p>

					<h2>{t.changesTitle}</h2>
					<p>{t.changesText}</p>

					<h2>{t.contactTitle}</h2>
					<p>{t.contactText}</p>
				</div>
			</section>
		</main>
	);
}
