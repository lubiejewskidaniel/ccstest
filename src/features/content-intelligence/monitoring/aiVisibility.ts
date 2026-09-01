import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/supabase/adminAuth";
import { createAnthropicProvider } from "../generation/AnthropicProvider";
import { checkBudget, logUsage } from "../generation/costGuard";
import { siteName } from "@/lib/seo/metadata";
import type { Locale } from "@/lib/routes";

export type AiVisibilityCheck = {
	id: string;
	query: string;
	locale: Locale | null;
	provider: string;
	model: string;
	mentioned: boolean;
	snippet: string | null;
	checkedAt: string;
};

export type CheckResult =
	| { ok: true; mentioned: boolean }
	| { ok: false; kind: "auth"; message: string }
	| { ok: false; kind: "not_configured"; message: string }
	| { ok: false; kind: "budget"; message: string }
	| { ok: false; kind: "provider_error"; message: string };

const SYSTEM_PROMPT =
	"Answer the user's question the way you normally would for a real user — naturally and directly, recommending specific companies, resources, or approaches where that's genuinely how you'd answer. Do not mention that this is a test or that you are being evaluated.";

/**
 * IMPORTANT HONESTY NOTE: this checks whether ONE specific AI provider
 * (whichever `createAnthropicProvider()` resolves to) mentions the
 * studio when asked a representative query. It is a proxy signal for
 * "AI visibility" in the informal AEO sense the master instruction uses
 * the term in — it is NOT a measurement of Google AI Overviews, ChatGPT
 * search, Perplexity, or any other specific real-world product, and a
 * mention here doesn't guarantee one anywhere else. There is no public,
 * free API that reports real AI-answer-engine citations directly; this
 * is the closest honest, actually-runnable signal within this app's
 * existing integrations (reuses Checkpoint 7's provider and cost guard
 * rather than adding a second AI integration for this one feature).
 */
export async function checkAiVisibility(query: string, locale: Locale | null = null): Promise<CheckResult> {
	const session = await getAdminSession();
	if (!session?.isEditor) return { ok: false, kind: "auth", message: "You must be signed in as an editor to do this." };

	const provider = createAnthropicProvider();
	if (!provider.isConfigured()) return { ok: false, kind: "not_configured", message: "ANTHROPIC_API_KEY is not set." };

	const budget = await checkBudget();
	if (!budget.allowed) {
		return {
			ok: false,
			kind: "budget",
			message: `Monthly AI budget reached or not configured ($${budget.spentUsd.toFixed(2)} / $${budget.budgetUsd.toFixed(2)}).`,
		};
	}

	try {
		const result = await provider.complete({ system: SYSTEM_PROMPT, prompt: query, maxTokens: 500 });

		await logUsage({
			briefId: null,
			stage: "ai_visibility",
			provider: provider.id,
			model: provider.model,
			inputTokens: result.inputTokens,
			outputTokens: result.outputTokens,
		});

		const mentioned = result.text.toLowerCase().includes(siteName.toLowerCase());
		const snippetIndex = mentioned ? result.text.toLowerCase().indexOf(siteName.toLowerCase()) : 0;
		const snippet = result.text.slice(Math.max(0, snippetIndex - 80), snippetIndex + 160).trim();

		const supabase = await createSupabaseServerClient();
		if (supabase) {
			await supabase.from("ai_visibility_checks").insert({
				query,
				locale,
				provider: provider.id,
				model: provider.model,
				mentioned,
				snippet: snippet || null,
			});
		}

		return { ok: true, mentioned };
	} catch (err) {
		return { ok: false, kind: "provider_error", message: err instanceof Error ? err.message : String(err) };
	}
}

export async function listAiVisibilityChecks(limit = 30): Promise<AiVisibilityCheck[]> {
	const supabase = await createSupabaseServerClient();
	if (!supabase) return [];

	const { data } = await supabase
		.from("ai_visibility_checks")
		.select("*")
		.order("checked_at", { ascending: false })
		.limit(limit);

	return (data ?? []).map((row) => ({
		id: row.id,
		query: row.query,
		locale: row.locale,
		provider: row.provider,
		model: row.model,
		mentioned: row.mentioned,
		snippet: row.snippet,
		checkedAt: row.checked_at,
	}));
}
