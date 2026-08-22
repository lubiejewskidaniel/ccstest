import { PageHero } from "@/components/PageHero";
import { LegalNotice } from "./LegalNotice";
import type { Locale } from "@/lib/routes";

function En() {
  return (
    <main>
      <PageHero eyebrow="Privacy" title="Privacy Notice" />
      <section className="tight">
        <div className="wrap prose">
          <LegalNotice locale="en" />
          <p className="prose-meta">Last updated: 21 August 2026 · Version 2026-08-1</p>

          <h2>Who we are</h2>
          <p>
            Code Consulting Studio (&quot;CCS&quot;, &quot;we&quot;, &quot;us&quot;) operates this website. Where a form or
            account creates a controller/processor relationship (for example, managed marketing
            operations run on a client&apos;s behalf), that relationship is documented in the client
            contract, not here.
          </p>

          <h2>What we collect</h2>
          <p>We only collect what&apos;s needed to respond to your enquiry (doc 12 PRIV-001). Depending on which form you use, that&apos;s typically:</p>
          <table>
            <thead>
              <tr>
                <th>Form</th>
                <th>Data collected</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Project enquiry</td>
                <td>Name, email, optional company, project stage, capability, optional budget range, your message</td>
                <td>To assess fit and reply to your enquiry</td>
              </tr>
              <tr>
                <td>Growth enquiry</td>
                <td>Name, email, optional company, service areas, engagement type, your message</td>
                <td>To scope a growth engagement</td>
              </tr>
              <tr>
                <td>Mentoring enquiry</td>
                <td>Name, email, audience type, topic, level, goal, and - only if you&apos;re under 18 - a parent/guardian name and email</td>
                <td>To arrange a suitable first session, and to involve a parent/guardian where a learner is a minor (doc 12 PRIV-008)</td>
              </tr>
            </tbody>
          </table>
          <p>
            We never ask for passwords, payment details or special-category data through a public
            form (doc 12 PRIV-007). Submitting a service enquiry is not treated as consent to
            unrelated marketing (PRIV-006).
          </p>

          <h2>Analytics</h2>
          <p>
            Analytics (Google Analytics 4) only loads after you explicitly opt in through the
            cookie banner - never before. Rejecting it does not block any part of the site
            (PRIV-004, PRIV-005). IP addresses are anonymized where the analytics provider supports it.
          </p>

          <h2>How long we keep it</h2>
          <p>
            Enquiry records are kept for as long as reasonably needed to respond and, where a
            project proceeds, for the duration of the engagement plus a standard record-keeping
            period. Exact retention periods are confirmed by the operating entity before launch.
          </p>

          <h2>Your rights</h2>
          <ul>
            <li>Ask what personal data we hold about you</li>
            <li>Ask us to correct or delete it</li>
            <li>Withdraw analytics consent at any time via &quot;Manage preferences&quot;</li>
            <li>Ask us not to use your data for anything beyond responding to your enquiry</li>
          </ul>

          <h2>Contact</h2>
          <p>For any privacy request, contact the studio through the details on the Contact page.</p>
        </div>
      </section>
    </main>
  );
}

function Pl() {
  return (
    <main>
      <PageHero eyebrow="Prywatność" title="Informacja o prywatności" />
      <section className="tight">
        <div className="wrap prose">
          <LegalNotice locale="pl" />
          <p className="prose-meta">Ostatnia aktualizacja: 21 sierpnia 2026 · Wersja 2026-08-1</p>

          <h2>Kim jesteśmy</h2>
          <p>
            Code Consulting Studio (&quot;CCS&quot;, &quot;my&quot;) prowadzi tę stronę internetową. Tam, gdzie
            formularz lub konto tworzy relację administrator/podmiot przetwarzający (np. zarządzane
            operacje marketingowe prowadzone w imieniu klienta), relacja ta jest udokumentowana w
            umowie z klientem, a nie tutaj.
          </p>

          <h2>Co zbieramy</h2>
          <p>Zbieramy tylko to, co jest potrzebne do odpowiedzi na Twoje zapytanie (dok. 12 PRIV-001). W zależności od formularza, zazwyczaj jest to:</p>
          <table>
            <thead>
              <tr>
                <th>Formularz</th>
                <th>Zbierane dane</th>
                <th>Cel</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Zapytanie o projekt</td>
                <td>Imię i nazwisko, email, opcjonalnie firma, etap projektu, obszar pomocy, opcjonalny budżet, wiadomość</td>
                <td>Ocena dopasowania i odpowiedź na zapytanie</td>
              </tr>
              <tr>
                <td>Zapytanie o growth</td>
                <td>Imię i nazwisko, email, opcjonalnie firma, obszary usług, forma współpracy, wiadomość</td>
                <td>Wycena zakresu współpracy growth</td>
              </tr>
              <tr>
                <td>Zapytanie o mentoring</td>
                <td>Imię i nazwisko, email, typ odbiorcy, temat, poziom, cel, a jeśli masz poniżej 18 lat - imię, nazwisko i email rodzica/opiekuna</td>
                <td>Ustalenie odpowiedniej pierwszej sesji i zaangażowanie rodzica/opiekuna, gdy uczący się jest niepełnoletni (dok. 12 PRIV-008)</td>
              </tr>
            </tbody>
          </table>
          <p>
            Nigdy nie prosimy o hasła, dane płatnicze ani dane szczególnej kategorii przez
            publiczny formularz (PRIV-007). Wysłanie zapytania usługowego nie jest traktowane jako
            zgoda na niepowiązany marketing (PRIV-006).
          </p>

          <h2>Analityka</h2>
          <p>
            Analityka (Google Analytics 4) ładuje się dopiero po wyraźnej zgodzie w banerze
            cookies - nigdy wcześniej. Odrzucenie jej nie blokuje żadnej części strony
            (PRIV-004, PRIV-005). Adresy IP są anonimizowane tam, gdzie dostawca analityki to wspiera.
          </p>

          <h2>Jak długo przechowujemy dane</h2>
          <p>
            Zapytania są przechowywane tak długo, jak zasadnie potrzeba na odpowiedź, a jeśli
            projekt jest realizowany - przez czas trwania współpracy plus standardowy okres
            archiwizacji. Dokładne okresy retencji zostaną potwierdzone przez podmiot prowadzący
            przed uruchomieniem.
          </p>

          <h2>Twoje prawa</h2>
          <ul>
            <li>Zapytać, jakie dane osobowe o Tobie przechowujemy</li>
            <li>Poprosić o ich poprawienie lub usunięcie</li>
            <li>Wycofać zgodę na analitykę w dowolnym momencie przez &quot;Zarządzaj preferencjami&quot;</li>
            <li>Poprosić, by Twoje dane nie były wykorzystywane poza odpowiedzią na zapytanie</li>
          </ul>

          <h2>Kontakt</h2>
          <p>W sprawie próśb dotyczących prywatności skontaktuj się ze studiem przez dane na stronie Kontakt.</p>
        </div>
      </section>
    </main>
  );
}

export function PrivacyPolicy({ locale }: { locale: Locale }) {
  return locale === "en" ? <En /> : <Pl />;
}
