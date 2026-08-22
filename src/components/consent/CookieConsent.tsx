"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CURRENT_PRIVACY_NOTICE_VERSION,
  getStoredConsent,
  storeConsent,
  type ConsentState,
} from "@/lib/analytics";
import { routeFor, type Locale } from "@/lib/routes";

const COPY = {
  en: {
    message:
      "We use optional analytics to understand how the site is used. Nothing is tracked until you say yes.",
    accept: "Accept optional",
    reject: "Reject optional",
    manage: "Manage preferences",
    save: "Save preferences",
    analytics: "Analytics",
    analyticsDesc: "Helps us understand aggregate usage. Off by default.",
    marketing: "Marketing",
    marketingDesc: "Not currently used to serve ads; reserved for future, clearly-disclosed use.",
    necessary: "Strictly necessary",
    necessaryDesc: "Required for the site to function. Always on.",
    cookiesPolicy: "Cookie policy",
  },
  pl: {
    message: "Używamy opcjonalnej analityki, by rozumieć jak korzystasz ze strony. Nic nie jest śledzone bez Twojej zgody.",
    accept: "Akceptuj opcjonalne",
    reject: "Odrzuć opcjonalne",
    manage: "Zarządzaj preferencjami",
    save: "Zapisz preferencje",
    analytics: "Analityka",
    analyticsDesc: "Pomaga nam rozumieć zbiorcze użycie strony. Domyślnie wyłączona.",
    marketing: "Marketing",
    marketingDesc: "Obecnie nie jest używane do reklam; zarezerwowane na przyszłość.",
    necessary: "Niezbędne",
    necessaryDesc: "Wymagane do działania strony. Zawsze włączone.",
    cookiesPolicy: "Polityka cookies",
  },
};

export function CookieConsent({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const [visible, setVisible] = useState(false);
  const [managing, setManaging] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const stored = getStoredConsent();
    // Reads localStorage after mount (not as a lazy initializer) so the
    // server-rendered markup and the client's first render agree - a
    // returning visitor with stored consent must not hydrate with the
    // banner shown on the server and hidden on the client (or vice versa).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(!stored);
    if (stored) {
      setAnalytics(stored.analytics);
      setMarketing(stored.marketing);
    }
  }, []);

  function save(next: Omit<ConsentState, "necessary" | "privacyNoticeVersion">) {
    const state: ConsentState = {
      necessary: true,
      privacyNoticeVersion: CURRENT_PRIVACY_NOTICE_VERSION,
      ...next,
    };
    storeConsent(state);
    setVisible(false);
    setManaging(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-panel" role="dialog" aria-modal="false" aria-label="Cookie preferences">
      <div className="wrap cookie-panel-inner">
        {!managing ? (
          <>
            <p className="cookie-message">
              {t.message}{" "}
              <Link href={routeFor("cookies", locale)}>{t.cookiesPolicy}</Link>
            </p>
            <div className="cookie-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setManaging(true)}>
                {t.manage}
              </button>
              <button type="button" className="btn btn-dark" onClick={() => save({ analytics: false, marketing: false })}>
                {t.reject}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => save({ analytics: true, marketing: true })}>
                {t.accept}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="cookie-options">
              <label className="cookie-option">
                <input type="checkbox" checked disabled />
                <span>
                  <b>{t.necessary}</b>
                  <small>{t.necessaryDesc}</small>
                </span>
              </label>
              <label className="cookie-option">
                <input
                  type="checkbox"
                  checked={analytics}
                  onChange={(e) => setAnalytics(e.target.checked)}
                />
                <span>
                  <b>{t.analytics}</b>
                  <small>{t.analyticsDesc}</small>
                </span>
              </label>
              <label className="cookie-option">
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={(e) => setMarketing(e.target.checked)}
                />
                <span>
                  <b>{t.marketing}</b>
                  <small>{t.marketingDesc}</small>
                </span>
              </label>
            </div>
            <div className="cookie-actions">
              <button type="button" className="btn btn-primary" onClick={() => save({ analytics, marketing })}>
                {t.save}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
