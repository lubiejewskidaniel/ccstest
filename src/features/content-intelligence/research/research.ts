import { getAdminSession } from "@/lib/supabase/adminAuth";
import { getBrief, updateBriefRow } from "../briefs/service";
import { createAnthropicProvider } from "../generation/AnthropicProvider";
import { checkBudget, estimateCostUsd, logUsage } from "../generation/costGuard";
import { recordAiOperationEvent } from "../events/aiOperationEventWriter";
import type { AiCompletionResult, StageResult, TextAiOperationOptions } from "../types/contentAi";

export type { StageResult };


const SYSTEM_PROMPT = `You are a research assistant for a software consulting studio's engineering blog. You produce a short, honest research brief — an outline and a list of concrete angles/points to cover — for a human editor and an AI writer to use. You never invent statistics, case studies, named sources, or quotes. When you don't have verified facts, say so and suggest what a human should verify before publishing, rather than fabricating something plausible-sounding.`;

function buildPrompt(topic: string, keyPoints: string | null, category: string): string {
	return [
		`Topic: ${topic}`,
		`Content pillar / category: ${category}`,
		keyPoints ? `Editor's starting notes:\n${keyPoints}` : null,
		"",
		"Produce a short research brief covering:",
		"1. The 3-5 most important angles or subtopics to address, and why each matters to the target reader (a technical or business decision-maker).",
		"2. Any claims, statistics, or specific facts a human should verify before they appear in the article (do not state them as fact yourself).",
		"3. A one-sentence recommendation for the article's overall angle or thesis.",
		"",
		"Keep it under 300 words, plain text, no markdown headers.",
	]
		.filter(Boolean)
		.join("\n");
}

/**
 * Stage 1 of the pipeline: AI-generated research notes, stored on the
 * brief for the generation stage to use as grounding context. This is
 * the only stage that runs before any structured content exists — its
 * output is prose notes, not something validated against
 * `articleBodySchema` (that validation starts at the generation stage).
 */
export async function runResearch(briefId: string, categoryName: string, options: TextAiOperationOptions = {}): Promise<StageResult> {
	const executionMode = options.executionMode ?? "manual";
	const runId = options.runId ?? null;

	const session = await getAdminSession();
	if (!session?.isEditor) return { ok: false, kind: "auth", message: "You must be signed in as an editor to do this." };

	const brief = await getBrief(briefId);
	if (!brief) return { ok: false, kind: "not_found", message: "Brief not found." };

	const provider = createAnthropicProvider();
	if (!provider.isConfigured()) {
		return { ok: false, kind: "not_configured", message: "ANTHROPIC_API_KEY is not set." };
	}

	const budget = await checkBudget();
	if (!budget.allowed) {
		return {
			ok: false,
			kind: "budget",
			message: `Monthly AI budget reached or not configured ($${budget.spentUsd.toFixed(2)} / $${budget.budgetUsd.toFixed(2)}). Set CONTENT_AI_MONTHLY_BUDGET_USD to raise it.`,
		};
	}

	await updateBriefRow(briefId, { status: "researching" });

	try {
		const startedAt = performance.now();
		let result: AiCompletionResult;
		try {
			result = await provider.complete({
				system: SYSTEM_PROMPT,
				prompt: buildPrompt(brief.topic, brief.keyPoints, categoryName),
				maxTokens: 800,
			});
		} catch (err) {
			// Best-effort observability only: a logging failure here must
			// never mask the real provider error re-thrown below, and the
			// re-throw is what keeps the existing catch block's behaviour
			// (status update, message, StageResult shape) unchanged.
			try {
				await recordAiOperationEvent({
					briefId,
					stage: "research",
					operationType: "research",
					provider: provider.id,
					model: provider.model,
					executionMode,
					runId,
					inputTokens: 0,
					outputTokens: 0,
					cost: null,
					costBasis: null,
					durationMs: Math.round(performance.now() - startedAt),
					outcome: "failure",
					errorKind: "provider_error",
				});
			} catch {
				// Ignored -- see comment above.
			}
			throw err;
		}
		const durationMs = Math.round(performance.now() - startedAt);

		await logUsage({
			briefId,
			stage: "research",
			provider: provider.id,
			model: provider.model,
			inputTokens: result.inputTokens,
			outputTokens: result.outputTokens,
		});

		try {
			await recordAiOperationEvent({
				briefId,
				stage: "research",
				operationType: "research",
				provider: provider.id,
				model: provider.model,
				executionMode,
				runId,
				inputTokens: result.inputTokens,
				outputTokens: result.outputTokens,
				cost: estimateCostUsd(result.inputTokens, result.outputTokens),
				costBasis: "estimated",
				durationMs,
				outcome: "success",
				errorKind: null,
			});
		} catch {
			// Best-effort observability only -- the research notes below
			// were already produced and are saved regardless.
		}

		await updateBriefRow(briefId, { status: "researched", research_notes: result.text, error_message: null });
		return { ok: true };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await updateBriefRow(briefId, { status: "failed", error_message: message });
		return { ok: false, kind: "provider_error", message };
	}
}
