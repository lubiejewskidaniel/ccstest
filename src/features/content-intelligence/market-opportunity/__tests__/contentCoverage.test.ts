import { describe, it, expect } from "vitest";
import { evaluateContentCoverage, type ArticleCandidateForCoverage } from "../contentCoverage";
import type { MarketCode } from "../../market/types";
import type { ArticleStatus } from "../../../insights/types/article";

// ------------------------------------------------------------------
// Test helpers
// ------------------------------------------------------------------

const GB: MarketCode = { country: "gb", language: "en-GB" };
const PL: MarketCode = { country: "pl", language: "pl-PL" };

let nextId = 1;

function article(overrides: Partial<ArticleCandidateForCoverage> = {}): ArticleCandidateForCoverage {
	const id = `article-${nextId++}`;
	return {
		id,
		locale: "en",
		slug: `slug-${id}`,
		title: "Untitled",
		excerpt: "No excerpt.",
		status: "published",
		...overrides,
	};
}

// ------------------------------------------------------------------
// 1. No articles
// ------------------------------------------------------------------

describe("evaluateContentCoverage — no articles", () => {
	it("returns none/null with empty arrays when there are no candidate articles at all", () => {
		const result = evaluateContentCoverage({ keyword: "seo", market: GB, articles: [] });
		expect(result).toEqual({ level: "none", mapping: null, titleMatches: [], excerptOnlyMatches: [] });
	});
});

// ------------------------------------------------------------------
// 2 & 19. Non-published articles are ignored
// ------------------------------------------------------------------

describe("evaluateContentCoverage — published-only rule", () => {
	it("ignores a non-published (draft) article that would otherwise title-match", () => {
		const a = article({ locale: "en", title: "SEO Agency Guide", status: "draft" });
		const result = evaluateContentCoverage({ keyword: "seo agency", market: GB, articles: [a] });
		expect(result.level).toBe("none");
		expect(result.titleMatches).toEqual([]);
	});

	const nonPublishedStatuses: ArticleStatus[] = ["draft", "in_review", "scheduled", "archived"];

	it.each(nonPublishedStatuses)(
		"a %s article never counts as coverage, using the real ArticleStatus values",
		(status) => {
			const a = article({ locale: "en", title: "SEO Agency Guide", status });
			const result = evaluateContentCoverage({ keyword: "seo agency", market: GB, articles: [a] });
			expect(result.level).toBe("none");
			expect(result.mapping).toBeNull();
		},
	);

	it("only 'published' (not any other casing/value) is treated as eligible", () => {
		// "Published" is not a real ArticleStatus member -- cast deliberately
		// to prove the runtime comparison stays an exact literal match even
		// against a value that couldn't arise from code respecting the real
		// type (e.g. data from an untyped source).
		const a = article({ locale: "en", title: "SEO Agency Guide", status: "Published" as unknown as ArticleStatus });
		const result = evaluateContentCoverage({ keyword: "seo agency", market: GB, articles: [a] });
		expect(result.level).toBe("none");
	});
});

// ------------------------------------------------------------------
// 3, 4, 5, 20. Locale / market eligibility
// ------------------------------------------------------------------

describe("evaluateContentCoverage — locale/market eligibility", () => {
	it("counts a published EN article for the GB market", () => {
		const a = article({ locale: "en", title: "SEO Agency Guide", status: "published" });
		const result = evaluateContentCoverage({ keyword: "seo agency", market: GB, articles: [a] });
		expect(result.level).toBe("title_match");
		expect(result.titleMatches).toEqual([{ articleId: a.id, locale: "en", slug: a.slug }]);
	});

	it("ignores a published PL article for the GB market even though the text matches", () => {
		const a = article({ locale: "pl", title: "SEO Agency Guide", status: "published" });
		const result = evaluateContentCoverage({ keyword: "seo agency", market: GB, articles: [a] });
		expect(result.level).toBe("none");
	});

	it("counts a published PL article for the PL market", () => {
		const a = article({ locale: "pl", title: "Pozycjonowanie stron dla firm", status: "published" });
		const result = evaluateContentCoverage({ keyword: "pozycjonowanie stron", market: PL, articles: [a] });
		expect(result.level).toBe("title_match");
		expect(result.titleMatches).toEqual([{ articleId: a.id, locale: "pl", slug: a.slug }]);
	});

	it("ignores a published EN article for the PL market even though the text matches", () => {
		const a = article({ locale: "en", title: "SEO Agency Guide", status: "published" });
		const result = evaluateContentCoverage({ keyword: "seo agency", market: PL, articles: [a] });
		expect(result.level).toBe("none");
	});

	it("a wrong-locale article never affects ambiguity, even alongside a real match", () => {
		const correct = article({ locale: "en", title: "SEO Agency Guide", status: "published" });
		const wrongLocale = article({ locale: "pl", title: "SEO Agency Guide", status: "published" });
		const result = evaluateContentCoverage({ keyword: "seo agency", market: GB, articles: [correct, wrongLocale] });
		expect(result.level).toBe("title_match");
		expect(result.mapping).toBe("unambiguous");
		expect(result.titleMatches).toEqual([{ articleId: correct.id, locale: "en", slug: correct.slug }]);
	});
});

// ------------------------------------------------------------------
// 6, 7. Title match level + mapping
// ------------------------------------------------------------------

describe("evaluateContentCoverage — title_match level", () => {
	it("exact phrase in one title -> title_match / unambiguous", () => {
		const a = article({ locale: "en", title: "SEO for Small Business: Practical Guide", status: "published" });
		const result = evaluateContentCoverage({ keyword: "seo for small business", market: GB, articles: [a] });
		expect(result.level).toBe("title_match");
		expect(result.mapping).toBe("unambiguous");
		expect(result.titleMatches).toHaveLength(1);
	});

	it("the same phrase title-matching two articles -> title_match / ambiguous", () => {
		const a = article({ locale: "en", title: "SEO for Small Business: Guide One", status: "published" });
		const b = article({ locale: "en", title: "SEO for Small Business: Guide Two", status: "published" });
		const result = evaluateContentCoverage({ keyword: "seo for small business", market: GB, articles: [a, b] });
		expect(result.level).toBe("title_match");
		expect(result.mapping).toBe("ambiguous");
		expect(result.titleMatches).toHaveLength(2);
	});
});

// ------------------------------------------------------------------
// 8, 9. Mention level + mapping
// ------------------------------------------------------------------

describe("evaluateContentCoverage — mention level", () => {
	it("phrase only in one excerpt -> mention / unambiguous", () => {
		const a = article({
			locale: "en",
			title: "A General Marketing Roundup",
			excerpt: "This roundup briefly covers seo for small business among other topics.",
			status: "published",
		});
		const result = evaluateContentCoverage({ keyword: "seo for small business", market: GB, articles: [a] });
		expect(result.level).toBe("mention");
		expect(result.mapping).toBe("unambiguous");
		expect(result.excerptOnlyMatches).toEqual([{ articleId: a.id, locale: "en", slug: a.slug }]);
		expect(result.titleMatches).toEqual([]);
	});

	it("phrase in two excerpts only -> mention / ambiguous", () => {
		const a = article({
			locale: "en",
			title: "Roundup One",
			excerpt: "Covers seo for small business briefly.",
			status: "published",
		});
		const b = article({
			locale: "en",
			title: "Roundup Two",
			excerpt: "Also mentions seo for small business in passing.",
			status: "published",
		});
		const result = evaluateContentCoverage({ keyword: "seo for small business", market: GB, articles: [a, b] });
		expect(result.level).toBe("mention");
		expect(result.mapping).toBe("ambiguous");
		expect(result.excerptOnlyMatches).toHaveLength(2);
	});
});

// ------------------------------------------------------------------
// 10, 11. Title vs excerpt precedence and non-duplication
// ------------------------------------------------------------------

describe("evaluateContentCoverage — title/excerpt precedence", () => {
	it("an article matching both title and excerpt appears only in titleMatches", () => {
		const a = article({
			locale: "en",
			title: "SEO for Small Business: Practical Guide",
			excerpt: "This guide on seo for small business covers the basics.",
			status: "published",
		});
		const result = evaluateContentCoverage({ keyword: "seo for small business", market: GB, articles: [a] });
		expect(result.level).toBe("title_match");
		expect(result.titleMatches).toEqual([{ articleId: a.id, locale: "en", slug: a.slug }]);
		expect(result.excerptOnlyMatches).toEqual([]);
	});

	it("one title match plus many excerpt-only matches -> title_match, mapping based only on the title match", () => {
		const titleMatch = article({ locale: "en", title: "SEO for Small Business: Practical Guide", status: "published" });
		const excerptOnlyA = article({
			locale: "en",
			title: "Marketing Roundup A",
			excerpt: "Mentions seo for small business in passing.",
			status: "published",
		});
		const excerptOnlyB = article({
			locale: "en",
			title: "Marketing Roundup B",
			excerpt: "Also mentions seo for small business briefly.",
			status: "published",
		});
		const result = evaluateContentCoverage({
			keyword: "seo for small business",
			market: GB,
			articles: [titleMatch, excerptOnlyA, excerptOnlyB],
		});
		expect(result.level).toBe("title_match");
		// Two excerpt-only matches exist, but mapping must be driven ONLY
		// by the single title match, not downgraded by the excerpt count.
		expect(result.mapping).toBe("unambiguous");
		expect(result.titleMatches).toHaveLength(1);
		expect(result.excerptOnlyMatches).toHaveLength(2);
	});
});

// ------------------------------------------------------------------
// 12, 13. Match direction (mandatory directionality tests)
// ------------------------------------------------------------------

describe("evaluateContentCoverage — match direction", () => {
	it("keyword 'seo' matches a longer title 'SEO for Small Business' (title contains keyword)", () => {
		const a = article({ locale: "en", title: "SEO for Small Business", status: "published" });
		const result = evaluateContentCoverage({ keyword: "seo", market: GB, articles: [a] });
		expect(result.level).toBe("title_match");
		expect(result.titleMatches).toHaveLength(1);
	});

	it("keyword 'seo for small business' does NOT match a shorter title 'SEO' (keyword must not merely contain the title)", () => {
		const a = article({ locale: "en", title: "SEO", status: "published" });
		const result = evaluateContentCoverage({ keyword: "seo for small business", market: GB, articles: [a] });
		expect(result.level).toBe("none");
		expect(result.titleMatches).toEqual([]);
	});
});

// ------------------------------------------------------------------
// 14. Punctuation normalization
// ------------------------------------------------------------------

describe("evaluateContentCoverage — punctuation normalization", () => {
	it("treats Next.js / Next-js / Next js as the same phrase in both keyword and article text", () => {
		const a = article({ locale: "en", title: "We offer Next-js Consulting services", status: "published" });
		const result = evaluateContentCoverage({ keyword: "Next.js consulting", market: GB, articles: [a] });
		expect(result.level).toBe("title_match");
	});

	it("a solid compound 'nextjs' does not satisfy the two-token keyword 'next.js'", () => {
		const a = article({ locale: "en", title: "Nextjs developers for hire", status: "published" });
		const result = evaluateContentCoverage({ keyword: "next.js developers", market: GB, articles: [a] });
		expect(result.level).toBe("none");
	});
});

// ------------------------------------------------------------------
// 15. Polish diacritics preserved
// ------------------------------------------------------------------

describe("evaluateContentCoverage — Polish diacritics", () => {
	it("matches a Polish phrase with diacritics intact, surrounded by other diacritic words", () => {
		const a = article({
			locale: "pl",
			title: "Kompleksowe wdrożenie VPS dla małych firm",
			status: "published",
		});
		const result = evaluateContentCoverage({ keyword: "wdrożenie vps", market: PL, articles: [a] });
		expect(result.level).toBe("title_match");
	});

	it("does NOT match an ASCII-folded variant against a diacritic original (diacritics are never stripped)", () => {
		const a = article({ locale: "pl", title: "Łatwość obsługi naszej platformy", status: "published" });
		const result = evaluateContentCoverage({ keyword: "latwosc obslugi", market: PL, articles: [a] });
		expect(result.level).toBe("none");
	});

	it("matches the same phrase when the diacritics are given correctly", () => {
		const a = article({ locale: "pl", title: "Łatwość obsługi naszej platformy", status: "published" });
		const result = evaluateContentCoverage({ keyword: "łatwość obsługi", market: PL, articles: [a] });
		expect(result.level).toBe("title_match");
	});
});

// ------------------------------------------------------------------
// 16, 17. Empty / whitespace-only keyword
// ------------------------------------------------------------------

describe("evaluateContentCoverage — empty/invalid keyword", () => {
	it("an empty keyword returns none/null even when a matching article exists, without throwing", () => {
		const a = article({ locale: "en", title: "SEO Agency Guide", status: "published" });
		expect(() => evaluateContentCoverage({ keyword: "", market: GB, articles: [a] })).not.toThrow();
		const result = evaluateContentCoverage({ keyword: "", market: GB, articles: [a] });
		expect(result).toEqual({ level: "none", mapping: null, titleMatches: [], excerptOnlyMatches: [] });
	});

	it("a whitespace-only keyword returns none/null even when a matching article exists, without throwing", () => {
		const a = article({ locale: "en", title: "SEO Agency Guide", status: "published" });
		expect(() => evaluateContentCoverage({ keyword: "   ", market: GB, articles: [a] })).not.toThrow();
		const result = evaluateContentCoverage({ keyword: "   ", market: GB, articles: [a] });
		expect(result).toEqual({ level: "none", mapping: null, titleMatches: [], excerptOnlyMatches: [] });
	});
});

// ------------------------------------------------------------------
// 18. Deterministic output ordering
// ------------------------------------------------------------------

describe("evaluateContentCoverage — deterministic ordering", () => {
	it("preserves input article order rather than sorting by id/slug/title", () => {
		// Deliberately given in an order that would look "wrong" under any
		// alphabetical sort, to prove no accidental sorting happens.
		const zebra = article({ locale: "en", slug: "zebra-guide", title: "SEO for Small Business: Zebra Edition", status: "published" });
		const apple = article({ locale: "en", slug: "apple-guide", title: "SEO for Small Business: Apple Edition", status: "published" });

		const result = evaluateContentCoverage({ keyword: "seo for small business", market: GB, articles: [zebra, apple] });

		expect(result.level).toBe("title_match");
		expect(result.titleMatches.map((m) => m.slug)).toEqual(["zebra-guide", "apple-guide"]);
	});

	it("produces identical output across repeated calls with the same input", () => {
		const a = article({ locale: "en", title: "SEO for Small Business", status: "published" });
		const b = article({ locale: "en", title: "SEO for Small Business Two", status: "published" });
		const first = evaluateContentCoverage({ keyword: "seo for small business", market: GB, articles: [a, b] });
		const second = evaluateContentCoverage({ keyword: "seo for small business", market: GB, articles: [a, b] });
		expect(second).toEqual(first);
	});
});
