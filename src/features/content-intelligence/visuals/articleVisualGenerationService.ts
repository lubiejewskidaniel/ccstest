import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/supabase/adminAuth";
import { getArticleForAdmin } from "@/features/insights/cms/queries";
import { buildArticleVisualBrief, type ArticleVisualBriefInput } from "./articleVisualBrief";
import { createOpenAiArticleVisualProvider } from "./OpenAiArticleVisualProvider";
import { storeGeneratedArticleVisual } from "./articleVisualStorageService";
import type { ArticleVisualCandidate } from "./articleVisualStorage";
import type { ArticleVisualGenerationOptions } from "./ArticleVisualProvider";

/**
 * Phase 3C.4B.5B — Article Visual Generation Orchestration.
 *
 * The single place that connects the two chains that already exist:
 *
 *   Article -> buildArticleVisualBrief() -> ArticleVisualBrief
 *     -> createOpenAiArticleVisualProvider().generate() -> GeneratedArticleVisual
 *
 * and
 *
 *   GeneratedArticleVisual -> storeGeneratedArticleVisual()
 *     -> Supabase Storage -> article_visuals (pending_review)
 *
 * This module owns none of the logic on either side of that join: it
 * never validates image bytes, never uploads to Storage, never inserts
 * or updates `article_visuals`/`insights_articles` rows itself (all of
 * that is `articleVisualStorageService.ts`'s job), and never calls
 * `fetch` or talks to OpenAI directly (that is
 * `OpenAiArticleVisualProvider.ts`'s job). It only decides WHEN to call
 * each of those, in what order, and how to translate failures from
 * either side into one small result the (future, Phase 3C.4B.5C)
 * Server Action can render.
 *
 * Auth-before-cost (the reason this file exists as a distinct step
 * rather than being folded into a Server Action later): a real
 * generation call costs real money, so every check that can reject the
 * request for free — Supabase configuration, authentication, editor
 * role, article id shape, article existence, category/context adequacy,
 * and the provider's own configuration — runs to completion BEFORE
 * `provider.generate()` is ever called. Reuses the exact same
 * `createSupabaseServerClient()` / `getAdminSession()` / `session.isEditor`
 * pattern as `articleVisualStorageService.ts` and
 * `articleVisualReviewService.ts` — no service-role client, no new auth
 * pattern.
 *
 * No automation lives here or is added by this phase: this function is
 * not called from any scheduler, cron, article-generation, brief-
 * generation, publishing, article-save, or recommendation code path.
 * It has no caller at all yet — Phase 3C.4B.5C adds the first one (a
 * human-triggered Server Action + Generate button).
 *
 * Cost accounting: deliberately NOT wired into `costGuard.ts`, whose
 * budget check is shaped around per-1k-token text pricing and does not
 * fit a flat-per-image provider cost — see `ArticleVisualProvider.ts`'s
 * and `OpenAiArticleVisualProvider.ts`'s own module doc comments for the
 * same, already-made decision. One call to `generateArticleVisualCandidate`
 * can cause at most one paid provider request (no retry, no fallback
 * provider, no loop); real image-cost accounting remains deferred to a
 * later phase, exactly as it already was after 3C.4B.5A.
 */

const uuidSchema = z.string().uuid();

/**
 * The one canonical application-level request size. `1600x896` (the
 * real gpt-image-2-safe value), the model name, and any other provider
 * concern are NOT decided here — `OpenAiArticleVisualProvider.ts` alone
 * owns mapping this plain, provider-neutral `{ width, height }` down to
 * whatever a concrete provider actually supports.
 */
const GENERATION_OPTIONS: ArticleVisualGenerationOptions = { width: 1600, height: 900 };

/**
 * Deliberately reuses existing result vocabulary rather than inventing
 * a parallel one: `"not_configured"` / `"auth"` / `"validation"` /
 * `"not_found"` mirror `ArticleVisualBriefResult` / `StoreArticleVisualResult`
 * / `articleVisualReviewService.ts`'s own result kinds; `"provider_error"`
 * / `"invalid_response"` / `"budget_exceeded"` are passed through
 * verbatim from `GenerateArticleVisualResult` (Phase 3C.4B.2/5A) rather
 * than re-labelled. `"storage_error"` is the one new, deliberately
 * generic kind this phase adds — it stands in for the full
 * `StoreArticleVisualResult` failure vocabulary (`not_configured` /
 * `auth` / `not_found` / `invalid_asset` / `storage_error` /
 * `database_error`), which this orchestration layer has already
 * defensively checked most of once by the time storage runs; rather
 * than duplicating all six kinds again here, the storage layer's own
 * safe, non-leaking `message` is forwarded and the kind is collapsed to
 * one generic "something went wrong persisting this candidate" bucket.
 *
 * Never carries: a raw OpenAI response, a prompt, image bytes/base64, a
 * provider temporary URL, an API key, or any approval/cover-approval
 * state — the only success payload is the stored, `pending_review`
 * `ArticleVisualCandidate` `articleVisualStorage.ts` already defines.
 */
export type GenerateArticleVisualCandidateResult =
	| { ok: true; candidate: ArticleVisualCandidate }
	| { ok: false; kind: "not_configured"; message: string }
	| { ok: false; kind: "auth"; message: string }
	| { ok: false; kind: "validation"; message: string }
	| { ok: false; kind: "not_found"; message: string }
	| { ok: false; kind: "provider_error"; message: string }
	| { ok: false; kind: "invalid_response"; message: string }
	| { ok: false; kind: "budget_exceeded"; message: string }
	| { ok: false; kind: "storage_error"; message: string };

/**
 * The minimum article shape this module needs to build a brief —
 * matches the fields `getArticleForAdmin` already returns on its
 * `Article` type. Declared narrowly and explicitly here (rather than
 * accepting a full `Article`) so it is structurally obvious, at this
 * function's own call site below, that nothing else on `Article` (body,
 * `seoDescription`, ids, author, status, etc.) is ever read.
 */
type ArticleVisualContextSource = {
	title: string;
	excerpt: string;
	locale: ArticleVisualBriefInput["locale"];
	category: { key: ArticleVisualBriefInput["category"]["key"]; name: string };
};

/**
 * The ONLY translation from a real article row into
 * `ArticleVisualBriefInput`. Picks exactly the five fields
 * `buildArticleVisualBrief` needs (title, excerpt, category key/name,
 * locale) and nothing else — no `body`, no `seoTitle`/`seoDescription`,
 * no `id`/`slug`/`authorName`, no `MarketOpportunityEvidence` or
 * `ContentBrief` (this module never even imports those types). This is
 * the single choke point that keeps the rest of the article's data out
 * of everything downstream of it (the brief, the provider prompt, and
 * therefore OpenAI).
 */
function toBriefInput(article: ArticleVisualContextSource): ArticleVisualBriefInput {
	return {
		title: article.title,
		excerpt: article.excerpt,
		category: { key: article.category.key, name: article.category.name },
		locale: article.locale,
	};
}

/**
 * Generates exactly one new `pending_review` article visual candidate
 * for `articleId`.
 *
 *   1. authenticate + authorize (config, session, editor role)
 *   2. validate `articleId`
 *   3. load the article (existing `getArticleForAdmin` admin read —
 *      not a second full article-query implementation)
 *   4. build the `ArticleVisualBrief` from only its approved fields
 *   5. confirm the configured `ArticleVisualProvider` is configured
 *   6. call `provider.generate()` exactly once
 *   7. hand the result to `storeGeneratedArticleVisual()` unchanged
 *
 * Every one of steps 1-5 can reject the request before step 6 — the
 * only step that can cost real money — ever runs. Never approves,
 * publishes, supersedes, or deletes any existing `article_visuals` row;
 * a new candidate is always additional, regardless of how many
 * candidates already exist or whether the article is already published
 * with a live, approved cover (see this file's own tests for both).
 */
export async function generateArticleVisualCandidate(articleId: string): Promise<GenerateArticleVisualCandidateResult> {
	// Step 1: configuration + authentication + authorization, before
	// anything billable and before even validating the article id.
	const supabase = await createSupabaseServerClient();
	if (!supabase) {
		return { ok: false, kind: "not_configured", message: "Supabase isn't configured in this environment." };
	}

	const session = await getAdminSession();
	if (!session?.isEditor) {
		return { ok: false, kind: "auth", message: "You must be signed in as an editor to generate an article visual." };
	}

	// Step 2: validate the id shape before ever querying for it.
	const parsedId = uuidSchema.safeParse(articleId);
	if (!parsedId.success) {
		return { ok: false, kind: "validation", message: "Invalid article id." };
	}

	// Step 3: load the article. `getArticleForAdmin` already returns
	// `null` for both "no such row" and "the category join is missing"
	// (`mapArticle`'s own documented behaviour) -- both are equally
	// "cannot proceed", so both surface as the same safe `not_found`
	// here rather than this module re-deriving that distinction itself.
	const article = await getArticleForAdmin(parsedId.data);
	if (!article) {
		return { ok: false, kind: "not_found", message: "That article could not be found." };
	}

	// Step 4: build the brief from only its approved fields. An
	// `insufficient_context` result (missing/too-short excerpt, no
	// valid category key) is rejected here, for free, before any
	// provider call.
	const briefResult = buildArticleVisualBrief(toBriefInput(article));
	if (!briefResult.ok) {
		return { ok: false, kind: "validation", message: briefResult.message };
	}

	// Step 5: the provider itself must be configured before generation
	// is attempted -- checked explicitly here (not just left to
	// `generate()` to discover), so a misconfigured environment never
	// even constructs a request.
	const provider = createOpenAiArticleVisualProvider();
	if (!provider.isConfigured()) {
		return { ok: false, kind: "not_configured", message: "Image generation isn't configured in this environment." };
	}

	// Step 6: exactly one provider call. No retry, no fallback provider,
	// no loop -- one explicit invocation of this function can cause at
	// most one billable request.
	const generation = await provider.generate(briefResult.brief, GENERATION_OPTIONS);
	if (!generation.ok) {
		// Passed straight through: `generation.kind` is already one of
		// "not_configured" | "provider_error" | "invalid_response" |
		// "budget_exceeded", and `generation.message` is already a safe,
		// non-leaking string (`GenerateArticleVisualResult`'s own
		// contract) -- nothing here re-labels or rewraps it, and storage
		// is never attempted.
		return generation;
	}

	// Step 7: hand off to the existing storage service unchanged. This
	// function never validates bytes, uploads, or writes to
	// `article_visuals`/`insights_articles` itself -- and never
	// approves, supersedes, or replaces any existing visual: a fresh
	// `pending_review` row is all `storeGeneratedArticleVisual` can ever
	// produce.
	const stored = await storeGeneratedArticleVisual({
		articleId: parsedId.data,
		brief: briefResult.brief,
		providerId: provider.id,
		visual: generation.visual,
	});

	if (!stored.ok) {
		return { ok: false, kind: "storage_error", message: stored.message };
	}

	return { ok: true, candidate: stored.candidate };
}
