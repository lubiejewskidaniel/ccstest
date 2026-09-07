/**
 * Phase 3C.1A — Business taxonomy & business relevance foundation.
 *
 * Deliberately minimal: this file contains ONLY the types the
 * business-taxonomy/business-relevance slice of Phase 3C.1 actually
 * needs right now. Later increments (content coverage, evidence
 * confidence, market demand, CCS visibility, the top-level
 * MarketOpportunityEvidence and its classifications) each get their own
 * types added when THAT increment is implemented — nothing is
 * pre-declared here. See the Phase 3C.1 architecture report and its
 * specification-correction follow-up for the full future shape; this
 * file is not a preview of those later types.
 *
 * No dependency on market/types.ts or opportunities/ on purpose:
 * business relevance describes whether a topic relates to CCS's
 * business at all, independent of which market (Bing keyword,
 * country/language) it came from — see businessRelevance.ts's own doc
 * comment on why MarketCode never enters this module.
 */

/** The six existing CCS capability keys from ServicesPage.tsx, reused
 * verbatim rather than inventing a parallel taxonomy. ServicesPage.tsx
 * itself is not imported here — it is UI/presentation code with no
 * exported constant for these keys — so this union is the deliberate
 * single source of truth for the key spelling from here on. */
export type BusinessTaxonomyPillarKey =
	| "software-development"
	| "product-development"
	| "technology-consulting"
	| "web-digital"
	| "growth-marketing"
	| "mentoring";

/**
 * One capability pillar's matchable vocabulary.
 *
 * `terms` are phrases that literally name something CCS sells —
 * matching one of these is what produces `businessRelevance.level ===
 * "core"`. `adjacentTerms` are related-but-less-specific phrases —
 * matching one of these (with no `terms` match) produces `"adjacent"`.
 * This two-tier split is the entire mechanism behind the three-level
 * BusinessRelevanceLevel below — a fourth, in-between level was
 * considered and rejected in the specification-correction report
 * because it would need a third term tier with no independent evidence
 * to justify where its threshold sits.
 */
export type BusinessTaxonomyPillar = {
	key: BusinessTaxonomyPillarKey;
	/** Short human-readable description of what this pillar covers —
	 * documentation only, never read by the matcher. */
	purpose: string;
	terms: { en: string[]; pl: string[] };
	adjacentTerms: { en: string[]; pl: string[] };
};

/**
 * "none" | "adjacent" | "core" — exactly three levels, not four. See
 * BusinessTaxonomyPillar's doc comment for why a fourth was rejected.
 */
export type BusinessRelevanceLevel = "none" | "adjacent" | "core";

/** Which of a pillar's two term lists produced a given match. */
export type BusinessRelevanceTermTier = "term" | "adjacentTerm";

/** Which of a term's two language lists produced a given match.
 * Independent of any market/locale — see businessRelevance.ts. */
export type BusinessRelevanceLanguage = "en" | "pl";

/** One matched taxonomy entry, kept as its own record (never collapsed
 * into just a level) so a caller can explain *why* a keyword was
 * classified the way it was. */
export type BusinessRelevanceMatch = {
	pillarKey: BusinessTaxonomyPillarKey;
	/** The taxonomy entry's own text, verbatim as declared in
	 * businessTaxonomy.ts — not the normalized/tokenized form. */
	matchedTerm: string;
	matchedTermTier: BusinessRelevanceTermTier;
	matchedLanguage: BusinessRelevanceLanguage;
};

/**
 * Full result for one keyword. `matches` is never truncated to "the
 * best one" — when both a `term` and an `adjacentTerm` match (in the
 * same or different pillars), `level` is still "core" (a `term` match
 * always wins — see businessRelevance.ts), but every match, at every
 * tier, stays in `matches` for explainability. Ordering is deterministic
 * — see evaluateBusinessRelevance's own doc comment for the exact rule.
 */
export type BusinessRelevanceEvidence = {
	level: BusinessRelevanceLevel;
	matches: BusinessRelevanceMatch[];
};
