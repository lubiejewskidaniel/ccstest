import { getAdminSession } from "@/lib/supabase/adminAuth";
import { getBrief, updateBriefRow } from "../briefs/service";
import { createAnthropicProvider } from "./AnthropicProvider";
import { checkBudget, logUsage } from "./costGuard";
import { slugify } from "./slugify";
import { articleBodySchema, type ContentBlock } from "@/features/insights/types/blocks";
import type { StageResult } from "../types/contentAi";

const SYSTEM_PROMPT = `You are a senior software engineer writing for a code consulting studio's engineering blog. Voice: calm, technical, honest, no hype, no invented statistics, no fake case studies, no fabricated quotes or named sources. If something would need a citation, describe it generally instead of inventing a specific number or source. Write like you're explaining it to a competent client, not writing SEO filler.

You MUST respond with ONLY a single JSON object, no markdown fences, no commentary before or after, matching exactly this shape:

{
  "title": "string, 10-100 characters",
  "excerpt": "string, 40-300 characters, a one or two sentence summary",
  "body": [
    { "type": "paragraph", "text": "string" },
    { "type": "heading", "level": 2, "text": "string" },
    { "type": "list", "style": "unordered", "items": ["string", "string"] },
    { "type": "callout", "variant": "info", "text": "string" },
    { "type": "quote", "text": "string" },
    { "type": "code", "code": "string", "language": "string (optional)" }
  ]
}

Rules:
- "body" must have between 6 and 20 blocks, in reading order.
- Do NOT use an "image" block type — no real image exists to reference.
- Do NOT include an "id" field on heading blocks — it is generated separately.
- Include at least 2 "heading" blocks (level 2) to structure the article.
- Never fabricate specific statistics, percentages, named clients, or quotes attributed to real people.`;

function buildPrompt(topic: string, researchNotes: string | null, categoryName: string, keyPoints: string | null): string {
	return [
		`Topic: ${topic}`,
		`Content pillar / category: ${categoryName}`,
		keyPoints ? `Editor's starting notes:\n${keyPoints}` : null,
		researchNotes ? `Research notes to ground the article (verify anything specific before publishing):\n${researchNotes}` : null,
		"",
		"Write the full article now, following the required JSON shape exactly.",
	]
		.filter(Boolean)
		.join("\n");
}

/** Best-effort strip of markdown code fences, in case the model wraps
 * its JSON in ```json fences despite the system prompt saying not to —
 * models don't always follow formatting instructions exactly, and this
 * costs nothing to guard against. */
function stripCodeFences(text: string): string {
	const trimmed = text.trim();
	const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
	return fenced?.[1] ?? trimmed;
}

/** Assigns a stable, unique anchor id to every heading block — never
 * trusts the model for this field (the system prompt explicitly tells it
 * not to provide one), so heading ids can't collide or contain invalid
 * characters regardless of model output quality. */
function assignHeadingIds(blocks: ContentBlock[]): ContentBlock[] {
	const seen = new Map<string, number>();
	return blocks.map((block) => {
		if (block.type !== "heading") return block;
		const base = slugify(block.text) || "section";
		const count = seen.get(base) ?? 0;
		seen.set(base, count + 1);
		const id = count === 0 ? base : `${base}-${count}`;
		return { ...block, id };
	});
}

/**
 * Stage 2: the actual draft. Parses the model's JSON response, strips
 * any disallowed block types (image — no real asset exists), assigns
 * heading ids deterministically, then validates the whole body against
 * `articleBodySchema` — the exact same schema the human CMS editor's
 * JSON textarea is validated against (docs/INSIGHTS_ARCHITECTURE.md §10
 * decision 2). A malformed or non-conforming model response fails this
 * stage with a clear, recorded error rather than ever reaching
 * insights_articles.
 */
export async function runGeneration(briefId: string, categoryName: string): Promise<StageResult> {
	const session = await getAdminSession();
	if (!session?.isEditor) return { ok: false, kind: "auth", message: "You must be signed in as an editor to do this." };

	const brief = await getBrief(briefId);
	if (!brief) return { ok: false, kind: "not_found", message: "Brief not found." };

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

	await updateBriefRow(briefId, { status: "generating" });

	try {
		const result = await provider.complete({
			system: SYSTEM_PROMPT,
			prompt: buildPrompt(brief.topic, brief.researchNotes, categoryName, brief.keyPoints),
			maxTokens: 3000,
		});

		await logUsage({
			briefId,
			stage: "generation",
			provider: provider.id,
			model: provider.model,
			inputTokens: result.inputTokens,
			outputTokens: result.outputTokens,
		});

		let parsed: unknown;
		try {
			parsed = JSON.parse(stripCodeFences(result.text));
		} catch {
			throw new Error("Model response was not valid JSON.");
		}

		if (typeof parsed !== "object" || parsed === null) throw new Error("Model response was not a JSON object.");
		const raw = parsed as { title?: unknown; excerpt?: unknown; body?: unknown };

		if (typeof raw.title !== "string" || typeof raw.excerpt !== "string" || !Array.isArray(raw.body)) {
			throw new Error("Model response is missing title, excerpt, or body.");
		}

		// Drop any "image" blocks the model produced despite the system
		// prompt — no real asset exists, and a fabricated image URL/alt
		// text is exactly the kind of thing the quality gate must never
		// see pass through.
		const withoutImages = (raw.body as unknown[]).filter(
			(block) => typeof block === "object" && block !== null && (block as { type?: unknown }).type !== "image",
		);

		const withHeadingIds = assignHeadingIds(withoutImages as ContentBlock[]);

		const bodyResult = articleBodySchema.safeParse(withHeadingIds);
		if (!bodyResult.success) {
			throw new Error(`Generated content failed block validation: ${bodyResult.error.issues[0]?.message ?? "invalid shape"}`);
		}

		const title = raw.title.trim();
		const excerpt = raw.excerpt.trim();
		const slug = slugify(title);

		if (title.length < 3 || title.length > 200) throw new Error("Generated title is outside the allowed length.");
		if (excerpt.length < 20 || excerpt.length > 400) throw new Error("Generated excerpt is outside the allowed length.");
		if (!slug) throw new Error("Generated title produced an empty slug.");

		await updateBriefRow(briefId, {
			status: "generated",
			generated_title: title,
			generated_excerpt: excerpt,
			generated_slug: slug,
			generated_body: bodyResult.data,
			error_message: null,
		});

		return { ok: true };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await updateBriefRow(briefId, { status: "failed", error_message: message });
		return { ok: false, kind: "provider_error", message };
	}
}
