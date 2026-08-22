const VISITOR_ID_KEY = "ccs_experiment_visitor_id";

/**
 * Lazily creates a random per-browser id used ONLY as a bucketing input -
 * it is never sent to any analytics provider by itself; it only ever
 * appears hashed together with an experiment id inside `assignVariant()`.
 * Created on first read rather than on every page load, so nothing writes
 * to storage while zero experiments call this (brief §21 staging: no live
 * experiments run yet).
 */
export function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    // Storage unavailable (private mode, disabled storage, etc.) - bucketing
    // just falls back to the control variant every time; never throws.
    return "";
  }
}
