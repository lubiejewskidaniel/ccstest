import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CategoryKey } from "@/features/insights/types/article";
import { buildArticleVisualBrief, type ArticleVisualBriefInput } from "../articleVisualBrief";

/**
 * Phase 3C.4B.1 — coverage for the pure, deterministic Article Visual
 * Brief transformation. This module has no I/O and no side effects, so
 * every behavioral test below calls the real function directly with
 * plain data — no mocking is needed or used.
 *
 * The "no provider/prompt/model/image concepts" and "no I/O/randomness"
 * tests inspect this module's own real source text, resolved from
 * `process.cwd()` (never `import.meta.url`, which throws on Windows —
 * see market-opportunity/__tests__/queries.test.ts for the original fix
 * this follows) and with comments stripped first, the same corrected
 * structural-test pattern already used in
 * market-opportunity/__tests__/MarketOpportunityInspector.structure.test.ts
 * (a naive substring check on raw source text false-positives on this
 * file's own doc comments, which necessarily *name* the forbidden
 * concepts to explain why they're absent).
 */

function validInput(overrides: Partial<ArticleVisualBriefInput> = {}): ArticleVisualBriefInput {
	return {
		title: "How We Cut Build Times in Half",
		excerpt: "A practical walkthrough of the caching and pipeline changes that halved our CI build times.",
		category: { key: "build", name: "Build" },
		locale: "en",
		...overrides,
	};
}

describe("buildArticleVisualBrief — valid inputs", () => {
	it("returns a valid brief for an EN article", () => {
		const result = buildArticleVisualBrief(validInput());
		expect(result.ok).toBe(true);
	});

	it("returns a valid brief for a PL article", () => {
		const result = buildArticleVisualBrief(validInput({ locale: "pl", title: "Jak skróciliśmy czas budowania o połowę" }));
		expect(result.ok).toBe(true);
	});

	it("subject is the trimmed real title -- no paraphrasing, summarising, or rewriting", () => {
		const result = buildArticleVisualBrief(validInput({ title: "   Padded Title With Spaces   " }));
		if (!result.ok) throw new Error("expected ok:true");
		expect(result.brief.subject).toBe("Padded Title With Spaces");
	});

	it.each(["build", "grow", "learn", "studio"] as const)("accepts and passes through categoryKey %j unchanged", (key) => {
		const result = buildArticleVisualBrief(validInput({ category: { key, name: key } }));
		if (!result.ok) throw new Error("expected ok:true");
		expect(result.brief.categoryKey).toBe(key);
	});
});

describe("buildArticleVisualBrief — requiredElements (V1: always empty, no inference)", () => {
	it("requiredElements is [] for a normal valid input", () => {
		const result = buildArticleVisualBrief(validInput());
		if (!result.ok) throw new Error("expected ok:true");
		expect(result.brief.requiredElements).toEqual([]);
	});

	it("keyPoints containing 'chart' does not populate requiredElements", () => {
		const result = buildArticleVisualBrief(validInput({ keyPoints: "Include a chart showing the before/after numbers." }));
		if (!result.ok) throw new Error("expected ok:true");
		expect(result.brief.requiredElements).toEqual([]);
	});

	it("keyPoints containing 'checklist' does not populate requiredElements", () => {
		const result = buildArticleVisualBrief(validInput({ keyPoints: "Structure this as a step-by-step checklist." }));
		if (!result.ok) throw new Error("expected ok:true");
		expect(result.brief.requiredElements).toEqual([]);
	});

	it("arbitrary keyPoints content never alters the rest of the output", () => {
		const withoutKeyPoints = buildArticleVisualBrief(validInput());
		const withKeyPoints = buildArticleVisualBrief(
			validInput({ keyPoints: "dashboard, metrics, guide, steps -- none of this should matter" })
		);
		if (!withoutKeyPoints.ok || !withKeyPoints.ok) throw new Error("expected ok:true");
		expect(withKeyPoints.brief).toEqual(withoutKeyPoints.brief);
	});

	it("null keyPoints works", () => {
		const result = buildArticleVisualBrief(validInput({ keyPoints: null }));
		expect(result.ok).toBe(true);
	});

	it("omitted keyPoints works", () => {
		const input = validInput();
		delete (input as { keyPoints?: string | null }).keyPoints;
		const result = buildArticleVisualBrief(input);
		expect(result.ok).toBe(true);
	});
});

describe("buildArticleVisualBrief — avoidElements (fixed, V1)", () => {
	const EXPECTED_AVOID_ELEMENTS = [
		"embedded text unless explicitly required",
		"fabricated UI screenshots",
		"real logos or trademarks",
		"fake endorsements",
		"stock-photo-style generic business imagery",
		"invented statistics or fabricated data values",
	];

	it("returns the exact fixed avoidElements values", () => {
		const result = buildArticleVisualBrief(validInput());
		if (!result.ok) throw new Error("expected ok:true");
		expect(result.brief.avoidElements).toEqual(EXPECTED_AVOID_ELEMENTS);
	});

	it("returns avoidElements in the exact fixed order", () => {
		const result = buildArticleVisualBrief(validInput());
		if (!result.ok) throw new Error("expected ok:true");
		expect(result.brief.avoidElements.join("|")).toBe(EXPECTED_AVOID_ELEMENTS.join("|"));
	});

	it("mutating one call's avoidElements array does not affect a later call's result", () => {
		const first = buildArticleVisualBrief(validInput());
		if (!first.ok) throw new Error("expected ok:true");
		first.brief.avoidElements.push("something injected by a careless caller");
		first.brief.avoidElements[0] = "mutated";

		const second = buildArticleVisualBrief(validInput());
		if (!second.ok) throw new Error("expected ok:true");
		expect(second.brief.avoidElements).toEqual(EXPECTED_AVOID_ELEMENTS);
	});
});

describe("buildArticleVisualBrief — insufficient context", () => {
	it("rejects an empty title", () => {
		const result = buildArticleVisualBrief(validInput({ title: "" }));
		expect(result.ok).toBe(false);
	});

	it("rejects a whitespace-only title", () => {
		const result = buildArticleVisualBrief(validInput({ title: "   " }));
		expect(result.ok).toBe(false);
	});

	it("rejects an empty excerpt", () => {
		const result = buildArticleVisualBrief(validInput({ excerpt: "" }));
		expect(result.ok).toBe(false);
	});

	it("rejects a whitespace-only excerpt", () => {
		const result = buildArticleVisualBrief(validInput({ excerpt: "                    " }));
		expect(result.ok).toBe(false);
	});

	it("rejects a 19-character trimmed excerpt", () => {
		const excerpt = "a".repeat(19);
		expect(excerpt.trim().length).toBe(19);
		const result = buildArticleVisualBrief(validInput({ excerpt }));
		expect(result.ok).toBe(false);
	});

	it("accepts a 20-character trimmed excerpt", () => {
		const excerpt = "a".repeat(20);
		expect(excerpt.trim().length).toBe(20);
		const result = buildArticleVisualBrief(validInput({ excerpt }));
		expect(result.ok).toBe(true);
	});

	it("rejects an invalid category key from a malformed runtime caller (test-only cast, production types unweakened)", () => {
		const result = buildArticleVisualBrief(
			validInput({ category: { key: "not-a-real-category" as unknown as CategoryKey, name: "Bogus" } })
		);
		expect(result.ok).toBe(false);
	});

	it("every failure carries kind: insufficient_context", () => {
		const cases: ArticleVisualBriefInput[] = [
			validInput({ title: "" }),
			validInput({ excerpt: "" }),
			validInput({ excerpt: "too short" }),
			validInput({ category: { key: "nope" as unknown as CategoryKey, name: "Nope" } }),
		];
		for (const input of cases) {
			const result = buildArticleVisualBrief(input);
			expect(result.ok).toBe(false);
			if (!result.ok) expect(result.kind).toBe("insufficient_context");
		}
	});

	it("every failure carries a non-empty, deterministic message", () => {
		const input = validInput({ title: "" });
		const first = buildArticleVisualBrief(input);
		const second = buildArticleVisualBrief(input);
		if (first.ok || second.ok) throw new Error("expected ok:false");
		expect(first.message.length).toBeGreaterThan(0);
		expect(first.message).toBe(second.message);
	});
});

describe("buildArticleVisualBrief — determinism and purity", () => {
	it("identical input called twice produces a deeply-equal result", () => {
		const input = validInput({ keyPoints: "some context" });
		const first = buildArticleVisualBrief(input);
		const second = buildArticleVisualBrief(input);
		expect(first).toEqual(second);
	});

	it("does not mutate the input object", () => {
		const input = validInput();
		const snapshot = JSON.parse(JSON.stringify(input));
		buildArticleVisualBrief(input);
		expect(input).toEqual(snapshot);
	});

	it("output contains only the approved brief fields", () => {
		const result = buildArticleVisualBrief(validInput());
		if (!result.ok) throw new Error("expected ok:true");
		expect(Object.keys(result.brief).sort()).toEqual(
			["altText", "avoidElements", "categoryKey", "locale", "requiredElements", "subject"].sort()
		);
	});
});

describe("buildArticleVisualBrief — alt text", () => {
	it("EN alt text contains the trimmed title and follows the EN template", () => {
		const result = buildArticleVisualBrief(validInput({ locale: "en", title: "  Spaced Title  " }));
		if (!result.ok) throw new Error("expected ok:true");
		expect(result.brief.altText).toBe('Cover illustration for the article "Spaced Title"');
	});

	it("PL alt text contains the trimmed title and follows the PL template", () => {
		const result = buildArticleVisualBrief(validInput({ locale: "pl", title: "  Tytuł z odstępami  " }));
		if (!result.ok) throw new Error("expected ok:true");
		expect(result.brief.altText).toBe("Ilustracja do artykułu „Tytuł z odstępami”");
	});
});

describe("buildArticleVisualBrief — structural purity (source-inspection)", () => {
	const SOURCE_PATH = resolve(process.cwd(), "src/features/content-intelligence/visuals/articleVisualBrief.ts");
	const source = readFileSync(SOURCE_PATH, "utf8");
	// Comments stripped first -- this module's own doc comments legitimately
	// *name* forbidden concepts (prompt, provider, LLM, Supabase, etc.) to
	// document why they're absent, so a naive raw-source substring check
	// would false-positive exactly the way already fixed once in
	// market-opportunity/__tests__/MarketOpportunityInspector.structure.test.ts.
	const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

	it("never references forbidden provider/prompt/model/image-result field names in real code", () => {
		const forbidden = [
			"prompt",
			"promptText",
			"providerId",
			"imageUrl",
			"assetId",
			"mimeType",
			"articleId",
			"briefId",
			"coverImageStatus",
			"generatedAt",
			"reviewedAt",
			"visualDirection",
		];
		for (const term of forbidden) {
			expect(codeOnly.includes(term)).toBe(false);
		}
		// "provider" and "model" alone are substrings of common English
		// words this module's real doc comments legitimately use (e.g.
		// "provider-agnostic", "modelling") -- checked as whole words
		// against comment-stripped code instead.
		expect(/\bprovider\b/.test(codeOnly)).toBe(false);
		expect(/\bmodel\b/.test(codeOnly)).toBe(false);
		expect(/\bseed\b/.test(codeOnly)).toBe(false);
		expect(/\bwidth\b/.test(codeOnly)).toBe(false);
		expect(/\bheight\b/.test(codeOnly)).toBe(false);
	});

	it("never imports Supabase, fetch, or the filesystem", () => {
		expect(codeOnly.includes("supabase")).toBe(false);
		expect(codeOnly.includes("Supabase")).toBe(false);
		expect(/\bfetch\s*\(/.test(codeOnly)).toBe(false);
		expect(codeOnly.includes("node:fs")).toBe(false);
		expect(/(^|[^.\w])fs\./.test(codeOnly)).toBe(false);
	});

	it("never calls Date.now, Math.random, or crypto.random*", () => {
		expect(codeOnly.includes("Date.now")).toBe(false);
		expect(codeOnly.includes("Math.random")).toBe(false);
		expect(/crypto\.random/i.test(codeOnly)).toBe(false);
	});

	it("never references cover_image_status / coverImageStatus, nor any read/write call", () => {
		expect(codeOnly.includes("cover_image_status")).toBe(false);
		expect(codeOnly.includes("coverImageStatus")).toBe(false);
		expect(codeOnly.includes(".from(")).toBe(false);
		expect(codeOnly.includes("process.env")).toBe(false);
	});
});
