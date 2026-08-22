"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { events, getBaseContext } from "@/lib/analytics";
import { assignVariant } from "./bucketing";
import { getOrCreateVisitorId } from "./visitorId";
import type { ExperimentConfig } from "./types";

/**
 * Client hook for a future live experiment. NOT called from anywhere in
 * this app yet - brief §21: "Do not launch extensive A/B testing
 * immediately... do not start A/B testing before baseline measurement is
 * reliable." This exists so that once that baseline exists, adding a real
 * experiment is a small, contained change (call this hook, branch on the
 * returned variant) rather than new infrastructure - see
 * docs/EXPERIMENTATION.md for the intended rollout sequence.
 *
 * Returns `config.variants[0]` (control) synchronously during SSR and on
 * the very first client render, then the real deterministic bucket after
 * mount. That two-phase render is deliberate: the real bucket needs
 * `localStorage`, which isn't available during SSR, and assigning it
 * during the initial render would make server and client markup disagree.
 * Fires `experiment_view` once per mount, after the real variant is known.
 */
export function useExperiment(config: ExperimentConfig): string {
  const pathname = usePathname();
  const [variant, setVariant] = useState<string>(config.variants[0] ?? "control");

  useEffect(() => {
    const visitorId = getOrCreateVisitorId();
    const assigned = assignVariant(config, visitorId);
    // Bucketing needs localStorage (via getOrCreateVisitorId), which isn't
    // available during SSR - this can't be a lazy useState initializer, or
    // the server-rendered `variant` (always the control) would disagree
    // with a returning visitor's real bucket on the client and cause a
    // hydration mismatch. See the two-phase-render note in this hook's doc
    // comment above.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVariant(assigned);
    events.experimentView(config.id, assigned, getBaseContext(pathname));
    // Re-runs only if the experiment id itself changes - a route change
    // alone shouldn't re-bucket the visitor or re-fire the view event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.id]);

  return variant;
}

/**
 * Records a conversion for the current visitor's assigned variant. Call
 * this from the CTA/action a live experiment is measuring - never from a
 * page-load effect (a conversion is something the visitor did, not
 * something that happened to them).
 */
export function trackExperimentConversion(experimentId: string, variant: string, pathname: string) {
  events.experimentConversion(experimentId, variant, getBaseContext(pathname));
}
