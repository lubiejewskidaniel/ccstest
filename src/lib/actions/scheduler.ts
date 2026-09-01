"use server";

import { revalidatePath } from "next/cache";
import { getNextPublishSlot } from "@/features/insights/publishing/cadence";
import { transitionArticleStatus } from "@/features/insights/cms/service";
import { routes } from "@/lib/routes";
import { articlePath } from "@/features/insights/seo/paths";

/**
 * Editor-facing counterpart to the cron scheduler
 * (`src/app/api/v1/scheduler/publish/route.ts`): a signed-in editor
 * clicking "Schedule for next slot" in the admin UI reuses the exact
 * same session-checked, validated `transitionArticleStatus()` from
 * Checkpoint 3's CMS — this file only adds the cadence calculation in
 * front of it, it does not duplicate or bypass that write path the way
 * the cron route's service-role client necessarily does (that route has
 * no editor session to check in the first place).
 */
export async function scheduleAtNextSlotAction(args: { id: string; locale: "en" | "pl"; slug: string }) {
	const scheduledAt = await getNextPublishSlot();
	const result = await transitionArticleStatus({ id: args.id, status: "scheduled", scheduledAt });

	if (result.ok) {
		revalidatePath(routes.insights[args.locale]);
		revalidatePath(articlePath(args.slug, args.locale));
	}

	return result;
}
