/**
 * Experimentation readiness scaffold (brief §21, Phase 6 groundwork only).
 * No live experiments run yet - nothing in the app currently calls
 * `useExperiment`. See docs/EXPERIMENTATION.md for what "reliable baseline
 * measurement" means here and the intended rollout sequence.
 */
export type { ExperimentConfig } from "./types";
export { assignVariant, hashString } from "./bucketing";
export { getOrCreateVisitorId } from "./visitorId";
export { useExperiment, trackExperimentConversion } from "./useExperiment";
