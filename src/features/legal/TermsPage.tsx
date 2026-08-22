import { PageHero } from "@/components/PageHero";
import { LegalNotice } from "./LegalNotice";
import type { Locale } from "@/lib/routes";

function En() {
  return (
    <main>
      <PageHero eyebrow="Terms" title="Website Terms" />
      <section className="tight">
        <div className="wrap prose">
          <LegalNotice locale="en" />
          <p className="prose-meta">Last updated: 21 August 2026</p>

          <h2>Using this site</h2>
          <p>
            This website is provided for information about Code Consulting Studio&apos;s services,
            products and mentoring programme. You may browse it and submit enquiry forms in good
            faith; you may not attempt to disrupt, scrape at scale, or misuse the site&apos;s systems.
          </p>

          <h2>Enquiries are not a contract</h2>
          <p>
            Submitting a project, growth or mentoring enquiry does not create a binding
            engagement. Any actual engagement - scope, price, timeline - is agreed separately in
            writing.
          </p>

          <h2>Content ownership</h2>
          <p>
            Site content, design and the CCS brand mark belong to Code Consulting Studio. Client
            project details shown under &quot;Selected work&quot; are shared with permission; publication
            authority, approvals and asset rights for client marketing work are governed by the
            relevant client contract.
          </p>

          <h2>No fabricated engagement</h2>
          <p>
            CCS does not fabricate testimonials, reviews or engagement numbers. Where figures
            appear on this site, they describe real work.
          </p>

          <h2>Liability</h2>
          <p>
            The site is provided &quot;as is.&quot; We aim for accuracy but don&apos;t guarantee the site or its
            content will be uninterrupted or error-free.
          </p>
        </div>
      </section>
    </main>
  );
}

function Pl() {
  return (
    <main>
      <PageHero eyebrow="Regulamin" title="Regulamin serwisu" />
      <section className="tight">
        <div className="wrap prose">
          <LegalNotice locale="pl" />
          <p className="prose-meta">Ostatnia aktualizacja: 21 sierpnia 2026</p>

          <h2>Korzystanie z serwisu</h2>
          <p>
            Ta strona służy do informowania o usługach, produktach i programie mentoringowym
            Code Consulting Studio. Możesz ją przeglądać i wysyłać formularze zapytań w dobrej
            wierze; nie możesz próbować zakłócać działania serwisu, masowo go skrapować ani
            nadużywać jego systemów.
          </p>

          <h2>Zapytanie nie jest umową</h2>
          <p>
            Wysłanie zapytania o projekt, growth lub mentoring nie tworzy wiążącej współpracy.
            Faktyczna współpraca - zakres, cena, harmonogram - jest ustalana osobno, na piśmie.
          </p>

          <h2>Własność treści</h2>
          <p>
            Treść strony, projekt graficzny i znak marki CCS należą do Code Consulting Studio.
            Szczegóły projektów klienckich pokazane w sekcji &quot;Wybrane realizacje&quot; są udostępniane
            za zgodą; uprawnienia do publikacji, zatwierdzenia i prawa do materiałów przy pracach
            marketingowych dla klientów reguluje odpowiednia umowa z klientem.
          </p>

          <h2>Bez fabrykowanego zaangażowania</h2>
          <p>
            CCS nie fabrykuje opinii, recenzji ani liczb zaangażowania. Jeśli na stronie
            pojawiają się liczby, opisują one rzeczywistą pracę.
          </p>

          <h2>Odpowiedzialność</h2>
          <p>
            Serwis jest udostępniany &quot;tak jak jest&quot;. Dbamy o dokładność, ale nie gwarantujemy,
            że serwis lub jego treść będą nieprzerwane albo wolne od błędów.
          </p>
        </div>
      </section>
    </main>
  );
}

export function TermsPage({ locale }: { locale: Locale }) {
  return locale === "en" ? <En /> : <Pl />;
}
