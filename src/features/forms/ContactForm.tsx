"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { routeFor, type Locale } from "@/lib/routes";
import { submitProjectLead, submitMarketingLead, type LeadFormState } from "@/lib/actions/leads";
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
    tabProject: "Project (BUILD)",
    tabMarketing: "Growth (GROW)",
    name: "Full name",
    email: "Email",
    company: "Company",
    optional: "optional",
    message: "Tell us about it",
    messageHintProject: "What are you trying to build? Rough scope, timeline and constraints are all useful.",
    messageHintMarketing: "What are you trying to grow, and what have you tried so far?",
    stage: "Where are you starting from?",
    stageOptions: {
      idea: "Just an idea",
      "in-progress": "Already in progress",
      "existing-product": "Existing product",
      "not-sure": "Not sure yet",
    },
    capability: "What kind of help do you need?",
    capabilityOptions: {
      "software-development": "Software development",
      "product-development": "Product development",
      "technology-consulting": "Technology consulting",
      "web-digital": "Web & digital",
      "not-sure": "Not sure yet",
    },
    budget: "Budget range",
    budgetOptions: {
      "under-5k": "Under €5k",
      "5k-15k": "€5k - €15k",
      "15k-50k": "€15k - €50k",
      "50k-plus": "€50k+",
      "not-sure": "Not sure yet",
    },
    services: "Which areas do you need help with?",
    servicesOptions: {
      "seo-local-seo": "SEO & Local SEO",
      "social-media-management": "Social media",
      "content-creation": "Content creation",
      "growth-strategy": "Growth strategy",
      "analytics-reporting": "Analytics & reporting",
      "ads-management": "Ads management",
    },
    engagementType: "Preferred engagement",
    engagementOptions: {
      "one-off": "One-off project",
      "managed-recurring": "Managed / recurring",
      "not-sure": "Not sure yet",
    },
    currentPresence: "Current online presence",
    currentPresenceOptions: { none: "None yet", some: "Some, needs work", established: "Established" },
    consent: "I've read the",
    privacyPolicy: "privacy notice",
    consentEnd: "and agree to be contacted about my enquiry.",
    submitProject: "Send project enquiry",
    submitMarketing: "Send growth enquiry",
    submitting: "Sending…",
    successTitle: "Thanks - we've got it.",
    successBody: "We'll get back to you within two working days.",
    errorGeneric: "Please check the highlighted fields and try again.",
    note: "No spam, no newsletter you didn't ask for - just a reply from a human.",
  },
  pl: {
    tabProject: "Projekt (BUILD)",
    tabMarketing: "Growth (GROW)",
    name: "Imię i nazwisko",
    email: "Email",
    company: "Firma",
    optional: "opcjonalnie",
    message: "Opowiedz nam o tym",
    messageHintProject: "Co chcesz zbudować? Przybliżony zakres, termin i ograniczenia są pomocne.",
    messageHintMarketing: "Co chcesz rozwijać i co już próbowałeś/aś?",
    stage: "Od czego zaczynasz?",
    stageOptions: {
      idea: "Sam pomysł",
      "in-progress": "Już w trakcie realizacji",
      "existing-product": "Istniejący produkt",
      "not-sure": "Jeszcze nie wiem",
    },
    capability: "Jakiej pomocy potrzebujesz?",
    capabilityOptions: {
      "software-development": "Wytwarzanie oprogramowania",
      "product-development": "Rozwój produktu",
      "technology-consulting": "Doradztwo technologiczne",
      "web-digital": "Web i digital",
      "not-sure": "Jeszcze nie wiem",
    },
    budget: "Zakres budżetu",
    budgetOptions: {
      "under-5k": "Poniżej 5 tys. €",
      "5k-15k": "5-15 tys. €",
      "15k-50k": "15-50 tys. €",
      "50k-plus": "50 tys. € +",
      "not-sure": "Jeszcze nie wiem",
    },
    services: "Jakich obszarów potrzebujesz?",
    servicesOptions: {
      "seo-local-seo": "SEO i lokalne SEO",
      "social-media-management": "Social media",
      "content-creation": "Tworzenie treści",
      "growth-strategy": "Strategia rozwoju",
      "analytics-reporting": "Analityka i raportowanie",
      "ads-management": "Kampanie reklamowe",
    },
    engagementType: "Preferowana forma współpracy",
    engagementOptions: {
      "one-off": "Projekt jednorazowy",
      "managed-recurring": "Zarządzane / cykliczne",
      "not-sure": "Jeszcze nie wiem",
    },
    currentPresence: "Obecna obecność online",
    currentPresenceOptions: { none: "Jeszcze brak", some: "Częściowa, do poprawy", established: "Ugruntowana" },
    consent: "Zapoznałem/am się z",
    privacyPolicy: "informacją o prywatności",
    consentEnd: "i zgadzam się na kontakt w sprawie mojego zapytania.",
    submitProject: "Wyślij zapytanie o projekt",
    submitMarketing: "Wyślij zapytanie o growth",
    submitting: "Wysyłanie…",
    successTitle: "Dzięki - mamy to.",
    successBody: "Odpowiemy w ciągu dwóch dni roboczych.",
    errorGeneric: "Sprawdź podświetlone pola i spróbuj ponownie.",
    note: "Bez spamu i newslettera, o który nie prosisz - tylko odpowiedź od człowieka.",
  },
};

function FieldError({ text }: { text?: string }) {
  if (!text) return null;
  return <span className="field-error">{text}</span>;
}

export function ContactForm({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const [tab, setTab] = useState<"project" | "marketing">("project");
  const [projectState, projectAction, projectPending] = useActionState(submitProjectLead, idleState);
  const [marketingState, marketingAction, marketingPending] = useActionState(submitMarketingLead, idleState);

  const state = tab === "project" ? projectState : marketingState;
  const pending = tab === "project" ? projectPending : marketingPending;
  const fieldErrors = state.fieldErrors ?? {};

  const pathname = usePathname();
  const startedRef = useRef({ project: false, marketing: false });

  function markStarted(formType: "project" | "marketing") {
    if (startedRef.current[formType]) return;
    startedRef.current[formType] = true;
    events.contactFormStart(formType, getBaseContext(pathname));
  }

  useEffect(() => {
    if (projectState.status === "success") events.contactFormSubmit("project", getBaseContext(pathname));
    if (projectState.status === "error") {
      events.contactFormError("project", Object.keys(projectState.fieldErrors ?? {}).length || 1, getBaseContext(pathname));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectState.status]);
  useEffect(() => {
    if (marketingState.status === "success") events.contactFormSubmit("marketing", getBaseContext(pathname));
    if (marketingState.status === "error") {
      events.contactFormError(
        "marketing",
        Object.keys(marketingState.fieldErrors ?? {}).length || 1,
        getBaseContext(pathname)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketingState.status]);

  return (
    <div className="card form-card">
      <div className="form-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`form-tab${tab === "project" ? " active" : ""}`}
          aria-selected={tab === "project"}
          onClick={() => setTab("project")}
        >
          {t.tabProject}
        </button>
        <button
          type="button"
          role="tab"
          className={`form-tab${tab === "marketing" ? " active" : ""}`}
          aria-selected={tab === "marketing"}
          onClick={() => setTab("marketing")}
        >
          {t.tabMarketing}
        </button>
      </div>

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

      {tab === "project" ? (
        <form action={projectAction} noValidate onFocusCapture={() => markStarted("project")}>
          <input type="hidden" name="locale" value={locale} />
          <AttributionFields />
          <div className="field-row">
            <div className="field">
              <label htmlFor="p-name">{t.name}</label>
              <input id="p-name" name="name" type="text" required maxLength={100} />
              <FieldError text={fieldErrors.name} />
            </div>
            <div className="field">
              <label htmlFor="p-email">{t.email}</label>
              <input id="p-email" name="email" type="email" required maxLength={254} />
              <FieldError text={fieldErrors.email} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="p-company">
              {t.company} <span className="opt">({t.optional})</span>
            </label>
            <input id="p-company" name="company" type="text" maxLength={160} />
          </div>

          <div className="field">
            <label>{t.stage}</label>
            <div className="choice-grid">
              {Object.entries(t.stageOptions).map(([value, label]) => (
                <label className="choice" key={value}>
                  <input type="radio" name="stage" value={value} required defaultChecked={value === "idea"} />
                  {label}
                </label>
              ))}
            </div>
            <FieldError text={fieldErrors.stage} />
          </div>

          <div className="field">
            <label>{t.capability}</label>
            <div className="choice-grid">
              {Object.entries(t.capabilityOptions).map(([value, label]) => (
                <label className="choice" key={value}>
                  <input type="radio" name="capability" value={value} required defaultChecked={value === "not-sure"} />
                  {label}
                </label>
              ))}
            </div>
            <FieldError text={fieldErrors.capability} />
          </div>

          <div className="field">
            <label htmlFor="p-budget">
              {t.budget} <span className="opt">({t.optional})</span>
            </label>
            <select id="p-budget" name="budgetRange" defaultValue="">
              <option value="" disabled>
                -
              </option>
              {Object.entries(t.budgetOptions).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="p-message">{t.message}</label>
            <textarea id="p-message" name="message" required minLength={20} maxLength={5000} placeholder={t.messageHintProject} />
            <FieldError text={fieldErrors.message} />
          </div>

          <div className="consent-row">
            <input type="checkbox" name="consentPrivacy" id="p-consent" required />
            <label htmlFor="p-consent">
              {t.consent} <Link href={routeFor("privacy", locale)}>{t.privacyPolicy}</Link> {t.consentEnd}
            </label>
          </div>
          <FieldError text={fieldErrors.consentPrivacy} />

          <button type="submit" className="btn btn-primary form-submit" disabled={pending}>
            {pending ? t.submitting : t.submitProject}
          </button>
          <p className="form-note">{t.note}</p>
        </form>
      ) : (
        <form action={marketingAction} noValidate onFocusCapture={() => markStarted("marketing")}>
          <input type="hidden" name="locale" value={locale} />
          <AttributionFields />
          <div className="field-row">
            <div className="field">
              <label htmlFor="m-name">{t.name}</label>
              <input id="m-name" name="name" type="text" required maxLength={100} />
              <FieldError text={fieldErrors.name} />
            </div>
            <div className="field">
              <label htmlFor="m-email">{t.email}</label>
              <input id="m-email" name="email" type="email" required maxLength={254} />
              <FieldError text={fieldErrors.email} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="m-company">
              {t.company} <span className="opt">({t.optional})</span>
            </label>
            <input id="m-company" name="company" type="text" maxLength={160} />
          </div>

          <div className="field">
            <label>{t.services}</label>
            <div className="choice-grid">
              {Object.entries(t.servicesOptions).map(([value, label]) => (
                <label className="choice" key={value}>
                  <input type="checkbox" name="services" value={value} />
                  {label}
                </label>
              ))}
            </div>
            <FieldError text={fieldErrors.services} />
          </div>

          <div className="field">
            <label>{t.engagementType}</label>
            <div className="choice-grid">
              {Object.entries(t.engagementOptions).map(([value, label]) => (
                <label className="choice" key={value}>
                  <input type="radio" name="engagementType" value={value} required defaultChecked={value === "not-sure"} />
                  {label}
                </label>
              ))}
            </div>
            <FieldError text={fieldErrors.engagementType} />
          </div>

          <div className="field">
            <label htmlFor="m-presence">
              {t.currentPresence} <span className="opt">({t.optional})</span>
            </label>
            <select id="m-presence" name="currentPresence" defaultValue="">
              <option value="" disabled>
                -
              </option>
              {Object.entries(t.currentPresenceOptions).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="m-message">{t.message}</label>
            <textarea id="m-message" name="message" required minLength={20} maxLength={5000} placeholder={t.messageHintMarketing} />
            <FieldError text={fieldErrors.message} />
          </div>

          <div className="consent-row">
            <input type="checkbox" name="consentPrivacy" id="m-consent" required />
            <label htmlFor="m-consent">
              {t.consent} <Link href={routeFor("privacy", locale)}>{t.privacyPolicy}</Link> {t.consentEnd}
            </label>
          </div>
          <FieldError text={fieldErrors.consentPrivacy} />

          <button type="submit" className="btn btn-primary form-submit" disabled={pending}>
            {pending ? t.submitting : t.submitMarketing}
          </button>
          <p className="form-note">{t.note}</p>
        </form>
      )}
    </div>
  );
}
