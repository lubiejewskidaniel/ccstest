import type { MarketCode } from "../market/types";
import { tokenize, containsPhrase } from "./businessRelevance";
import type { ContentCoverageEvidence, ContentCoverageMatch } from "./types";
import type { ArticleStatus } from "../../insights/types/article";

/**
 * Phase 3C.1B — Content Coverage.
 *
 * Answers ONE narrow, literal question: does CCS already have published
 * Insights content whose title or excerpt contains this exact market
 * keyword phrase? This is NOT semantic search (no embeddings, no fuzzy
 * matching, no LLM), NOT a recommendation, and NOT a ranking signal —
 * it is a conservative, deterministic v1 evidence layer that will
 * under-count real coverage (an article that covers a topic without
 * using the exact phrase anywhere in its title/excerpt simply won't
 * match) rather than over-claim it. This mirrors the same
 * deliberately-conservative heuristic already trusted elsewhere in this
 * codebase for the same "could this plausibly already cover that"
 * question (`opportunities/recompute.ts`'s `findMatchedArticleId`),
 * upgraded to token-boundary-safe matching instead of naive substring.
 *
 * -- Purity -----------------------------------------------------------
 * This module never touches Supabase and never will in this increment
 * — it takes already-fetched article candidates as plain data and
 * returns a plain evidence object. A future `queries.ts` (not built in
 * Phase 3C.1B) is responsible for fetching real candidates and calling
 * `evaluateContentCoverage`.
 *
 * -- Matcher reuse ------------------------------------------------------
 * Reuses Phase 3C.1A's exact `tokenize`/`containsPhrase` primitives from
 * `businessRelevance.ts` — the same Unicode-NFKC/lowercase/punctuation-
 * as-separator/whitespace-collapse normalization, the same contiguous
 * whole-token matching, no stemming, no accent stripping. There is
 * deliberately only one definition of phrase matching in this codebase;
 * this file does not duplicate it.
 *
 * It does NOT reuse `matchesTerm(keyword, term)` as-is, because that
 * function's argument order encodes a specific direction — "does
 * `keyword` (the haystack) contain `term` (the needle)" — which is
 * exactly backwards for content coverage. Here the ARTICLE TEXT (title
 * or excerpt) is the corpus being searched, and the KEYWORD is the
 * phrase we're looking for inside it — the opposite direction from
 * business relevance, where the market keyword is the corpus and a
 * taxonomy term is the needle. Calling `containsPhrase(tokenize(article
 * text), tokenize(keyword))` directly, with that explicit argument
 * order, reuses the identical matching primitive without importing a
 * direction that doesn't apply here. Getting this backwards would wrongly
 * treat a short article title as "covering" a long, unrelated keyword
 * merely because the title happens to be a substring of it — see this
 * module's tests for the exact worked example
 * ("seo for small business" vs. a title of just "SEO" must NOT match).
 *
 * -- Locale / market rule (asymmetric vs. business relevance) -----------
 * Business relevance deliberately evaluates BOTH the `en` and `pl`
 * taxonomy lists regardless of market, because it answers "does this
 * topic relate to CCS's business at all" — a question with no locale.
 * Content coverage answers a DIFFERENT question — "does CCS's site, in
 * THIS market's language, already have something" — so only articles
 * whose `locale` matches the keyword's market count. The current
 * explicit mapping (the only one this codebase's two configured markets
 * need — see `market/types.ts`'s `MarketCode`) is `gb`/`en-GB` -> `"en"`
 * and `pl`/`pl-PL` -> `"pl"`. A Polish article is never coverage for a
 * `gb` keyword, and vice versa, even if the text would otherwise match.
 *
 * -- Published-only rule --------------------------------------------------
 * Only articles whose `status` is exactly `"published"` are eligible —
 * the real `ArticleStatus` union from
 * `src/features/insights/types/article.ts` ("draft" | "in_review" |
 * "scheduled" | "published" | "archived", matching migration
 * 003_insights_schema.sql's check constraint). That type is imported
 * here TYPE-ONLY, purely for compile-time protection on the candidate
 * shape below -- this module does NOT import `Article`/`ArticleSummary`
 * (category, tags, cover image, SEO fields), which would couple this
 * pure evaluator to unrelated CMS concerns for no benefit, and does not
 * import anything from the CMS's fetching/query layer. The runtime rule
 * itself is still a plain literal comparison against `"published"`, not
 * a re-derivation of the type.
 *
 * -- Level rules (exact) --------------------------------------------------
 *   1. `"title_match"` — at least one eligible, published article's
 *      TITLE contains the full normalized keyword phrase.
 *   2. `"mention"` — else, at least one eligible, published article's
 *      EXCERPT contains the full normalized keyword phrase.
 *   3. `"none"` — else.
 * An article whose title AND excerpt both match is recorded ONLY in
 * `titleMatches`, never duplicated into `excerptOnlyMatches`.
 *
 * -- Mapping rules (exact) ------------------------------------------------
 * `mapping` depends ONLY on the tier that actually determined `level`:
 *   - `level === "title_match"`: exactly 1 title match -> `"unambiguous"`;
 *     2+ -> `"ambiguous"`. The excerpt-only count is never consulted.
 *   - `level === "mention"`: exactly 1 excerpt-only match ->
 *     `"unambiguous"`; 2+ -> `"ambiguous"`.
 *   - `level === "none"`: `mapping` is `null`.
 * Multiple matches at the winning tier are NEVER read as "stronger
 * coverage" — they only ever downgrade `mapping` to `"ambiguous"`. This
 * is deliberate: many matching articles is closer to a cannibalisation
 * signal (see `opportunities/cannibalisation.ts`'s unrelated but
 * conceptually similar concern) than to strong coverage.
 *
 * -- Ordering -------------------------------------------------------------
 * `titleMatches`/`excerptOnlyMatches` preserve the input `articles`
 * array's order exactly — no sorting by title/slug/anything else. A
 * plain array, filled in one forward pass over `articles`, is the
 * entire mechanism; nothing here depends on Set/Map/object iteration
 * order.
 *
 * -- Empty / invalid input -------------------------------------------------
 * An empty or whitespace-only `keyword` (normalizes to zero tokens)
 * returns `{ level: "none", mapping: null, titleMatches: [],
 * excerptOnlyMatches: [] }` rather than throwing — this module has no
 * validation layer of its own and a future caller (a real keyword
 * string from `market_keywords`) is expected to have already been
 * through whatever validation applies upstream; treating an empty
 * keyword as "no evidence of coverage" is the conservative, honest
 * answer rather than a crash. An empty `articles` array produces the
 * identical result through the same code path (the match loop simply
 * has nothing to iterate).
 */

/**
 * The smallest article shape this evaluator needs — deliberately NOT
 * the CMS's full `ArticleSummary`/`Article` type (`src/features/
 * insights/types/article.ts`), which carries category, tags, cover
 * image and SEO fields this pure evidence layer has no use for and
 * should not be coupled to. A caller maps its real article rows into
 * this shape.
 */
export type ArticleCandidateForCoverage = {
	id: string;
	locale: "en" | "pl";
	slug: string;
	title: string;
	excerpt: string;
	/** The article's real CMS status. Only `"published"` (see this
	 * module's own doc comment) is ever eligible; every other member of
	 * `ArticleStatus` is ignored. Typed against the real CMS union
	 * (type-only import) so a caller gets a compile error for a typo'd
	 * or invented status, rather than a silent runtime no-match. */
	status: ArticleStatus;
};

export type EvaluateContentCoverageInput = {
	keyword: string;
	market: MarketCode;
	articles: ArticleCandidateForCoverage[];
};

const PUBLISHED_STATUS = "published";

/** The current, explicit, and only market -> article-locale mapping
 * this codebase's two configured markets need. Exhaustively switched so
 * adding a third `MarketCode` member later fails to compile here until
 * this mapping is deliberately extended, rather than silently
 * defaulting to the wrong locale. */
function marketToEligibleArticleLocale(market: MarketCode): "en" | "pl" {
	switch (market.country) {
		case "gb":
			return "en";
		case "pl":
			return "pl";
		default: {
			const exhaustiveCheck: never = market;
			throw new Error(`evaluateContentCoverage: unhandled market ${JSON.stringify(exhaustiveCheck)}`);
		}
	}
}

export function evaluateContentCoverage(input: EvaluateContentCoverageInput): ContentCoverageEvidence {
	const { keyword, market, articles } = input;

	const keywordTokens = tokenize(keyword);
	if (keywordTokens.length === 0) {
		return { level: "none", mapping: null, titleMatches: [], excerptOnlyMatches: [] };
	}

	const eligibleLocale = marketToEligibleArticleLocale(market);

	const titleMatches: ContentCoverageMatch[] = [];
	const excerptOnlyMatches: ContentCoverageMatch[] = [];

	// Single forward pass over `articles`, in the order given -- see this
	// module's own doc comment on why output order is never re-sorted.
	for (const article of articles) {
		if (article.status !== PUBLISHED_STATUS) continue;
		if (article.locale !== eligibleLocale) continue;

		// Direction matters: the ARTICLE TEXT is the haystack, the KEYWORD
		// is the needle -- see this module's own doc comment on why
		// `matchesTerm` (business relevance's opposite-direction helper)
		// is not used here.
		const titleContainsKeyword = containsPhrase(tokenize(article.title), keywordTokens);
		const excerptContainsKeyword = containsPhrase(tokenize(article.excerpt), keywordTokens);

		if (!titleContainsKeyword && !excerptContainsKeyword) continue;

		const match: ContentCoverageMatch = { articleId: article.id, locale: article.locale, slug: article.slug };

		if (titleContainsKeyword) {
			titleMatches.push(match);
		} else {
			excerptOnlyMatches.push(match);
		}
	}

	if (titleMatches.length > 0) {
		return {
			level: "title_match",
			mapping: titleMatches.length === 1 ? "unambiguous" : "ambiguous",
			titleMatches,
			excerptOnlyMatches,
		};
	}

	if (excerptOnlyMatches.length > 0) {
		return {
			level: "mention",
			mapping: excerptOnlyMatches.length === 1 ? "unambiguous" : "ambiguous",
			titleMatches: [],
			excerptOnlyMatches,
		};
	}

	return { level: "none", mapping: null, titleMatches: [], excerptOnlyMatches: [] };
}
