import { UTM_PARAM_KEYS, type AttributionData } from "./types";

const STORAGE_KEY = "ccs-attribution";

/**
 * Pure - no `window` access - so this is unit-testable without a DOM
 * (see `src/features/attribution/__tests__/parseUtm.test.ts`).
 */
export function parseUtmParams(search: string): Pick<AttributionData, "source" | "medium" | "campaign" | "content" | "term"> {
  const params = new URLSearchParams(search);
  return {
    source: params.get("utm_source"),
    medium: params.get("utm_medium"),
    campaign: params.get("utm_campaign"),
    content: params.get("utm_content"),
    term: params.get("utm_term"),
  };
}

export function hasUtmParams(search: string): boolean {
  const params = new URLSearchParams(search);
  return UTM_PARAM_KEYS.some((key) => params.has(key));
}

export function getStoredAttribution(): AttributionData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AttributionData;
  } catch {
    return null;
  }
}

function storeAttribution(data: AttributionData) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable (private mode, quota) - attribution is
    // best-effort, never block the visit or a form submission over it.
  }
}

/**
 * First-touch capture: only writes when nothing is stored yet, OR the
 * current URL carries a fresh set of UTM params (a new campaign click
 * should be able to re-attribute an otherwise-unidentified prior visit -
 * but a plain repeat visit with no UTM params must never overwrite the
 * original first touch). Call once, on mount, from `<AttributionCapture />`.
 */
export function captureFirstTouchAttribution(location: { search: string; pathname: string }, referrer: string) {
  const existing = getStoredAttribution();
  const incomingHasUtm = hasUtmParams(location.search);

  if (existing && !incomingHasUtm) return existing;

  const parsed = parseUtmParams(location.search);
  const data: AttributionData = {
    source: parsed.source ?? existing?.source ?? (referrer ? new URL(referrer).hostname : "direct"),
    medium: parsed.medium ?? existing?.medium ?? (referrer ? "referral" : "none"),
    campaign: parsed.campaign ?? existing?.campaign ?? null,
    content: parsed.content ?? existing?.content ?? null,
    term: parsed.term ?? existing?.term ?? null,
    referrer: existing?.referrer ?? referrer ?? null,
    landingPage: existing?.landingPage ?? location.pathname,
    capturedAt: existing?.capturedAt ?? new Date().toISOString(),
  };

  storeAttribution(data);
  return data;
}
