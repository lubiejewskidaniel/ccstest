import type { EvidenceTone } from "./marketOpportunityPresentation";
import styles from "./EvidenceBadge.module.css";

/**
 * Generic evidence-state badge for the market opportunity inspector —
 * follows `StatusBadge.tsx`'s existing `data-*` attribute + CSS Module
 * pattern (see `src/features/insights/cms/StatusBadge.tsx`) rather than
 * inventing a new badge mechanism.
 *
 * Deliberately generic over a small `tone` vocabulary
 * (positive/neutral/attention/muted) instead of one badge component per
 * evidence dimension (direction, confidence, relevance, coverage, match
 * kind) — same visual language, far fewer files. "attention" means
 * "notice this", never "error"/"failure": a declining market trend is
 * `tone="attention"`, exactly like a volatile one, never a red/error
 * treatment (see `marketOpportunityPresentation.ts`'s `DIRECTION_TONE`).
 */
export function EvidenceBadge({ label, tone }: { label: string; tone: EvidenceTone }) {
	return (
		<span className={styles.badge} data-tone={tone}>
			{label}
		</span>
	);
}
