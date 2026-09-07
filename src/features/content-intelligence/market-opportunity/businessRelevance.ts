import { BUSINESS_TAXONOMY } from "./businessTaxonomy";
import type {
	BusinessRelevanceEvidence,
	BusinessRelevanceLanguage,
	BusinessRelevanceLevel,
	BusinessRelevanceMatch,
	BusinessRelevanceTermTier,
	BusinessTaxonomyPillar,
} from "./types";

/**
 * Business relevance answers "does this topic relate to CCS's business
 * at all", independent of any market. It deliberately takes only a
 * keyword string — no MarketCode, no locale — and evaluates BOTH the
 * `en` and `pl` taxonomy lists on every call, regardless of which
 * market a keyword happens to have been observed in: a Polish-market
 * Bing keyword can still be an English loanword ("seo"), and CCS's own
 * offer doesn't change per market. Whether CCS has *content* for a
 * topic in a specific market is a different, later question (content
 * coverage — not implemented in this increment).
 *
 * -- Normalization ------------------------------------------------------
 * `normalize()` applies, in order: Unicode NFKC, lowercase, punctuation
 * characters replaced with a space (never deleted — "Next.js" and
 * "next-js" and "next js" must all collapse to the same token
 * sequence), repeated whitespace collapsed to one space, then trim.
 * Polish diacritics (ą ć ę ł ń ó ś ź ż) are NEVER stripped or folded —
 * folding them could collide unrelated Polish words and would make
 * EN/PL separation less reliable, not more. No stemming, no plural-
 * suffix stripping, no accent stripping, no fuzzy matching, no
 * embeddings, no external calls: where a plural genuinely needs to
 * match (e.g. a taxonomy term appearing with and without a trailing
 * "s"), both forms must be enumerated as separate taxonomy entries.
 *
 * -- Matching -------------------------------------------------------------
 * Matching is CONTIGUOUS TOKEN equality, never character-substring
 * matching. A normalized string is split on the single space left by
 * normalize() into a token array; a term matches a keyword when the
 * term's tokens appear as a contiguous, in-order run inside the
 * keyword's tokens. This is what makes short, specific terms like
 * "seo" or "ai" safe as standalone taxonomy entries: "seo" as a whole
 * token can never match inside the token "kaseo", and "ai" can never
 * match inside the token "air" — both would be false positives under
 * naive `string.includes()` substring matching, which this module
 * deliberately never uses.
 *
 * A solid compound with no separator at all (e.g. "nextjs") tokenizes
 * to ONE token and will never match a term that tokenizes to several
 * tokens (e.g. "next.js" → ["next","js"]) — this is why
 * businessTaxonomy.ts lists both "next.js" and "nextjs" as separate
 * entries rather than relying on punctuation normalization to invent a
 * word boundary that isn't actually there in the raw text.
 */
export function normalize(input: string): string {
	return input
		.normalize("NFKC")
		.toLowerCase()
		.replace(/[-_/.,'’":;!?()]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/** Splits an already-normalized-or-not string into its token array.
 * Calls normalize() itself, so callers never need to normalize first. */
export function tokenize(input: string): string[] {
	const normalized = normalize(input);
	return normalized.length === 0 ? [] : normalized.split(" ");
}

/** True iff `needle`'s tokens appear as a contiguous, in-order run
 * inside `haystack`'s tokens. The core word-boundary-safe primitive —
 * see this module's own doc comment above for why this, and not
 * character-substring matching, is required. */
export function containsPhrase(haystack: string[], needle: string[]): boolean {
	if (needle.length === 0 || needle.length > haystack.length) return false;
	outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
		for (let j = 0; j < needle.length; j++) {
			if (haystack[i + j] !== needle[j]) continue outer;
		}
		return true;
	}
	return false;
}

/** Convenience wrapper: does `term` (a raw, not-yet-normalized taxonomy
 * entry) match `keyword` (a raw, not-yet-normalized input string)? */
export function matchesTerm(keyword: string, term: string): boolean {
	return containsPhrase(tokenize(keyword), tokenize(term));
}

/**
 * Deduplication key for one match candidate: pillar + tier + language +
 * the NORMALIZED form of the term text (not the raw text). Two
 * configured taxonomy entries that normalize to the identical token
 * sequence for the same pillar/tier/language (e.g. "next js" and
 * "next-js" both accidentally present in the same list) collapse to
 * ONE match record — the first one encountered in declaration order is
 * kept (see evaluateRelevanceAgainstTaxonomy's iteration order below),
 * so deduplication never disturbs the documented ordering rule.
 *
 * Deliberately NOT deduped across `matchedLanguage`: the same literal
 * term appearing in both a pillar's `en` and `pl` list (e.g. "seo",
 * "next.js" — real bilingual loanwords) produces two distinct match
 * records, one per language, because `matchedLanguage` is meaningful,
 * retained evidence per the Phase 3C.1A spec, not an accident to
 * collapse away. Likewise not deduped across tier: a term wrongly
 * configured in both `terms` and `adjacentTerms` for the same pillar
 * would surface as two records — a taxonomy-authoring signal worth
 * seeing, not something this function should silently hide.
 */
function dedupeKey(pillarKey: string, tier: BusinessRelevanceTermTier, language: BusinessRelevanceLanguage, term: string): string {
	return `${pillarKey}::${tier}::${language}::${normalize(term)}`;
}

type TermBucket = {
	tier: BusinessRelevanceTermTier;
	language: BusinessRelevanceLanguage;
	terms: string[];
};

/** Per-pillar bucket order: term before adjacentTerm, en before pl
 * within each tier — the exact ordering rule this module documents and
 * tests rely on. */
function bucketsFor(pillar: BusinessTaxonomyPillar): TermBucket[] {
	return [
		{ tier: "term", language: "en", terms: pillar.terms.en },
		{ tier: "term", language: "pl", terms: pillar.terms.pl },
		{ tier: "adjacentTerm", language: "en", terms: pillar.adjacentTerms.en },
		{ tier: "adjacentTerm", language: "pl", terms: pillar.adjacentTerms.pl },
	];
}

/**
 * The testable core: evaluates `keyword` against an explicitly-passed
 * taxonomy rather than the real BUSINESS_TAXONOMY constant, so
 * ordering/deduplication behaviour can be locked down with small
 * synthetic fixtures independent of the real (and larger, and subject
 * to future editorial change) taxonomy content. `evaluateBusinessRelevance`
 * below is the real entry point and simply calls this with
 * BUSINESS_TAXONOMY.
 *
 * Ordering is fully deterministic and never relies on Set/object
 * iteration order: outer loop is taxonomy PILLAR DECLARATION ORDER
 * (the order pillars appear in the `taxonomy` array), then for each
 * pillar, TERM TIER before ADJACENT TIER, then EN before PL within a
 * tier, then TERM DECLARATION ORDER within that language's array. A
 * plain array + a `Set<string>` of already-seen dedupe keys is used for
 * deduplication (checked, never iterated for output), so output order
 * is exactly insertion order into that array — never influenced by
 * object/Map/Set key iteration semantics.
 */
export function evaluateRelevanceAgainstTaxonomy(keyword: string, taxonomy: BusinessTaxonomyPillar[]): BusinessRelevanceEvidence {
	const keywordTokens = tokenize(keyword);
	const matches: BusinessRelevanceMatch[] = [];

	if (keywordTokens.length > 0) {
		const seen = new Set<string>();

		for (const pillar of taxonomy) {
			for (const bucket of bucketsFor(pillar)) {
				for (const term of bucket.terms) {
					if (!containsPhrase(keywordTokens, tokenize(term))) continue;

					const key = dedupeKey(pillar.key, bucket.tier, bucket.language, term);
					if (seen.has(key)) continue;
					seen.add(key);

					matches.push({
						pillarKey: pillar.key,
						matchedTerm: term,
						matchedTermTier: bucket.tier,
						matchedLanguage: bucket.language,
					});
				}
			}
		}
	}

	const level: BusinessRelevanceLevel = matches.some((match) => match.matchedTermTier === "term")
		? "core"
		: matches.some((match) => match.matchedTermTier === "adjacentTerm")
			? "adjacent"
			: "none";

	// A `term` match always wins the level even when an `adjacentTerm`
	// match also exists (in the same or a different pillar) — but every
	// match, at every tier, stays in `matches` for explainability. See
	// this module's own doc comment and types.ts's BusinessRelevanceEvidence.
	return { level, matches };
}

/** The real entry point: evaluates `keyword` against the actual, live
 * BUSINESS_TAXONOMY. */
export function evaluateBusinessRelevance(keyword: string): BusinessRelevanceEvidence {
	return evaluateRelevanceAgainstTaxonomy(keyword, BUSINESS_TAXONOMY);
}
