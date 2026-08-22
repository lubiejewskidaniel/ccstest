import { PageHero } from "@/components/PageHero";
import { LegalNotice } from "./LegalNotice";
import type { Locale } from "@/lib/routes";

function En() {
  return (
    <main>
      <PageHero eyebrow="Academic integrity" title="Academic Integrity Policy" />
      <section className="tight">
        <div className="wrap prose">
          <LegalNotice locale="en" />
          <p className="prose-meta">Last updated: 21 August 2026</p>

          <h2>What mentoring is</h2>
          <p>
            CCS mentoring explains concepts, reviews your own work, and guides your thinking
            through a problem. It&apos;s built for people who want to genuinely understand a topic -
            not to outsource it.
          </p>

          <h2>What mentoring is not</h2>
          <ul>
            <li>We do not write, complete or submit assignments, exams or assessed coursework on a student&apos;s behalf.</li>
            <li>We do not impersonate a student in any academic system or communication.</li>
            <li>We do not help circumvent an institution&apos;s plagiarism or integrity policy.</li>
          </ul>

          <h2>Working with minors</h2>
          <p>
            Where a learner is under 18, a parent or guardian&apos;s name and email are required at
            enquiry (doc 12 PRIV-008), and sessions are arranged with appropriate safeguarding in
            mind. If you&apos;re unsure whether this applies to you, tell us in the enquiry form and
            we&apos;ll guide you through it.
          </p>

          <h2>If you&apos;re not sure something&apos;s in bounds</h2>
          <p>
            Ask. If a request would cross the line above, we&apos;ll say so and suggest how mentoring
            can still help - for example, walking through the underlying concept instead of the
            specific graded question.
          </p>
        </div>
      </section>
    </main>
  );
}

function Pl() {
  return (
    <main>
      <PageHero eyebrow="Rzetelność akademicka" title="Polityka rzetelności akademickiej" />
      <section className="tight">
        <div className="wrap prose">
          <LegalNotice locale="pl" />
          <p className="prose-meta">Ostatnia aktualizacja: 21 sierpnia 2026</p>

          <h2>Czym jest mentoring</h2>
          <p>
            Mentoring CCS wyjaśnia koncepcje, recenzuje Twoją własną pracę i prowadzi Twoje
            myślenie przez problem. Jest dla osób, które chcą naprawdę zrozumieć temat - nie
            oddelegować go komuś innemu.
          </p>

          <h2>Czym mentoring nie jest</h2>
          <ul>
            <li>Nie piszemy, nie kończymy ani nie wysyłamy zadań, egzaminów ani ocenianych prac w imieniu studenta.</li>
            <li>Nie podszywamy się pod studenta w żadnym systemie ani komunikacji akademickiej.</li>
            <li>Nie pomagamy obchodzić polityki plagiatu ani rzetelności akademickiej danej uczelni.</li>
          </ul>

          <h2>Praca z osobami niepełnoletnimi</h2>
          <p>
            Jeśli uczący się ma poniżej 18 lat, przy zapytaniu wymagane są imię, nazwisko i email
            rodzica/opiekuna (dok. 12 PRIV-008), a sesje są organizowane z uwzględnieniem
            odpowiednich zasad ochrony. Jeśli nie jesteś pewien/pewna, czy to dotyczy Ciebie,
            napisz o tym w formularzu, a poprowadzimy Cię dalej.
          </p>

          <h2>Jeśli nie masz pewności, czy coś mieści się w granicach</h2>
          <p>
            Zapytaj. Jeśli prośba przekraczałaby powyższą granicę, powiemy to wprost i
            zaproponujemy, jak mentoring może i tak pomóc - np. poprzez omówienie koncepcji
            leżącej u podstaw, zamiast konkretnego ocenianego zadania.
          </p>
        </div>
      </section>
    </main>
  );
}

export function AcademicIntegrityPolicy({ locale }: { locale: Locale }) {
  return locale === "en" ? <En /> : <Pl />;
}
