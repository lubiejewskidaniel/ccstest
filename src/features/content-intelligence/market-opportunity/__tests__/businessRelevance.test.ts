import { describe, it, expect } from "vitest";
import {
	normalize,
	containsPhrase,
	matchesTerm,
	evaluateBusinessRelevance,
	evaluateRelevanceAgainstTaxonomy,
} from "../businessRelevance";
import { BUSINESS_TAXONOMY } from "../businessTaxonomy";
import type { BusinessTaxonomyPillar } from "../types";

// ------------------------------------------------------------------
// A. Normalization
// ------------------------------------------------------------------

describe("normalize", () => {
	it("collapses Next.js, next-js and next js to the same normalized string", () => {
		expect(normalize("Next.js")).toBe(normalize("next-js"));
		expect(normalize("next-js")).toBe(normalize("next js"));
		expect(normalize("Next.js")).toBe("next js");
	});

	it("keeps nextjs (no separator) distinct from next.js", () => {
		expect(normalize("nextjs")).toBe("nextjs");
		expect(normalize("nextjs")).not.toBe(normalize("next.js"));
	});

	it("collapses repeated internal whitespace and trims", () => {
		expect(normalize("  next    js  ")).toBe("next js");
		expect(normalize("\tnext\n\njs\t")).toBe("next js");
	});

	it("turns punctuation into separators rather than deleting it", () => {
		expect(normalize("SEO, agency: pricing?")).toBe("seo agency pricing");
		expect(normalize("(web design)")).toBe("web design");
		expect(normalize("client's website")).toBe("client s website");
	});

	it("preserves Polish diacritics", () => {
		expect(normalize("Pozycjonowanie Stron")).toBe("pozycjonowanie stron");
		expect(normalize("Wdrożenie VPS")).toBe("wdrożenie vps");
		expect(normalize("dostępność strony www")).toBe("dostępność strony www");
		// Explicitly not folded/stripped to ASCII.
		expect(normalize("łatwość")).toContain("ł");
	});
});

// ------------------------------------------------------------------
// B. Token boundaries
// ------------------------------------------------------------------

describe("token-boundary matching (containsPhrase / matchesTerm)", () => {
	it("matches 'seo' as a whole token", () => {
		expect(matchesTerm("seo agency", "seo")).toBe(true);
	});

	it("does not match 'seo' inside the unrelated token 'kaseo'", () => {
		expect(matchesTerm("kaseo experts", "seo")).toBe(false);
	});

	it("does not match 'ai' inside the unrelated token 'air'", () => {
		expect(matchesTerm("air conditioning", "ai")).toBe(false);
	});

	it("requires contiguous, in-order tokens for multi-word terms", () => {
		expect(containsPhrase(["landing", "page", "design"], ["landing", "page"])).toBe(true);
		expect(containsPhrase(["page", "landing", "design"], ["landing", "page"])).toBe(false);
		expect(containsPhrase(["landing", "new", "page"], ["landing", "page"])).toBe(false);
	});

	it("nextjs (one token) does not satisfy the two-token term next.js, and vice versa", () => {
		expect(matchesTerm("nextjs developer", "nextjs")).toBe(true);
		expect(matchesTerm("nextjs developer", "next.js")).toBe(false);
		expect(matchesTerm("next.js developer", "next.js")).toBe(true);
		expect(matchesTerm("next.js developer", "nextjs")).toBe(false);
	});
});

// ------------------------------------------------------------------
// C. Relevance classification
// ------------------------------------------------------------------

describe("evaluateBusinessRelevance — classification", () => {
	it("classifies 'next.js development agency' as core / software-development", () => {
		const result = evaluateBusinessRelevance("next.js development agency");
		expect(result.level).toBe("core");
		expect(result.matches).toContainEqual({
			pillarKey: "software-development",
			matchedTerm: "next.js development",
			matchedTermTier: "term",
			matchedLanguage: "en",
		});
	});

	it("classifies 'online visibility' as adjacent / growth-marketing", () => {
		const result = evaluateBusinessRelevance("online visibility");
		expect(result.level).toBe("adjacent");
		expect(result.matches).toEqual([
			{
				pillarKey: "growth-marketing",
				matchedTerm: "online visibility",
				matchedTermTier: "adjacentTerm",
				matchedLanguage: "en",
			},
		]);
	});

	it("classifies 'generative engine optimization services' as core / growth-marketing", () => {
		const result = evaluateBusinessRelevance("generative engine optimization services");
		expect(result.level).toBe("core");
		expect(result.matches).toContainEqual({
			pillarKey: "growth-marketing",
			matchedTerm: "generative engine optimization",
			matchedTermTier: "term",
			matchedLanguage: "en",
		});
	});

	it("classifies 'geo data visualization' as none", () => {
		const result = evaluateBusinessRelevance("geo data visualization");
		expect(result.level).toBe("none");
		expect(result.matches).toEqual([]);
	});

	it("classifies 'banana bread recipe' as none", () => {
		const result = evaluateBusinessRelevance("banana bread recipe");
		expect(result.level).toBe("none");
		expect(result.matches).toEqual([]);
	});
});

// ------------------------------------------------------------------
// D. Bilingual matching
// ------------------------------------------------------------------

describe("evaluateBusinessRelevance — bilingual matching", () => {
	it("returns matchedLanguage: 'pl' for a Polish approved phrase", () => {
		const result = evaluateBusinessRelevance("pozycjonowanie stron dla małej firmy");
		expect(result.level).toBe("core");
		expect(result.matches).toContainEqual({
			pillarKey: "growth-marketing",
			matchedTerm: "pozycjonowanie stron",
			matchedTermTier: "term",
			matchedLanguage: "pl",
		});
	});

	it("returns matchedLanguage: 'en' for an English approved phrase", () => {
		const result = evaluateBusinessRelevance("software development for startups");
		expect(result.level).toBe("core");
		expect(result.matches).toContainEqual({
			pillarKey: "software-development",
			matchedTerm: "software development",
			matchedTermTier: "term",
			matchedLanguage: "en",
		});
	});

	it("evaluates both language lists without any market/locale parameter at all", () => {
		// evaluateBusinessRelevance takes only a keyword -- there is no
		// MarketCode or locale argument to restrict which language list
		// runs, so a Polish phrase matches regardless of any notion of
		// which market the keyword came from.
		expect(evaluateBusinessRelevance).toHaveLength(1);
		const result = evaluateBusinessRelevance("mentoring programowania dla juniorów");
		expect(result.level).toBe("core");
		expect(result.matches.some((m) => m.matchedLanguage === "pl" && m.pillarKey === "mentoring")).toBe(true);
	});
});

// ------------------------------------------------------------------
// E. Precedence (core wins, but adjacent evidence is retained)
// ------------------------------------------------------------------

describe("evaluateBusinessRelevance — precedence", () => {
	it("reports level 'core' when both a term and an adjacentTerm match, keeping both matches", () => {
		const result = evaluateBusinessRelevance("seo and online visibility improvements");
		expect(result.level).toBe("core");
		expect(result.matches).toContainEqual({
			pillarKey: "growth-marketing",
			matchedTerm: "seo",
			matchedTermTier: "term",
			matchedLanguage: "en",
		});
		expect(result.matches).toContainEqual({
			pillarKey: "growth-marketing",
			matchedTerm: "online visibility",
			matchedTermTier: "adjacentTerm",
			matchedLanguage: "en",
		});
		expect(result.matches.length).toBeGreaterThanOrEqual(2);
	});
});

// ------------------------------------------------------------------
// F. Taxonomy safety
// ------------------------------------------------------------------

describe("BUSINESS_TAXONOMY — safety", () => {
	it("never configures bare 'geo' anywhere in growth-marketing's term lists", () => {
		const growthMarketing = BUSINESS_TAXONOMY.find((pillar) => pillar.key === "growth-marketing");
		// Non-null assertion justified by the assertion immediately above --
		// this test fails loudly at `toBeDefined()` first if the pillar is
		// ever renamed or removed, rather than failing confusingly below.
		expect(growthMarketing).toBeDefined();
		const allLists = [
			...growthMarketing!.terms.en,
			...growthMarketing!.terms.pl,
			...growthMarketing!.adjacentTerms.en,
			...growthMarketing!.adjacentTerms.pl,
		];
		for (const term of allLists) {
			expect(normalize(term)).not.toBe("geo");
		}
	});

	it("never configures the documented dangerously-broad words as standalone entries", () => {
		const forbiddenByPillar: Record<string, string[]> = {
			"software-development": [
				"software",
				"app",
				"application",
				"development",
				"system",
				"code",
				"programming",
				"technology",
				"react",
				"node",
				"deployment",
				"infrastructure",
				"integration",
			],
			"product-development": ["product", "mvp"],
			"technology-consulting": ["consulting", "audit", "technology", "strategy", "advisory"],
			"web-digital": ["website", "platform", "design", "performance", "web", "site"],
			"growth-marketing": ["marketing", "growth", "visibility", "advertising", "content", "geo"],
			mentoring: ["mentoring", "education", "learning", "coach", "coaching", "lessons"],
		};

		for (const pillar of BUSINESS_TAXONOMY) {
			const forbidden = forbiddenByPillar[pillar.key] ?? [];
			const allLists = [...pillar.terms.en, ...pillar.terms.pl, ...pillar.adjacentTerms.en, ...pillar.adjacentTerms.pl];
			for (const term of allLists) {
				expect(forbidden).not.toContain(normalize(term));
			}
		}
	});
});

// ------------------------------------------------------------------
// G. Deterministic ordering / deduplication
// ------------------------------------------------------------------

describe("evaluateBusinessRelevance — deterministic ordering", () => {
	it("produces the same match order across repeated calls with the same input", () => {
		const first = evaluateBusinessRelevance("seo and next.js development");
		const second = evaluateBusinessRelevance("seo and next.js development");
		expect(second.matches).toEqual(first.matches);
	});

	it("orders matches by taxonomy pillar declaration order, not by keyword position", () => {
		// "seo" (growth-marketing, pillar index 4) appears BEFORE
		// "next.js development" (software-development, pillar index 0) in
		// the raw keyword text, but software-development is declared
		// first in BUSINESS_TAXONOMY, so its match must come first.
		const result = evaluateBusinessRelevance("seo and next.js development");
		const pillarOrder = result.matches.map((match) => match.pillarKey);
		const softwareIndex = pillarOrder.indexOf("software-development");
		const growthIndex = pillarOrder.indexOf("growth-marketing");
		expect(softwareIndex).toBeGreaterThanOrEqual(0);
		expect(growthIndex).toBeGreaterThanOrEqual(0);
		expect(softwareIndex).toBeLessThan(growthIndex);
	});
});

describe("evaluateRelevanceAgainstTaxonomy — deduplication", () => {
	it("collapses taxonomy entries that normalize to the same token sequence into one match, keeping the first declared", () => {
		const fixtureTaxonomy: BusinessTaxonomyPillar[] = [
			{
				key: "software-development",
				purpose: "test fixture",
				terms: { en: ["next js", "next-js", "next.js"], pl: [] },
				adjacentTerms: { en: [], pl: [] },
			},
		];

		const result = evaluateRelevanceAgainstTaxonomy("looking for a next.js consultant", fixtureTaxonomy);

		expect(result.level).toBe("core");
		expect(result.matches).toHaveLength(1);
		expect(result.matches[0]).toEqual({
			pillarKey: "software-development",
			matchedTerm: "next js",
			matchedTermTier: "term",
			matchedLanguage: "en",
		});
	});

	it("does NOT deduplicate the same literal term across different languages", () => {
		const fixtureTaxonomy: BusinessTaxonomyPillar[] = [
			{
				key: "growth-marketing",
				purpose: "test fixture",
				terms: { en: ["seo"], pl: ["seo"] },
				adjacentTerms: { en: [], pl: [] },
			},
		];

		const result = evaluateRelevanceAgainstTaxonomy("seo", fixtureTaxonomy);

		expect(result.matches).toHaveLength(2);
		expect(result.matches.map((m) => m.matchedLanguage).sort()).toEqual(["en", "pl"]);
	});
});
