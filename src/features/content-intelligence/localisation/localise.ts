import { getAdminSession } from "@/lib/supabase/adminAuth";
import { getBrief, updateBriefRow } from "../briefs/service";
import { createAnthropicProvider } from "../generation/AnthropicProvider";
import { checkBudget, logUsage } from "../generation/costGuard";
import { slugify } from "../generation/slugify";
import { articleBodySchema } from "@/features/insights/types/blocks";
import type { Locale } from "@/lib/routes";
import type { StageResult } from "../types/contentAi";

const LOCALE_NAME: Record<Locale, string> = { en: "English", pl: "Polish" };

const SYSTEM_PROMPT = `You translate technical blog articles for a software consulting studio. You translate naturally and idiomatically, not word-for-word — the result must read like it was written by a native speaker in the target language, not translated. You NEVER add, remove, or reorder content, and you never change facts, numbers, code, or URLs. Code block contents and "language"/"filename" fields are left completely untranslated.

You MUST respond with ONLY a single JSON object, no markdown fences, no commentary, matching exactly this shape:

{
  "title": "translated string",
  "excerpt": "translated string",
  "body": [ /* the exact same array of blocks as the input, with every human-readable text field translated and everything else (type, level, style, language, filename, code) left unchanged */ ]
}`;

function buildPrompt(targetLanguage: string, title: string, excerpt: string, body: unknown): string {
	return [
		`Translate the following article into ${targetLanguage}.`,
		"",
		JSON.stringify({ title, excerpt, body }, null, 2),
	].join("\n");
}

/**
 * Stage 3: translates the generated draft into the brief's other locale.
 * Re-validates the translated body against the exact same
 * `articleBodySchema` as generation — a translation that drops a
 * required field or invents a new block type fails this stage the same
 * way a malformed generation would, rather than silently degrading.
 */
export async function runLocalisation(briefId: string): Promise<StageResult> {
	const session = await getAdminSession();
	if (!session?.isEditor) return { ok: false, kind: "auth", message: "You must be signed in as an editor to do this." };

	const brief = await getBrief(briefId);
	if (!brief) return { ok: false, kind: "not_found", message: "Brief not found." };
	if (!brief.generated) return { ok: false, kind: "validation", message: "Run generation before localisation." };

	const targetLocale: Locale = brief.primaryLocale === "en" ? "pl" : "en";

	const provider = createAnthropicProvider();
	if (!provider.isConfigured()) return { ok: false, kind: "not_configured", message: "ANTHROPIC_API_KEY is not set." };

	const budget = await checkBudget();
	if (!budget.allowed) {
		return {
			ok: false,
			kind: "budget",
			message: `Monthly AI budget reached or not configured ($${budget.spentUsd.toFixed(2)} / $${budget.budgetUsd.toFixed(2)}). Set CONTENT_AI_MONTHLY_BUDGET_USD to raise it.`,
		};
	}

	await updateBriefRow(briefId, { status: "localising" });

	try {
		const result = await provider.complete({
			system: SYSTEM_PROMPT,
			prompt: buildPrompt(LOCALE_NAME[targetLocale], brief.generated.title, brief.generated.excerpt, brief.generated.body),
			maxTokens: 3500,
		});

		await logUsage({
			briefId,
			stage: "localisation",
			provider: provider.id,
			model: provider.model,
			inputTokens: result.inputTokens,
			outputTokens: result.outputTokens,
		});

		let parsed: unknown;
		try {
			const cleaned = result.text.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
			parsed = JSON.parse(cleaned);
		} catch {
			throw new Error("Translation response was not valid JSON.");
		}

		if (typeof parsed !== "object" || parsed === null) throw new Error("Translation response was not a JSON object.");
		const raw = parsed as { title?: unknown; excerpt?: unknown; body?: unknown };
		if (typeof raw.title !== "string" || typeof raw.excerpt !== "string" || !Array.isArray(raw.body)) {
			throw new Error("Translation response is missing title, excerpt, or body.");
		}

		const bodyResult = articleBodySchema.safeParse(raw.body);
		if (!bodyResult.success) {
			throw new Error(`Translated content failed block validation: ${bodyResult.error.issues[0]?.message ?? "invalid shape"}`);
		}

		const title = raw.title.trim();
		const excerpt = raw.excerpt.trim();
		const slug = slugify(title);

		if (title.length < 3 || title.length > 200) throw new Error("Translated title is outside the allowed length.");
		if (excerpt.length < 20 || excerpt.length > 400) throw new Error("Translated excerpt is outside the allowed length.");
		if (!slug) throw new Error("Translated title produced an empty slug.");

		await updateBriefRow(briefId, {
			status: "localised",
			localized_locale: targetLocale,
			localized_title: title,
			localized_excerpt: excerpt,
			localized_slug: slug,
			localized_body: bodyResult.data,
			error_message: null,
		});

		return { ok: true };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await updateBriefRow(briefId, { status: "failed", error_message: message });
		return { ok: false, kind: "provider_error", message };
	}
}
