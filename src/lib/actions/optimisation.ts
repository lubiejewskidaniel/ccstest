"use server";

import { revalidatePath } from "next/cache";
import { checkAiVisibility, type CheckResult } from "@/features/content-intelligence/monitoring/aiVisibility";
import { recomputeScoringCalibration, type CalibrationResult } from "@/features/content-intelligence/learning/calibration";
import type { Locale } from "@/lib/routes";

const AI_VISIBILITY_PATH = "/admin/insights/ai-visibility";

export async function runAiVisibilityCheckAction(query: string, locale: Locale | null): Promise<CheckResult> {
	const result = await checkAiVisibility(query, locale);
	if (result.ok) revalidatePath(AI_VISIBILITY_PATH);
	return result;
}

export async function recomputeCalibrationAction(): Promise<CalibrationResult> {
	return recomputeScoringCalibration();
}
