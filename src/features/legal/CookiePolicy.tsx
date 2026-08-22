import { PageHero } from "@/components/PageHero";
import { LegalNotice } from "./LegalNotice";
import type { Locale } from "@/lib/routes";

function En() {
  return (
    <main>
      <PageHero eyebrow="Cookies" title="Cookie & Storage Policy" />
      <section className="tight">
        <div className="wrap prose">
          <LegalNotice locale="en" />
          <p className="prose-meta">Last updated: 21 August 2026</p>

          <h2>How consent works</h2>
          <p>
            The cookie banner separates three categories. Strictly necessary storage is always on
            because the site can&apos;t function without it. Analytics and marketing are off by
            default and only turn on when you explicitly accept them - nothing is measured before
            that. You can change your mind at any time via &quot;Manage preferences&quot; in the cookie
            banner.
          </p>

          <h2>Categories</h2>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Purpose</th>
                <th>Default</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Strictly necessary</td>
                <td>Theme preference, language preference, cookie-consent choice itself</td>
                <td>Always on</td>
              </tr>
              <tr>
                <td>Analytics</td>
                <td>Google Analytics 4 - aggregate usage, anonymized IP</td>
                <td>Off until accepted</td>
              </tr>
              <tr>
                <td>Marketing</td>
                <td>Reserved for future, clearly-disclosed use - not currently used to serve ads</td>
                <td>Off until accepted</td>
              </tr>
            </tbody>
          </table>

          <h2>What we store, and where</h2>
          <ul>
            <li>Your theme and consent choices are stored in your browser&apos;s local storage, not a tracking cookie.</li>
            <li>If you accept analytics, Google Analytics sets its own first-party cookies to distinguish sessions and users.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

function Pl() {
  return (
    <main>
      <PageHero eyebrow="Cookies" title="Polityka cookies i przechowywania danych" />
      <section className="tight">
        <div className="wrap prose">
          <LegalNotice locale="pl" />
          <p className="prose-meta">Ostatnia aktualizacja: 21 sierpnia 2026</p>

          <h2>Jak działa zgoda</h2>
          <p>
            Baner cookies rozdziela trzy kategorie. Niezbędne przechowywanie jest zawsze
            włączone, bo strona bez niego nie może działać. Analityka i marketing są domyślnie
            wyłączone i włączają się dopiero po wyraźnej zgodzie - nic nie jest mierzone
            wcześniej. Możesz zmienić decyzję w dowolnym momencie przez &quot;Zarządzaj preferencjami&quot;
            w banerze cookies.
          </p>

          <h2>Kategorie</h2>
          <table>
            <thead>
              <tr>
                <th>Kategoria</th>
                <th>Cel</th>
                <th>Domyślnie</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Niezbędne</td>
                <td>Preferencja motywu, preferencja języka, sama decyzja o zgodzie na cookies</td>
                <td>Zawsze włączone</td>
              </tr>
              <tr>
                <td>Analityka</td>
                <td>Google Analytics 4 - zbiorcze użycie, zanonimizowany adres IP</td>
                <td>Wyłączone do momentu zgody</td>
              </tr>
              <tr>
                <td>Marketing</td>
                <td>Zarezerwowane na przyszłe, wyraźnie ujawnione użycie - obecnie nie służy do reklam</td>
                <td>Wyłączone do momentu zgody</td>
              </tr>
            </tbody>
          </table>

          <h2>Co i gdzie przechowujemy</h2>
          <ul>
            <li>Twój motyw i wybory zgody są przechowywane w local storage przeglądarki, nie w ciasteczku śledzącym.</li>
            <li>Jeśli zaakceptujesz analitykę, Google Analytics ustawia własne ciasteczka first-party, by rozróżniać sesje i użytkowników.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

export function CookiePolicy({ locale }: { locale: Locale }) {
  return locale === "en" ? <En /> : <Pl />;
}
