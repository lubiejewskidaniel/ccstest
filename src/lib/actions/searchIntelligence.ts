"use server";

import { revalidatePath } from "next/cache";
import { ingestSearchPerformance, type IngestResult } from "@/features/content-intelligence/keywords/ingest";
import { recomputeOpportunities, type RecomputeResult } from "@/features/content-intelligence/opportunities/recompute";
import {
	setOpportunityStatus,
	type OpportunityActionResult,
	type OpportunityStatus,
} from "@/features/content-intelligence/opportunities/actions";

const OPPORTUNITIES_PATH = "/admin/insights/opportunities";

export async function ingestSearchPerformanceAction(): Promise<IngestResult> {
	const result = await ingestSearchPerformance();
	if (result.ok) revalidatePath(OPPORTUNITIES_PATH);
	return result;
}

export async function recomputeOpportunitiesAction(): Promise<RecomputeResult> {
	const result = await recomputeOpportunities();
	if (result.ok) revalidatePath(OPPORTUNITIES_PATH);
	return result;
}

export async function setOpportunityStatusAction(id: string, status: OpportunityStatus): Promise<OpportunityActionResult> {
	const result = await setOpportunityStatus(id, status);
	if (result.ok) revalidatePath(OPPORTUNITIES_PATH);
	return result;
}
