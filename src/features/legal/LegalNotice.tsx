import type { Locale } from "@/lib/routes";

/**
 * Every legal surface carries this notice (doc 12 §3 "Production legal
 * gate" - template/provisional legal copy MUST NOT be treated as final
 * legal advice; before launch these pages need the actual operating
 * entity, contact details, processors, retention periods and lawful
 * bases reviewed by qualified counsel).
 */
export function LegalNotice({ locale }: { locale: Locale }) {
  return (
    <div
      className="prose-toc"
      style={{ borderColor: "rgba(251,191,36,.35)", background: "rgba(251,191,36,.06)" }}
    >
      <p style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6, margin: 0 }}>
        {locale === "en"
          ? "Template notice: this page describes how CCS is designed to handle this area. It is not final legal advice - the operating entity, contact details, retention periods and lawful bases below should be confirmed by qualified counsel before launch."
          : "Notatka szablonowa: ta strona opisuje, jak CCS jest zaprojektowane do obsługi tego obszaru. Nie jest to ostateczna porada prawna - podmiot prowadzący, dane kontaktowe, okresy retencji i podstawy prawne poniżej powinny zostać potwierdzone przez wykwalifikowanego prawnika przed uruchomieniem."}
      </p>
    </div>
  );
}
