import type { ArticleVisualBrief } from "./articleVisualBrief";

/**
 * Phase 3C.4B.2 — Article Visual Provider abstraction.
 *
 * The provider-neutral boundary between an `ArticleVisualBrief` (Phase
 * 3C.4B.1 — a pure description of WHAT visual is needed) and a future
 * generated image. Modelled on the two closest existing provider
 * contracts in this codebase:
 *
 *   - `ContentAiProvider` (content-intelligence/types/contentAi.ts) —
 *     `{ id, model?, isConfigured(), complete(request) }`, implemented
 *     today only by `AnthropicProvider.ts` (raw `fetch`, no SDK).
 *   - `CRMProvider` (lib/crm/types.ts) — `{ readonly id: string,
 *     isConfigured(), createContact(), createLead() }`, implemented
 *     today only by `HubSpotProvider.ts`.
 *
 * Both existing contracts deliberately type `id` as a plain `string`,
 * not a closed union of known provider names — CRMProvider has exactly
 * one real implementation (HubSpot) today and still never hardcoded
 * `"hubspot"` into the core type. This phase follows the same
 * precedent: no `ArticleVisualProviderId` enum, no `"openai"` anywhere
 * in this file. A concrete adapter names itself; the core abstraction
 * never needs to know the closed set of adapters that will ever exist,
 * and none is being integrated in this phase.
 *
 * This file defines ONLY the contract (types + the interface shape). It
 * contains zero implementations, zero `fetch` calls, and constructs no
 * concrete provider — a future phase (3C.4B.3+) adds the first real
 * adapter. Importing or type-checking this file can never cause a
 * network call, an image generation, a Supabase write, or an
 * `insights_articles` mutation, because there is no executable provider
 * logic here to run.
 *
 * Explicitly NOT this file's concern (see module-level design notes
 * below for why each is out of scope):
 *
 *   - Storage: this contract generates a visual; it never uploads it,
 *     decides a storage path, or produces a permanent URL. That is a
 *     future `storeArticleVisual(...)` step's job, operating on
 *     whatever this contract returns.
 *   - Approval/review state: `coverImageStatus`/`cover_image_status`
 *     and its values (`missing`/`pending_review`/`approved`) belong to
 *     the Phase 3C.4A publication gate and a future review workflow.
 *     A successful `generate()` call is not an approval and must never
 *     be treated as one by any caller.
 *   - Cost logging: `costGuard.ts`'s `checkBudget()`/`logUsage()` are
 *     shaped around per-1k-token text pricing (input/output token
 *     counts), which does not fit typical flat-per-image provider
 *     pricing. This phase does not call, extend, or duplicate that
 *     logging — a future concrete adapter owns whether and how it
 *     records image-generation cost. `GeneratedArticleVisual` therefore
 *     carries no token counts, no billing/request ids, and no cost
 *     figure of any kind.
 *   - Prompt construction: `ArticleVisualBrief` is not a prompt (see
 *     its own module doc comment). Turning a brief plus CCS brand
 *     guidelines plus provider-specific requirements into an actual
 *     provider prompt string is a concrete adapter's private concern
 *     (e.g. a future `OpenAiArticleVisualProvider.buildPrompt(brief)`)
 *     — this interface only ever accepts the brief itself, never a
 *     prompt, and never will.
 */

/**
 * The requested output size for one generation call. Deliberately plain
 * numeric width/height, never a provider-specific size token (e.g.
 * `"1792x1024"`) — the current approved canonical article-cover master
 * is ~1600x900 (16:9), but that specific number is a call-site policy
 * decision, not something this core contract hardcodes as a default.
 */
export type ArticleVisualGenerationOptions = {
	width: number;
	height: number;
};

/**
 * Where the generated image data actually lives right after generation.
 * A discriminated union rather than one fixed shape because real
 * providers differ here and neither shape should be forced to convert
 * into the other prematurely: some return the image inline (raw bytes),
 * others return a short-lived hosted URL the caller must fetch before it
 * expires. `Uint8Array` (not Node's `Buffer`) so this type stays valid
 * outside a Node-specific runtime.
 *
 * A future `storeArticleVisual(...)` step is what turns either shape
 * into the article's real, permanent, storage-hosted URL — never this
 * type. `"temporary_url"` is named as such specifically so no caller
 * mistakes it for a permanent `coverImageUrl`.
 */
export type GeneratedArticleVisualData = { kind: "bytes"; data: Uint8Array } | { kind: "temporary_url"; url: string };

/**
 * The smallest useful generated-image result. Preserves whatever MIME
 * type the provider actually returned (never assumed to be WebP — a
 * future storage/normalisation layer decides whether and how to
 * convert it) and the actual pixel dimensions produced, which may
 * differ from the requested `ArticleVisualGenerationOptions` if a
 * provider only supports a fixed set of sizes.
 *
 * Deliberately excludes anything storage- or review-related
 * (`url`/permanent asset id, `coverImageStatus`, `approved`,
 * `reviewedAt`) and anything cost-related (token counts, billing ids) —
 * see this file's module doc comment for why both are out of scope.
 * Also excludes any provider request/response internals, API keys, or
 * authorization headers — this is a public result type a CMS layer can
 * safely hold onto and log without ever risking a leaked secret.
 */
export type GeneratedArticleVisual = {
	data: GeneratedArticleVisualData;
	mimeType: string;
	width: number;
	height: number;
};

/**
 * Deterministic, typed failure categories — same `{ ok, kind, message }`
 * discriminated-union shape already used throughout this codebase
 * (`StageResult`, `CmsResult`, Phase 3C.4B.1's `ArticleVisualBriefResult`),
 * kept small on purpose:
 *
 *   - "not_configured": the adapter has no credentials/setup to run at
 *     all (mirrors `StageResult`'s `"not_configured"`).
 *   - "provider_error": the provider was called and returned a real
 *     failure (mirrors `StageResult`'s `"provider_error"`).
 *   - "invalid_response": the provider call itself didn't error, but
 *     what it returned couldn't be trusted as a usable image (missing
 *     data, an unrecognised MIME type, non-positive dimensions) — a
 *     new category StageResult doesn't have, because no existing text-
 *     generation stage needed this distinction.
 *   - "budget_exceeded": mirrors the spirit of `StageResult`'s
 *     `"budget"` kind; named more explicitly here since this module
 *     does not itself implement any budget check (see module doc
 *     comment) — a future concrete adapter decides if/when to return
 *     this.
 *
 * No raw provider payload, stack trace, or secret ever belongs in
 * `message` — same "never expose raw database/provider errors" rule
 * already followed by `cms/service.ts`'s `describeWriteError`.
 */
export type GenerateArticleVisualResult =
	| { ok: true; visual: GeneratedArticleVisual }
	| { ok: false; kind: "not_configured"; message: string }
	| { ok: false; kind: "provider_error"; message: string }
	| { ok: false; kind: "invalid_response"; message: string }
	| { ok: false; kind: "budget_exceeded"; message: string };

/**
 * The provider-neutral contract itself. Consumes only an
 * `ArticleVisualBrief` (plus provider-neutral generation options) —
 * never a raw `Article`, `ContentBrief`, `MarketOpportunityEvidence`, or
 * a Supabase row, so this interface can never end up implicitly coupled
 * to recommendation logic or database shape. `id` is a plain string
 * (not a closed union) and `isConfigured()` mirrors the exact same
 * "silent no-op until configured" contract as `ContentAiProvider` and
 * `CRMProvider` — the future concrete adapter reads its own environment
 * variables to decide this; the interface itself performs no env reads.
 */
export type ArticleVisualProvider = {
	readonly id: string;
	isConfigured: () => boolean;
	generate: (brief: ArticleVisualBrief, options: ArticleVisualGenerationOptions) => Promise<GenerateArticleVisualResult>;
};
