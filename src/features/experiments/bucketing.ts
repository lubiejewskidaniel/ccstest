import type { ExperimentConfig } from "./types";

/**
 * FNV-1a - small, dependency-free, deterministic. Not cryptographic; fine
 * for bucketing traffic into experiment variants, not for anything
 * security-sensitive.
 */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Deterministically maps (experiment id, visitor id) to one of
 * `config.variants` - the same pair always yields the same variant, so a
 * returning visitor keeps a consistent experience across sessions (brief
 * §21 "stable bucketing per visitor/session") without a server-side
 * assignment table to keep in sync. Pure function - no `localStorage`/
 * `window` access - so it's directly unit-testable (see Task #28).
 */
export function assignVariant(config: ExperimentConfig, visitorId: string): string {
  const first = config.variants[0] ?? "control";
  if (!visitorId || config.variants.length === 0) return first;
  const bucket = hashString(`${config.id}:${visitorId}`) % config.variants.length;
  return config.variants[bucket] ?? first;
}
