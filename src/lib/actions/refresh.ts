"use server";

import { revalidatePath } from "next/cache";
import { evaluateRefresh } from "@/features/content-intelligence/refresh/refreshLog";
import type { EvaluateRefreshResult } from "@/features/content-intelligence/refresh/refreshLog";

/**
 * Manual only -- no cron, no auto-evaluate on page load. A click here is
 * the only thing that can move a refresh episode out of "pending".
 */
export async function evaluateRefreshAction(refreshLogId: string): Promise<EvaluateRefreshResult> {
	const result = await evaluateRefresh(refreshLogId);
	if (result.ok) revalidatePath("/admin/insights/refresh");
	return result;
}
