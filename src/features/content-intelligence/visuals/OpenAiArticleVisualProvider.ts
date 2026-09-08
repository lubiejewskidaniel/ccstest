import type { CategoryKey } from "@/features/insights/types/article";
import type { ArticleVisualBrief } from "./articleVisualBrief";
import type {
	ArticleVisualGenerationOptions,
	ArticleVisualProvider,
	GenerateArticleVisualResult,
	GeneratedArticleVisual,
} from "./ArticleVisualProvider";

/**
 * Phase 3C.4B.5A — first real `ArticleVisualProvider` adapter, backed by
 * OpenAI's image generation API.
 *
 * Model: `gpt-image-2` — the current default GPT image model at the
 * time this adapter was written (verified against OpenAI's own API
 * reference and model catalogue; `gpt-image-1` and `gpt-image-1.5` are
 * both marked deprecated there). Kept as a private constant — the core
 * `ArticleVisualProvider` contract has no `model` field (Phase 3C.4B.2's
 * design, reaffirmed by this phase's brief, Section 3/12) and nothing
 * here has a genuine reason to expose it further.
 *
 * Raw `fetch`, no SDK — the same convention already used by every other
 * external provider in this codebase (`AnthropicProvider.ts`,
 * `BingWebmasterProvider.ts`, `src/lib/crm/HubSpotProvider.ts`). No new
 * dependency was installed or is required for this adapter.
 *
 * This is the first module in the visual pipeline allowed to perform
 * semantic visual interpretation of an `ArticleVisualBrief` (see
 * `ArticleVisualProvider.ts`'s module doc comment for why every earlier
 * stage deliberately avoids that) — `buildPrompt()` below is that
 * interpretation. It is deliberately pure and deterministic: the same
 * brief and options always produce the same request body, so this is
 * fully unit-testable without a network call.
 *
 * Explicitly out of scope for this file (mirrors `ArticleVisualProvider.ts`'s
 * own module doc comment): Storage, approval/review state, and
 * token-based cost accounting. On cost specifically: `costGuard.ts`'s
 * budget check is shaped around per-1k-token text pricing and is not
 * called from here — this adapter never invents a token count for an
 * image call. `"budget_exceeded"` remains part of `GenerateArticleVisualResult`
 * for a future orchestration layer to use; this adapter itself never
 * returns it in Phase 3C.4B.5A. This adapter also performs no automatic
 * retries — one request in, one result out.
 *
 * Server-only: reads `process.env.OPENAI_API_KEY` and calls
 * `fetch(...)` against `api.openai.com` directly, no Supabase access,
 * no article mutation, no Storage upload — matching the same
 * server-only-by-convention shape already used by `AnthropicProvider.ts`
 * and `BingWebmasterProvider.ts` (neither of which imports the
 * `server-only` marker package either; the boundary is enforced by only
 * ever being called from already server-only code, exactly as here).
 */

const PROVIDER_ID = "openai";

const MODEL = "gpt-image-2";

const IMAGES_API_URL = "https://api.openai.com/v1/images/generations";

/**
 * Image generation can legitimately take far longer than a plain asset
 * download — a `high`-quality `gpt-image-2` request routinely takes
 * tens of seconds. 60s is generous enough for that while still bounding
 * a hung request. Deliberately NOT the 10s
 * `TEMPORARY_URL_FETCH_TIMEOUT_MS` used in `articleVisualStorageService.ts`
 * for downloading an already-generated asset — a much cheaper, faster
 * operation than generating one.
 */
const GENERATION_TIMEOUT_MS = 60_000;

/** `gpt-image-2` requires both dimensions to be a multiple of 16 (and
 * the aspect ratio to fall within 1:3..3:1, never a real concern for any
 * article-cover-shaped request this adapter receives). Rounds DOWN so
 * the generated image is never larger than what was requested, and
 * floors at 256px so a pathological tiny request can't round to zero. */
const MIN_GPT_IMAGE_DIMENSION = 256;

function roundDownToMultipleOf16(value: number): number {
	const rounded = Math.floor(value / 16) * 16;
	return Math.max(rounded, MIN_GPT_IMAGE_DIMENSION);
}

function toProviderSize(options: ArticleVisualGenerationOptions): { size: string; width: number; height: number } {
	const width = roundDownToMultipleOf16(options.width);
	const height = roundDownToMultipleOf16(options.height);
	return { size: `${width}x${height}`, width, height };
}

/** Fixed CCS V1 visual language (Phase 3C.4B.5A brief, Section 5) —
 * identical on every call, never derived from article content. */
const CCS_VISUAL_IDENTITY =
	"Premium, modern, technology-focused editorial cover illustration for a professional software consultancy blog. " +
	"Sophisticated, distinctive, conceptual visual metaphor with depth and restrained technology cues, in the style of " +
	"professional editorial illustration -- never literal stock photography. Suitable for both English and Polish " +
	"audiences. Do not include any text, letters, numbers, or words anywhere in the image. Do not depict any real " +
	"company logo, trademark, or brand mark. Avoid: smiling office teams, handshakes, people pointing at laptops, " +
	"generic stock-photo desks, floating random code characters, meaningless business charts, fake software " +
	"dashboards, neon cyberpunk cliches, and excessive literal AI/robot imagery.";

/** Per-category conceptual direction (Phase 3C.4B.5A brief, Section 6).
 * Influences only this adapter's internal prompt text -- `CategoryKey`
 * is never added to `ArticleVisualBrief` beyond the field it already
 * has. */
const CATEGORY_DIRECTION: Record<CategoryKey, string> = {
	build: "Conceptual direction: software engineering, systems and construction -- structure, precision, layered architecture.",
	grow: "Conceptual direction: visibility, growth and business momentum -- upward movement, expanding reach, forward motion.",
	learn: "Conceptual direction: clarity, knowledge and learning -- illumination, structure emerging from complexity, guided understanding.",
	studio: "Conceptual direction: creative technology, experimentation and behind-the-scenes craft -- process, iteration, hands-on making.",
};

/**
 * Pure, deterministic prompt construction. Reads only `brief.subject`,
 * `brief.categoryKey`, `brief.requiredElements` and `brief.avoidElements`
 * (plus the fixed CCS identity/category text above) -- never a raw
 * `Article`, article body, `MarketOpportunityEvidence`, `ContentBrief`,
 * or Supabase row, none of which this adapter ever receives in the
 * first place. `brief.locale` deliberately isn't interpolated into the
 * prompt text itself (the identity text above already states the
 * dual-locale audience once, fixed); it exists on `ArticleVisualBrief`
 * for other, non-visual consumers.
 */
function buildPrompt(brief: ArticleVisualBrief): string {
	const parts = [CCS_VISUAL_IDENTITY, CATEGORY_DIRECTION[brief.categoryKey], `Article subject the cover must evoke conceptually, without rendering it as text: "${brief.subject}".`];

	if (brief.requiredElements.length > 0) {
		parts.push(`Required visual elements: ${brief.requiredElements.join("; ")}.`);
	}

	if (brief.avoidElements.length > 0) {
		parts.push(`Also strictly avoid: ${brief.avoidElements.join("; ")}.`);
	}

	return parts.join(" ");
}

type OpenAiImagesSuccessResponse = {
	data?: { b64_json?: string }[];
	size?: string;
	output_format?: string;
};

type OpenAiImagesErrorResponse = {
	error?: { message?: string };
};

/** The only output format this adapter ever requests, so the response
 * MIME type is always one of these three -- never assumed, always
 * re-derived from whatever `output_format` the response actually
 * echoes back (falling back to what was requested only if the field is
 * missing). */
const MIME_BY_OUTPUT_FORMAT: Record<string, string> = {
	png: "image/png",
	jpeg: "image/jpeg",
	webp: "image/webp",
};

const REQUESTED_OUTPUT_FORMAT = "png";

function parseSize(raw: string | undefined, fallback: { width: number; height: number }): { width: number; height: number } {
	if (!raw) return fallback;
	const match = /^(\d+)x(\d+)$/.exec(raw);
	if (!match || !match[1] || !match[2]) return fallback;
	const width = Number(match[1]);
	const height = Number(match[2]);
	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return fallback;
	return { width, height };
}

/**
 * Creates the OpenAI-backed `ArticleVisualProvider`. Silent no-op
 * (`isConfigured()` false) until `OPENAI_API_KEY` is set -- same
 * "fail closed until configured" contract as every other provider in
 * this codebase. The key is read once at construction time (matching
 * `createAnthropicProvider()`/`createHubSpotProvider()`) and is never
 * logged, never included in any returned `message`, and never appears
 * anywhere in `GenerateArticleVisualResult`.
 */
export function createOpenAiArticleVisualProvider(): ArticleVisualProvider {
	const apiKey = process.env.OPENAI_API_KEY;

	return {
		id: PROVIDER_ID,
		isConfigured: () => Boolean(apiKey),

		async generate(brief: ArticleVisualBrief, options: ArticleVisualGenerationOptions): Promise<GenerateArticleVisualResult> {
			if (!apiKey) {
				return { ok: false, kind: "not_configured", message: "OPENAI_API_KEY is not set." };
			}

			const requestedSize = toProviderSize(options);
			const prompt = buildPrompt(brief);

			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);

			let response: Response;
			try {
				response = await fetch(IMAGES_API_URL, {
					method: "POST",
					signal: controller.signal,
					headers: {
						Authorization: `Bearer ${apiKey}`,
						"content-type": "application/json",
					},
					body: JSON.stringify({
						model: MODEL,
						prompt,
						size: requestedSize.size,
						quality: "high",
						output_format: REQUESTED_OUTPUT_FORMAT,
						background: "opaque",
						n: 1,
					}),
				});
			} catch {
				clearTimeout(timeout);
				return { ok: false, kind: "provider_error", message: "Could not reach the image generation provider." };
			}
			clearTimeout(timeout);

			if (!response.ok) {
				const errorBody = (await response.json().catch(() => ({}))) as OpenAiImagesErrorResponse;
				const detail = typeof errorBody.error?.message === "string" ? errorBody.error.message : undefined;
				return {
					ok: false,
					kind: "provider_error",
					message: detail
						? `The image generation provider returned an error (HTTP ${response.status}): ${detail}`
						: `The image generation provider returned an error (HTTP ${response.status}).`,
				};
			}

			const body = (await response.json().catch(() => null)) as OpenAiImagesSuccessResponse | null;
			if (!body) {
				return { ok: false, kind: "invalid_response", message: "The image generation provider returned an unreadable response." };
			}

			const first = body.data?.[0];
			const b64 = first?.b64_json;
			if (!b64 || typeof b64 !== "string" || b64.length === 0) {
				return { ok: false, kind: "invalid_response", message: "The image generation provider returned no image data." };
			}

			let bytes: Uint8Array;
			try {
				bytes = Uint8Array.from(Buffer.from(b64, "base64"));
			} catch {
				return { ok: false, kind: "invalid_response", message: "The image generation provider returned malformed image data." };
			}

			if (bytes.length === 0) {
				return { ok: false, kind: "invalid_response", message: "The image generation provider returned an empty image." };
			}

			const outputFormat = typeof body.output_format === "string" ? body.output_format : REQUESTED_OUTPUT_FORMAT;
			const mimeType = MIME_BY_OUTPUT_FORMAT[outputFormat];
			if (!mimeType) {
				return { ok: false, kind: "invalid_response", message: "The image generation provider returned an unrecognised image format." };
			}

			const { width, height } = parseSize(body.size, requestedSize);

			const visual: GeneratedArticleVisual = {
				data: { kind: "bytes", data: bytes },
				mimeType,
				width,
				height,
			};

			return { ok: true, visual };
		},
	};
}
