import { PageHero } from "@/components/PageHero";
import { LegalNotice } from "./LegalNotice";
import type { Locale } from "@/lib/routes";

function En() {
  return (
    <main>
      <PageHero eyebrow="Accessibility" title="Accessibility Statement" />
      <section className="tight">
        <div className="wrap prose">
          <LegalNotice locale="en" />
          <p className="prose-meta">Last updated: 21 August 2026 · Target: WCAG 2.2 AA</p>

          <h2>Our target</h2>
          <p>
            This site is built and reviewed against WCAG 2.2 level AA. That&apos;s a target we work
            toward continuously, not a one-time certification.
          </p>

          <h2>What we&apos;ve built in</h2>
          <ul>
            <li>Semantic landmarks and a logical heading hierarchy on every page.</li>
            <li>A &quot;Skip to content&quot; link at the very start of the page for keyboard users.</li>
            <li>All interactive controls are keyboard-operable with a visible focus outline.</li>
            <li>Every form field has an explicit label, and errors are announced next to the field that caused them.</li>
            <li>Decorative motion (the hero&apos;s signal field, cursor glow, card tilt) is hidden from assistive technology and disabled entirely when your system requests reduced motion.</li>
            <li>Information is never conveyed by colour alone - status and state also use text, icons or position.</li>
            <li>Layout is tested at 320px, 375px, 768px, 1024px and 1440px+ viewport widths.</li>
          </ul>

          <h2>Known limitations</h2>
          <p>
            As the site continues to grow, some newer pages may not yet have had a full manual
            screen-reader pass. If you hit a barrier, please tell us - see Contact.
          </p>

          <h2>Feedback</h2>
          <p>
            If any part of this site is difficult to use with assistive technology, contact us
            through the Contact page and we&apos;ll aim to address it.
          </p>
        </div>
      </section>
    </main>
  );
}

function Pl() {
  return (
    <main>
      <PageHero eyebrow="Dostępność" title="Deklaracja dostępności" />
      <section className="tight">
        <div className="wrap prose">
          <LegalNotice locale="pl" />
          <p className="prose-meta">Ostatnia aktualizacja: 21 sierpnia 2026 · Cel: WCAG 2.2 AA</p>

          <h2>Nasz cel</h2>
          <p>
            Ta strona jest budowana i weryfikowana względem WCAG 2.2 na poziomie AA. To cel,
            do którego dążymy stale, a nie jednorazowa certyfikacja.
          </p>

          <h2>Co wdrożyliśmy</h2>
          <ul>
            <li>Semantyczne landmarki i logiczną hierarchię nagłówków na każdej stronie.</li>
            <li>Link &quot;Przejdź do treści&quot; na samym początku strony dla użytkowników klawiatury.</li>
            <li>Wszystkie elementy interaktywne są obsługiwane z klawiatury z widocznym obramowaniem fokusu.</li>
            <li>Każde pole formularza ma jawną etykietę, a błędy są ogłaszane przy polu, którego dotyczą.</li>
            <li>Dekoracyjny ruch (pole sygnałowe w hero, poświata kursora, przechylanie kart) jest ukryty przed technologiami wspomagającymi i całkowicie wyłączany, gdy system żąda ograniczonego ruchu.</li>
            <li>Informacje nigdy nie są przekazywane wyłącznie kolorem - stan i status używają też tekstu, ikon lub pozycji.</li>
            <li>Układ jest testowany przy szerokościach 320px, 375px, 768px, 1024px i 1440px+.</li>
          </ul>

          <h2>Znane ograniczenia</h2>
          <p>
            Wraz z rozwojem strony niektóre nowsze podstrony mogą jeszcze nie mieć pełnego
            ręcznego przeglądu z czytnikiem ekranu. Jeśli napotkasz barierę, daj nam znać - zobacz Kontakt.
          </p>

          <h2>Zgłoszenia</h2>
          <p>
            Jeśli jakakolwiek część tej strony jest trudna w użyciu z technologią wspomagającą,
            skontaktuj się z nami przez stronę Kontakt - postaramy się to naprawić.
          </p>
        </div>
      </section>
    </main>
  );
}

export function AccessibilityStatement({ locale }: { locale: Locale }) {
  return locale === "en" ? <En /> : <Pl />;
}
