import type { Locale } from "@/lib/routes";
import type { CategoryKey } from "@/features/insights/types/article";

/**
 * Phase 3C.4B.1 — Article Visual Brief.
 *
 * A pure, deterministic, provider-agnostic transformation: describes
 * WHAT visual an article needs, never HOW a specific image provider
 * should be prompted for it. No network, no filesystem, no Supabase, no
 * `Date.now`, no randomness, no LLM/image-provider call, and no
 * interaction with `cover_image_status` — this module only describes a
 * requirement, it never fulfills, generates, or approves one.
 *
 * Deliberately conservative for V1 (approved corrected design): this
 * function does NOT attempt semantic inference over `title`/`excerpt`/
 * `keyPoints` via keyword tables or any other heuristic. `requiredElements`
 * is always `[]` in V1 — a placeholder for future, individually-approved
 * deterministic rules, not a sign of missing functionality. Creative/
 * semantic interpretation belongs to a later provider/adapter layer that
 * does not exist yet and is explicitly out of scope here.
 *
 * Category conceptual directions (documentation only — never encoded
 * into the returned brief, never turned into prompt/provider syntax):
 *   build  — software engineering, systems and construction.
 *   grow   — growth, visibility and business momentum.
 *   learn  — learning, clarity and knowledge.
 *   studio — creative technology, experimentation and behind-the-scenes work.
 */

export type ArticleVisualBriefInput = {
	title: string;
	excerpt: string;
	category: {
		key: CategoryKey;
		name: string;
	};
	locale: Locale;
	/** Optional, forward-compatible context signal. Accepted but
	 * semantically inert in Phase 3C.4B.1 — never read by this function
	 * to derive `requiredElements` or any other output field. Kept on
	 * the input type so a later phase can begin interpreting it without
	 * a breaking signature change. */
	keyPoints?: string | null;
};

export type ArticleVisualBrief = {
	/** The real, already-approved article title, trimmed only — never
	 * paraphrased, summarized, or rewritten. */
	subject: string;
	/** Passed through unchanged from the input. Carries no compositional
	 * logic itself; see the module doc comment for the (documentation-
	 * only) conceptual direction per category. */
	categoryKey: CategoryKey;
	locale: Locale;
	/** V1: always `[]`. See module doc comment. */
	requiredElements: string[];
	/** The fixed CCS safety/brand constraint list, in a stable order.
	 * Never empty. Not influenced by input in V1. Each returned brief
	 * owns its own array instance — see `avoidElements()` below. */
	avoidElements: string[];
	/** Deterministic, locale-templated text derived only from the
	 * trimmed title. */
	altText: string;
};

export type ArticleVisualBriefResult =
	| { ok: true; brief: ArticleVisualBrief }
	| { ok: false; kind: "insufficient_context"; message: string };

/** Minimum excerpt length for a visual brief — the same floor
 * `articleInputSchema` (src/features/insights/cms/schema.ts) and the
 * generation pipeline (src/features/content-intelligence/generation/generate.ts)
 * already enforce for a real article excerpt, so "too short for a
 * visual brief" aligns with "too short to be a real article excerpt"
 * rather than an invented new threshold. */
const MIN_EXCERPT_LENGTH = 20;

const VALID_CATEGORY_KEYS: readonly CategoryKey[] = ["build", "grow", "learn", "studio"];

/** Fixed CCS safety/brand constraints — identical, same order, on every
 * successful brief regardless of input content. Not exported: callers
 * receive their own copy via `avoidElements()` on each call, so no
 * shared array can ever be mutated by one caller and observed by
 * another. */
const AVOID_ELEMENTS: readonly string[] = [
	"embedded text unless explicitly required",
	"fabricated UI screenshots",
	"real logos or trademarks",
	"fake endorsements",
	"stock-photo-style generic business imagery",
	"invented statistics or fabricated data values",
];

function avoidElements(): string[] {
	return [...AVOID_ELEMENTS];
}

/** Same `Record<Locale, (title) => string>` template shape already
 * established in src/features/insights/lib/format.ts's
 * `READING_TIME_LABEL` — a plain, deterministic, per-locale template
 * function, not a translation step and not an LLM call. */
const ALT_TEXT_TEMPLATE: Record<Locale, (title: string) => string> = {
	en: (title) => `Cover illustration for the article "${title}"`,
	pl: (title) => `Ilustracja do artykułu „${title}”`,
};

function isValidCategoryKey(key: unknown): key is CategoryKey {
	return typeof key === "string" && (VALID_CATEGORY_KEYS as readonly string[]).includes(key);
}

/**
 * Builds a deterministic, provider-agnostic description of the visual an
 * article needs. Pure: given the same input, always returns a deeply
 * identical result. Never invents content — an input that doesn't carry
 * enough real context returns a controlled `insufficient_context`
 * failure rather than a guessed brief.
 */
export function buildArticleVisualBrief(input: ArticleVisualBriefInput): ArticleVisualBriefResult {
	const title = input.title.trim();
	if (title.length === 0) {
		return { ok: false, kind: "insufficient_context", message: "Article title is required to build a visual brief." };
	}

	const excerpt = input.excerpt.trim();
	if (excerpt.length === 0) {
		return { ok: false, kind: "insufficient_context", message: "Article excerpt is required to build a visual brief." };
	}
	if (excerpt.length < MIN_EXCERPT_LENGTH) {
		return {
			ok: false,
			kind: "insufficient_context",
			message: `Article excerpt is too short to build a visual brief (minimum ${MIN_EXCERPT_LENGTH} characters).`,
		};
	}

	if (!isValidCategoryKey(input.category.key)) {
		return { ok: false, kind: "insufficient_context", message: "A valid article category is required to build a visual brief." };
	}

	const brief: ArticleVisualBrief = {
		subject: title,
		categoryKey: input.category.key,
		locale: input.locale,
		requiredElements: [],
		avoidElements: avoidElements(),
		altText: ALT_TEXT_TEMPLATE[input.locale](title),
	};

	return { ok: true, brief };
}
