"use server";

import { revalidatePath } from "next/cache";
import { createBrief, getBrief, type BriefResult } from "@/features/content-intelligence/briefs/service";
import { runResearch } from "@/features/content-intelligence/research/research";
import { runGeneration } from "@/features/content-intelligence/generation/generate";
import { runLocalisation } from "@/features/content-intelligence/localisation/localise";
import { runQualityCheck } from "@/features/content-intelligence/quality/qualityGate";
import { promoteToArticles } from "@/features/content-intelligence/briefs/promote";
import { listCategories } from "@/features/insights/data/queries";
import type { StageResult } from "@/features/content-intelligence/types/contentAi";

/**
 * Server Actions - the form/button-facing transport for the AI editorial
 * pipeline, mirroring the shape of every other actions file in this app
 * (leads, Insights CMS, search intelligence): thin adapters over the
 * real logic in `src/features/content-intelligence/**`, nothing more.
 */

async function categoryNameFor(categoryId: string, locale: "en" | "pl"): Promise<string> {
	const categories = await listCategories(locale);
	return categories.find((category) => category.id === categoryId)?.name ?? "General";
}

export async function createBriefAction(_prevState: unknown, formData: FormData): Promise<BriefResult> {
	const result = await createBrief({
		opportunityId: formData.get("opportunityId") ?? "",
		primaryLocale: formData.get("primaryLocale"),
		categoryId: formData.get("categoryId"),
		topic: formData.get("topic"),
		keyPoints: formData.get("keyPoints") ?? "",
	});
	if (result.ok) revalidatePath("/admin/insights/briefs");
	return result;
}

export async function runResearchAction(briefId: string): Promise<StageResult> {
	const brief = await getBrief(briefId);
	if (!brief) return { ok: false, kind: "not_found", message: "Brief not found." };
	const categoryName = await categoryNameFor(brief.categoryId, brief.primaryLocale);
	const result = await runResearch(briefId, categoryName);
	revalidatePath(`/admin/insights/briefs/${briefId}`);
	return result;
}

export async function runGenerationAction(briefId: string): Promise<StageResult> {
	const brief = await getBrief(briefId);
	if (!brief) return { ok: false, kind: "not_found", message: "Brief not found." };
	const categoryName = await categoryNameFor(brief.categoryId, brief.primaryLocale);
	const result = await runGeneration(briefId, categoryName);
	revalidatePath(`/admin/insights/briefs/${briefId}`);
	return result;
}

export async function runLocalisationAction(briefId: string): Promise<StageResult> {
	const result = await runLocalisation(briefId);
	revalidatePath(`/admin/insights/briefs/${briefId}`);
	return result;
}

export async function runQualityCheckAction(briefId: string): Promise<StageResult> {
	const result = await runQualityCheck(briefId);
	revalidatePath(`/admin/insights/briefs/${briefId}`);
	return result;
}

export async function promoteToArticlesAction(briefId: string): Promise<StageResult> {
	const result = await promoteToArticles(briefId);
	revalidatePath(`/admin/insights/briefs/${briefId}`);
	revalidatePath("/admin/insights");
	return result;
}
