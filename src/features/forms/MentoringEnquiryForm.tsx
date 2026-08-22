"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { routeFor, type Locale } from "@/lib/routes";
import { submitMentoringLead, type LeadFormState } from "@/lib/actions/leads";
import { events, getBaseContext } from "@/lib/analytics";
import { AttributionFields } from "./AttributionFields";

const idleState: LeadFormState = { status: "idle" };

const CHECK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m5 13 4 4 10-10" />
  </svg>
);
const WARN_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16h.01" />
  </svg>
);

const COPY = {
  en: {
    audience: "Which best describes you?",
    audienceOptions: {
      "starting-out": "Starting out",
      "university-technical-study": "University / technical study",
      "career-changer": "Career changer",
      other: "Other",
    },
    name: "Full name",
    email: "Email",
    topic: "What do you want help with?",
    topicPlaceholder: "e.g. React fundamentals, data structures, a portfolio project…",
    level: "Current level",
    levelOptions: {
      "complete-beginner": "Complete beginner",
      "some-experience": "Some experience",
      intermediate: "Intermediate",
      advanced: "Advanced",
    },
    goal: "What would a good outcome look like?",
    goalPlaceholder: "The more specific, the better we can prepare for the first session.",
    isMinor: "I am under 18",
    parentName: "Parent / guardian name",
    parentEmail: "Parent / guardian email",
    academicAck: "I understand CCS teaches and guides but does not complete assessed work for me.",
    consent: "I've read the",
    privacyPolicy: "privacy notice",
    consentEnd: "and agree to be contacted about my enquiry.",
    submit: "Send enquiry",
    submitting: "Sending…",
    successTitle: "Thanks - we've got it.",
    successBody: "We'll reply within two working days to arrange a first session.",
    errorGeneric: "Please check the highlighted fields and try again.",
    note: "See our academic integrity policy for how mentoring works around coursework.",
    integrityLink: "Academic integrity policy",
  },
  pl: {
    audience: "Co najlepiej Cię opisuje?",
    audienceOptions: {
      "starting-out": "Stawiam pierwsze kroki",
      "university-technical-study": "Studia / przedmioty techniczne",
      "career-changer": "Zmieniam branżę",
      other: "Inne",
    },
    name: "Imię i nazwisko",
    email: "Email",
    topic: "W czym potrzebujesz pomocy?",
    topicPlaceholder: "np. podstawy React, struktury danych, projekt do portfolio…",
    level: "Obecny poziom",
    levelOptions: {
      "complete-beginner": "Zupełny początkujący",
      "some-experience": "Trochę doświadczenia",
      intermediate: "Średniozaawansowany",
      advanced: "Zaawansowany",
    },
    goal: "Jak wygląda dobry efekt?",
    goalPlaceholder: "Im bardziej konkretnie, tym lepiej przygotujemy się do pierwszej sesji.",
    isMinor: "Mam poniżej 18 lat",
    parentName: "Imię i nazwisko rodzica / opiekuna",
    parentEmail: "Email rodzica / opiekuna",
    academicAck: "Rozumiem, że CCS uczy i wspiera, ale nie wykonuje za mnie ocenianych prac.",
    consent: "Zapoznałem/am się z",
    privacyPolicy: "informacją o prywatności",
    consentEnd: "i zgadzam się na kontakt w sprawie mojego zapytania.",
    submit: "Wyślij zapytanie",
    submitting: "Wysyłanie…",
    successTitle: "Dzięki - mamy to.",
    successBody: "Odpowiemy w ciągu dwóch dni roboczych, by umówić pierwszą sesję.",
    errorGeneric: "Sprawdź podświetlone pola i spróbuj ponownie.",
    note: "Zobacz naszą politykę rzetelności akademickiej, by dowiedzieć się, jak działa mentoring wobec prac zaliczeniowych.",
    integrityLink: "Polityka rzetelności akademickiej",
  },
};

function FieldError({ text }: { text?: string }) {
  if (!text) return null;
  return <span className="field-error">{text}</span>;
}

export function MentoringEnquiryForm({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const [state, formAction, pending] = useActionState(submitMentoringLead, idleState);
  const [isMinor, setIsMinor] = useState(false);
  const fieldErrors = state.fieldErrors ?? {};

  const pathname = usePathname();
  const startedRef = useRef(false);

  function markStarted() {
    if (startedRef.current) return;
    startedRef.current = true;
    events.mentoringEnquiryStart(getBaseContext(pathname));
  }

  useEffect(() => {
    if (state.status === "success") events.mentoringEnquirySubmit(getBaseContext(pathname));
    if (state.status === "error") {
      events.mentoringEnquiryError(Object.keys(state.fieldErrors ?? {}).length || 1, getBaseContext(pathname));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  return (
    <div className="card form-card">
      {state.status === "success" && (
        <div className="form-status ok" role="status">
          {CHECK_ICON}
          <span>
            <b>{t.successTitle}</b> {t.successBody}
          </span>
        </div>
      )}
      {state.status === "error" && !Object.keys(fieldErrors).length && (
        <div className="form-status err" role="alert">
          {WARN_ICON}
          <span>{state.message ?? t.errorGeneric}</span>
        </div>
      )}

      <form action={formAction} noValidate onFocusCapture={markStarted}>
        <input type="hidden" name="locale" value={locale} />
        <AttributionFields />

        <div className="field">
          <label>{t.audience}</label>
          <div className="choice-grid">
            {Object.entries(t.audienceOptions).map(([value, label]) => (
              <label className="choice" key={value}>
                <input type="radio" name="audience" value={value} required defaultChecked={value === "starting-out"} />
                {label}
              </label>
            ))}
          </div>
          <FieldError text={fieldErrors.audience} />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="me-name">{t.name}</label>
            <input id="me-name" name="name" type="text" required maxLength={100} />
            <FieldError text={fieldErrors.name} />
          </div>
          <div className="field">
            <label htmlFor="me-email">{t.email}</label>
            <input id="me-email" name="email" type="email" required maxLength={254} />
            <FieldError text={fieldErrors.email} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="me-topic">{t.topic}</label>
          <input id="me-topic" name="topic" type="text" required maxLength={200} placeholder={t.topicPlaceholder} />
          <FieldError text={fieldErrors.topic} />
        </div>

        <div className="field">
          <label>{t.level}</label>
          <div className="choice-grid">
            {Object.entries(t.levelOptions).map(([value, label]) => (
              <label className="choice" key={value}>
                <input type="radio" name="currentLevel" value={value} required defaultChecked={value === "complete-beginner"} />
                {label}
              </label>
            ))}
          </div>
          <FieldError text={fieldErrors.currentLevel} />
        </div>

        <div className="field">
          <label htmlFor="me-goal">{t.goal}</label>
          <textarea id="me-goal" name="goal" required minLength={20} maxLength={5000} placeholder={t.goalPlaceholder} />
          <FieldError text={fieldErrors.goal} />
        </div>

        <div className="consent-row">
          <input
            type="checkbox"
            name="isMinor"
            id="me-minor"
            checked={isMinor}
            onChange={(e) => setIsMinor(e.target.checked)}
          />
          <label htmlFor="me-minor">{t.isMinor}</label>
        </div>

        {isMinor && (
          <div className="field-row">
            <div className="field">
              <label htmlFor="me-pname">{t.parentName}</label>
              <input id="me-pname" name="parentGuardianName" type="text" required={isMinor} maxLength={100} />
              <FieldError text={fieldErrors.parentGuardianName} />
            </div>
            <div className="field">
              <label htmlFor="me-pemail">{t.parentEmail}</label>
              <input id="me-pemail" name="parentGuardianEmail" type="email" required={isMinor} maxLength={254} />
              <FieldError text={fieldErrors.parentGuardianEmail} />
            </div>
          </div>
        )}

        <div className="consent-row">
          <input type="checkbox" name="academicIntegrityAck" id="me-integrity" required />
          <label htmlFor="me-integrity">{t.academicAck}</label>
        </div>
        <FieldError text={fieldErrors.academicIntegrityAck} />

        <div className="consent-row">
          <input type="checkbox" name="consentPrivacy" id="me-consent" required />
          <label htmlFor="me-consent">
            {t.consent} <Link href={routeFor("privacy", locale)}>{t.privacyPolicy}</Link> {t.consentEnd}
          </label>
        </div>
        <FieldError text={fieldErrors.consentPrivacy} />

        <button type="submit" className="btn btn-primary form-submit" disabled={pending}>
          {pending ? t.submitting : t.submit}
        </button>
        <p className="form-note">
          {t.note} <Link href={routeFor("academicIntegrity", locale)}>{t.integrityLink}</Link>
        </p>
      </form>
    </div>
  );
}
