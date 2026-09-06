import type { AiCompletionRequest, AiCompletionResult, ContentAiProvider } from "../types/contentAi";

/**
 * Anthropic Messages API — raw `fetch`, no SDK dependency, same
 * convention as `src/lib/crm/HubSpotProvider.ts` and the Checkpoint 6
 * search providers. Silent no-op (`isConfigured()` false) until
 * `ANTHROPIC_API_KEY` is set.
 *
 * Model and max-output-tokens are both env-configurable
 * (`CONTENT_AI_MODEL`, `CONTENT_AI_MAX_OUTPUT_TOKENS`) rather than
 * hardcoded, since both are exactly the kind of thing that changes
 * independently of this codebase (a model naming update, a deliberate
 * cost/quality tradeoff) — see `.env.example`.
 */

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_MAX_OUTPUT_TOKENS = 4000;
const API_VERSION = "2023-06-01";

type AnthropicResponse = {
	content?: { type: string; text?: string }[];
	usage?: { input_tokens?: number; output_tokens?: number };
	stop_reason?: string;
	error?: { message?: string };
};

export function createAnthropicProvider(): ContentAiProvider {
	const apiKey = process.env.ANTHROPIC_API_KEY;
	const model = process.env.CONTENT_AI_MODEL || DEFAULT_MODEL;

	return {
		id: "anthropic",
		model,
		isConfigured: () => Boolean(apiKey),

		async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
			if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");

			const maxTokens = Math.min(
				request.maxTokens,
				Number(process.env.CONTENT_AI_MAX_OUTPUT_TOKENS) || DEFAULT_MAX_OUTPUT_TOKENS,
			);

			const res = await fetch("https://api.anthropic.com/v1/messages", {
				method: "POST",
				headers: {
					"x-api-key": apiKey,
					"anthropic-version": API_VERSION,
					"content-type": "application/json",
				},
				body: JSON.stringify({
					model,
					max_tokens: maxTokens,
					system: request.system,
					messages: [{ role: "user", content: request.prompt }],
				}),
			});

			const data = (await res.json().catch(() => ({}))) as AnthropicResponse;

			if (!res.ok) {
				throw new Error(`Anthropic API error (${res.status}): ${data.error?.message ?? "unknown error"}`);
			}

			const text = (data.content ?? [])
				.filter((block) => block.type === "text" && typeof block.text === "string")
				.map((block) => block.text)
				.join("\n");

			if (!text) throw new Error("Anthropic API returned no text content.");

			return {
				text,
				inputTokens: data.usage?.input_tokens ?? 0,
				outputTokens: data.usage?.output_tokens ?? 0,
				stopReason: data.stop_reason,
			};
		},
	};
}
