import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
	ArticleVisualProvider,
	ArticleVisualGenerationOptions,
	GenerateArticleVisualResult,
	GeneratedArticleVisual,
} from "../ArticleVisualProvider";
import { buildArticleVisualBrief, type ArticleVisualBrief } from "../articleVisualBrief";

/**
 * Phase 3C.4B.2 — coverage for the provider-neutral Article Visual
 * Provider contract. This module contains no concrete implementation
 * (see its own doc comment) — everything here that "implements"
 * `ArticleVisualProvider` is a test-only fake, per the phase instruction
 * to keep any fake provider in the test file rather than production
 * unless there is a clear runtime use. No real network call, image
 * generation, or provider is exercised anywhere in this file.
 *
 * Structural (source-inspection) tests follow the same corrected
 * pattern already established in this codebase: resolve from
 * `process.cwd()` (never `import.meta.url`, which throws on Windows),
 * and strip comments before substring/regex checks so this file's own
 * doc comments — which legitimately *name* forbidden concepts (Supabase,
 * fetch, coverImageStatus, etc.) to document their absence — never
 * produce a false positive, the same class of bug already fixed once in
 * `market-opportunity/__tests__/MarketOpportunityInspector.structure.test.ts`.
 */

function validBrief(): ArticleVisualBrief {
	const result = buildArticleVisualBrief({
		title: "How We Cut Build Times in Half",
		excerpt: "A practical walkthrough of the caching and pipeline changes that halved our CI build times.",
		category: { key: "build", name: "Build" },
		locale: "en",
	});
	if (!result.ok) throw new Error("expected a valid brief for this fixture");
	return result.brief;
}

const CANONICAL_OPTIONS: ArticleVisualGenerationOptions = { width: 1600, height: 900 };

/** Fake #1 — always "succeeds" with an in-memory byte payload. Proves
 * the interface is implementable with the `"bytes"` data shape. */
function makeBytesFakeProvider(): ArticleVisualProvider {
	return {
		id: "fake-bytes-provider",
		isConfigured: () => true,
		async generate(brief, options): Promise<GenerateArticleVisualResult> {
			void brief;
			return {
				ok: true,
				visual: {
					data: { kind: "bytes", data: new Uint8Array([1, 2, 3, 4]) },
					mimeType: "image/png",
					width: options.width,
					height: options.height,
				},
			};
		},
	};
}

/** Fake #2 — a structurally different implementation returning a
 * `"temporary_url"` data shape and a different real MIME type, and
 * capable of every failure kind. Proves the SAME interface can be
 * implemented by two providers with materially different internals. */
function makeTemporaryUrlFakeProvider(opts: { configured?: boolean; failWith?: GenerateArticleVisualResult } = {}): ArticleVisualProvider {
	return {
		id: "fake-temporary-url-provider",
		isConfigured: () => opts.configured ?? true,
		async generate(brief, options): Promise<GenerateArticleVisualResult> {
			void brief;
			if (opts.failWith) return opts.failWith;
			return {
				ok: true,
				visual: {
					data: { kind: "temporary_url", url: "https://provider.example.com/tmp/generated-image-abc123" },
					mimeType: "image/webp",
					width: options.width,
					height: options.height,
				},
			};
		},
	};
}

describe("ArticleVisualProvider — consumes ArticleVisualBrief, nothing else", () => {
	it("generate() accepts a real ArticleVisualBrief and a numeric-dimensions options object", async () => {
		const provider = makeBytesFakeProvider();
		const brief = validBrief();

		const result = await provider.generate(brief, CANONICAL_OPTIONS);

		expect(result.ok).toBe(true);
	});

	it("the returned visual's width/height are numeric, not a provider-specific size string", async () => {
		const provider = makeBytesFakeProvider();
		const result = await provider.generate(validBrief(), CANONICAL_OPTIONS);
		if (!result.ok) throw new Error("expected ok:true");
		expect(typeof result.visual.width).toBe("number");
		expect(typeof result.visual.height).toBe("number");
		expect(result.visual.width).toBe(1600);
		expect(result.visual.height).toBe(900);
	});
});

describe("ArticleVisualProvider — result representation is provider-neutral", () => {
	it("preserves the actual returned MIME type (PNG) rather than assuming WebP", async () => {
		const provider = makeBytesFakeProvider();
		const result = await provider.generate(validBrief(), CANONICAL_OPTIONS);
		if (!result.ok) throw new Error("expected ok:true");
		expect(result.visual.mimeType).toBe("image/png");
	});

	it("preserves a different real MIME type (WebP) from a different provider without conversion", async () => {
		const provider = makeTemporaryUrlFakeProvider();
		const result = await provider.generate(validBrief(), CANONICAL_OPTIONS);
		if (!result.ok) throw new Error("expected ok:true");
		expect(result.visual.mimeType).toBe("image/webp");
	});

	it("supports the 'bytes' data representation", async () => {
		const result = await makeBytesFakeProvider().generate(validBrief(), CANONICAL_OPTIONS);
		if (!result.ok) throw new Error("expected ok:true");
		expect(result.visual.data.kind).toBe("bytes");
		if (result.visual.data.kind === "bytes") {
			expect(result.visual.data.data).toBeInstanceOf(Uint8Array);
		}
	});

	it("supports the 'temporary_url' data representation", async () => {
		const result = await makeTemporaryUrlFakeProvider().generate(validBrief(), CANONICAL_OPTIONS);
		if (!result.ok) throw new Error("expected ok:true");
		expect(result.visual.data.kind).toBe("temporary_url");
		if (result.visual.data.kind === "temporary_url") {
			expect(typeof result.visual.data.url).toBe("string");
			expect(result.visual.data.url.length).toBeGreaterThan(0);
		}
	});

	it("a temporary_url result is never mistaken for a permanent coverImageUrl -- the field is named distinctly and carries no such field", async () => {
		const result: GenerateArticleVisualResult = await makeTemporaryUrlFakeProvider().generate(validBrief(), CANONICAL_OPTIONS);
		if (!result.ok) throw new Error("expected ok:true");
		const visual: GeneratedArticleVisual = result.visual;
		expect(Object.prototype.hasOwnProperty.call(visual, "coverImageUrl")).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(visual, "url")).toBe(false);
	});
});

describe("ArticleVisualProvider — generated result cannot carry article/approval state", () => {
	it("GeneratedArticleVisual has only the approved fields (data, mimeType, width, height)", async () => {
		const result = await makeBytesFakeProvider().generate(validBrief(), CANONICAL_OPTIONS);
		if (!result.ok) throw new Error("expected ok:true");
		expect(Object.keys(result.visual).sort()).toEqual(["data", "height", "mimeType", "width"].sort());
	});

	it("a successful generate() result carries no approval/status field of any kind", async () => {
		const result = await makeBytesFakeProvider().generate(validBrief(), CANONICAL_OPTIONS);
		const forbidden = ["coverImageStatus", "cover_image_status", "approved", "pending_review", "published", "status"];
		for (const field of forbidden) {
			expect(Object.prototype.hasOwnProperty.call(result, field)).toBe(false);
			if (result.ok) expect(Object.prototype.hasOwnProperty.call(result.visual, field)).toBe(false);
		}
	});
});

describe("ArticleVisualProvider — isConfigured / provider id", () => {
	it("isConfigured() reflects the adapter's own configuration state", () => {
		const configured = makeTemporaryUrlFakeProvider({ configured: true });
		const notConfigured = makeTemporaryUrlFakeProvider({ configured: false });
		expect(configured.isConfigured()).toBe(true);
		expect(notConfigured.isConfigured()).toBe(false);
	});

	it("provider id is a stable, deterministic string across calls", () => {
		const provider = makeBytesFakeProvider();
		expect(provider.id).toBe("fake-bytes-provider");
		expect(provider.id).toBe(provider.id);
	});
});

describe("ArticleVisualProvider — deterministic typed failures", () => {
	it("supports a not_configured failure", async () => {
		const provider = makeTemporaryUrlFakeProvider({
			failWith: { ok: false, kind: "not_configured", message: "No API key configured." },
		});
		const result = await provider.generate(validBrief(), CANONICAL_OPTIONS);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.kind).toBe("not_configured");
	});

	it("supports a provider_error failure", async () => {
		const provider = makeTemporaryUrlFakeProvider({
			failWith: { ok: false, kind: "provider_error", message: "The provider returned a server error." },
		});
		const result = await provider.generate(validBrief(), CANONICAL_OPTIONS);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.kind).toBe("provider_error");
	});

	it("supports an invalid_response failure", async () => {
		const provider = makeTemporaryUrlFakeProvider({
			failWith: { ok: false, kind: "invalid_response", message: "The provider response had no image data." },
		});
		const result = await provider.generate(validBrief(), CANONICAL_OPTIONS);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.kind).toBe("invalid_response");
	});

	it("supports a budget_exceeded failure", async () => {
		const provider = makeTemporaryUrlFakeProvider({
			failWith: { ok: false, kind: "budget_exceeded", message: "Monthly image generation budget reached." },
		});
		const result = await provider.generate(validBrief(), CANONICAL_OPTIONS);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.kind).toBe("budget_exceeded");
	});

	it("every failure carries a non-empty message and no raw provider payload/secret", async () => {
		const provider = makeTemporaryUrlFakeProvider({
			failWith: { ok: false, kind: "provider_error", message: "The provider returned a server error." },
		});
		const result = await provider.generate(validBrief(), CANONICAL_OPTIONS);
		if (result.ok) throw new Error("expected ok:false");
		expect(result.message.length).toBeGreaterThan(0);
		expect(result.message).not.toMatch(/sk-|api[_-]?key|authorization/i);
	});
});

describe("ArticleVisualProvider — interface is implementable by two structurally different fakes", () => {
	it("both fakes satisfy the same ArticleVisualProvider type and both can be awaited identically", async () => {
		const providers: ArticleVisualProvider[] = [makeBytesFakeProvider(), makeTemporaryUrlFakeProvider()];
		for (const provider of providers) {
			expect(typeof provider.id).toBe("string");
			expect(typeof provider.isConfigured).toBe("function");
			const result = await provider.generate(validBrief(), CANONICAL_OPTIONS);
			expect(typeof result.ok).toBe("boolean");
		}
	});
});

describe("ArticleVisualProvider — no side effects merely from constructing/importing", () => {
	it("constructing a fake provider does not itself call generate()", () => {
		let called = false;
		const provider: ArticleVisualProvider = {
			id: "spy-provider",
			isConfigured: () => true,
			generate: async (brief, options) => {
				called = true;
				void brief;
				void options;
				return { ok: true, visual: { data: { kind: "bytes", data: new Uint8Array() }, mimeType: "image/png", width: 1, height: 1 } };
			},
		};
		void provider;
		expect(called).toBe(false);
	});
});

describe("ArticleVisualProvider — structural purity (source-inspection)", () => {
	const SOURCE_PATH = resolve(process.cwd(), "src/features/content-intelligence/visuals/ArticleVisualProvider.ts");
	const source = readFileSync(SOURCE_PATH, "utf8");
	const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
	const importLines = source.split("\n").filter((line) => line.trimStart().startsWith("import"));

	it("imports only from ./articleVisualBrief -- no Article/ContentBrief/MarketOpportunityEvidence/Supabase/CMS/recommendation dependency", () => {
		const suspicious = importLines.filter((line) => !line.includes("./articleVisualBrief"));
		expect(suspicious).toEqual([]);
	});

	it("never imports Article, ContentBrief, or MarketOpportunityEvidence types", () => {
		expect(codeOnly).not.toMatch(/\bArticle\b(?!VisualBrief|VisualProvider|VisualGenerationOptions)/);
		expect(codeOnly.includes("ContentBrief")).toBe(false);
		expect(codeOnly.includes("MarketOpportunityEvidence")).toBe(false);
	});

	it("never imports Supabase or any storage/CMS module", () => {
		expect(codeOnly.includes("supabase")).toBe(false);
		expect(codeOnly.includes("Supabase")).toBe(false);
		expect(codeOnly.includes("cms/service")).toBe(false);
		expect(codeOnly.includes("Storage")).toBe(false);
	});

	it("contains no fetch call, no env read, and no concrete provider implementation", () => {
		expect(/\bfetch\s*\(/.test(codeOnly)).toBe(false);
		expect(codeOnly.includes("process.env")).toBe(false);
		// No function/class body actually constructs a provider object in
		// this file -- only type/interface declarations exist.
		expect(codeOnly.includes("createOpenAi")).toBe(false);
		expect(codeOnly.includes("openai")).toBe(false);
		expect(codeOnly.toLowerCase().includes("openai")).toBe(false);
	});

	it("never references cover_image_status / coverImageStatus / approval states", () => {
		expect(codeOnly.includes("cover_image_status")).toBe(false);
		expect(codeOnly.includes("coverImageStatus")).toBe(false);
		expect(/\bapproved\b/.test(codeOnly)).toBe(false);
		expect(/\bpending_review\b/.test(codeOnly)).toBe(false);
		expect(/\bpublished\b/.test(codeOnly)).toBe(false);
	});

	it("never contains provider-specific size-enum strings (e.g. '1792x1024')", () => {
		expect(/\d{3,4}x\d{3,4}/.test(codeOnly)).toBe(false);
	});

	it("never contains token-count or billing-id fields", () => {
		expect(codeOnly.includes("inputTokens")).toBe(false);
		expect(codeOnly.includes("outputTokens")).toBe(false);
		expect(codeOnly.includes("billingId")).toBe(false);
		expect(codeOnly.includes("estimated_cost")).toBe(false);
	});

	it("never contains a database write call", () => {
		expect(codeOnly.includes(".from(")).toBe(false);
		expect(codeOnly.includes(".insert(")).toBe(false);
		expect(codeOnly.includes(".update(")).toBe(false);
	});
});
