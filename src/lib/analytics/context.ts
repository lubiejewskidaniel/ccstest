import { getStoredAttribution } from "@/features/attribution";

/**
 * Shared context envelope every event carries (brief §6). Kept deliberately
 * free of anything that could be personal data - no names, emails, form
 * bodies or credentials ever pass through this layer (brief §6 "must not
 * expose form messages, passwords, authentication credentials").
 */
export type EventContext = {
  page: string;
  locale: "en" | "pl";
  service?: string;
  ctaLocation?: string;
  campaign?: string | null;
  source?: string | null;
  medium?: string | null;
  referrer?: string | null;
  experimentId?: string;
  experimentVariant?: string;
};

/**
 * Base context every call site can spread and extend - pulls locale from
 * the pathname (same `/pl/...` convention as the rest of the app) and
 * campaign/source/medium from the stored first-touch attribution, so
 * individual components don't need to know where attribution data lives.
 */
export function getBaseContext(pathname: string): EventContext {
  const locale: "en" | "pl" = pathname.startsWith("/pl") ? "pl" : "en";
  const attribution = getStoredAttribution();

  return {
    page: pathname,
    locale,
    campaign: attribution?.campaign ?? null,
    source: attribution?.source ?? null,
    medium: attribution?.medium ?? null,
    referrer: attribution?.referrer ?? null,
  };
}
