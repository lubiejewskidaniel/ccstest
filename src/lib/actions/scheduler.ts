"use server";

import { getNextPublishSlot } from "@/features/insights/publishing/cadence";

/**
 * Computes the cadence-respecting next publish slot
 * (`src/features/insights/publishing/cadence.ts`, unchanged) without
 * applying anything — `ArticleStatusActions.tsx` calls this to show an
 * editor the exact resolved date/time in a confirmation step, then
 * applies that *exact same* previewed ISO instant via the normal
 * `setArticleStatusAction("scheduled", iso)` path
 * (`lib/actions/insightsCms.ts`) on confirm.
 *
 * Deliberately not "compute and apply" in one step (an earlier version
 * of this file did that): re-computing the slot again at confirm time
 * instead of reusing the previewed one could resolve to a different
 * moment than what the editor just confirmed, if the "latest anchor"
 * changed in between (e.g. another editor scheduled something else).
 * Applying the previewed instant directly removes that race entirely.
 */
export async function previewNextPublishSlotAction(): Promise<string> {
	return getNextPublishSlot();
}
