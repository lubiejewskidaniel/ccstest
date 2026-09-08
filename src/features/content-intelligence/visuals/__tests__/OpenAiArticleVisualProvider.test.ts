import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticleVisualBrief } from "../articleVisualBrief";

/**
 * Phase 3C.4B.5A — coverage for the first real `ArticleVisualProvider`
 * adapter. All network calls are mocked via `vi.stubGlobal("fetch", ...)`
 * (the same convention already used by `articleVisualStorageService.test.ts`
 * for its `temporary_url` fetch path) — no real, billable image
 * generation ever happens in this file.
 */

const { createOpenAiArticleVisualProvider } = await import("../OpenAiArticleVisualProvider");

const BASE_BRIEF: ArticleVisualBrief = {
	subject: "How We Cut Build Times in Half",
	categoryKey: "build",
	locale: "en",
	requiredElements: [],
	avoidElements: ["fabricated UI screenshots", "real logos or trademarks"],
	altText: 'Cover illustration for the article "How We Cut Build Times in Half"',
};

const OPTIONS = { width: 1600, height: 900 };

function pngBase64(byteLength = 16): string {
	return Buffer.from(new Uint8Array(byteLength).fill(1)).toString("base64");
}

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("createOpenAiArticleVisualProvider", () => {
	const originalApiKey = process.env.OPENAI_API_KEY;

	beforeEach(() => {
		process.env.OPENAI_API_KEY = "sk-test-key";
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
		else process.env.OPENAI_API_KEY = originalApiKey;
	});

	// 1. implements ArticleVisualProvider (shape check)
	it("1. returns an object implementing the ArticleVisualProvider shape", () => {
		const provider = createOpenAiArticleVisualProvider();
		expect(typeof provider.id).toBe("string");
		expect(typeof provider.isConfigured).toBe("function");
		expect(typeof provider.generate).toBe("function");
	});

	// 2. stable provider id
	it("2. exposes a stable provider id of 'openai'", () => {
		expect(createOpenAiArticleVisualProvider().id).toBe("openai");
		expect(createOpenAiArticleVisualProvider().id).toBe("openai");
	});

	// 3. isConfigured false without API key
	it("3. isConfigured() is false when OPENAI_API_KEY is not set", () => {
		delete process.env.OPENAI_API_KEY;
		expect(createOpenAiArticleVisualProvider().isConfigured()).toBe(false);
	});

	// 4. isConfigured true with API key
	it("4. isConfigured() is true when OPENAI_API_KEY is set", () => {
		expect(createOpenAiArticleVisualProvider().isConfigured()).toBe(true);
	});

	// 5. successful image response maps to GeneratedArticleVisual
	it("5. maps a successful response into a GeneratedArticleVisual", async () => {
		vi.stubGlobal("fetch", vi.fn(async (_url: string, _init: RequestInit) => jsonResponse({ data: [{ b64_json: pngBase64() }], size: "1600x896", output_format: "png" })));
		const result = await createOpenAiArticleVisualProvider().generate(BASE_BRIEF, OPTIONS);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.visual.data.kind).toBe("bytes");
			expect(result.visual.mimeType).toBe("image/png");
		}
	});

	// 6. actual MIME preserved (jpeg, not assumed png)
	it("6. preserves the actual output_format the provider reports, rather than assuming PNG", async () => {
		vi.stubGlobal("fetch", vi.fn(async (_url: string, _init: RequestInit) => jsonResponse({ data: [{ b64_json: pngBase64() }], size: "1600x896", output_format: "jpeg" })));
		const result = await createOpenAiArticleVisualProvider().generate(BASE_BRIEF, OPTIONS);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.visual.mimeType).toBe("image/jpeg");
	});

	// 7. width/height returned correctly (from response "size")
	it("7. returns width/height parsed from the provider's reported size", async () => {
		vi.stubGlobal("fetch", vi.fn(async (_url: string, _init: RequestInit) => jsonResponse({ data: [{ b64_json: pngBase64() }], size: "1600x896", output_format: "png" })));
		const result = await createOpenAiArticleVisualProvider().generate(BASE_BRIEF, OPTIONS);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.visual.width).toBe(1600);
			expect(result.visual.height).toBe(896);
		}
	});

	// 7b. falls back to the requested (rounded) size if the response omits "size"
	it("7b. falls back to the requested, rounded size when the response has no size field", async () => {
		vi.stubGlobal("fetch", vi.fn(async (_url: string, _init: RequestInit) => jsonResponse({ data: [{ b64_json: pngBase64() }], output_format: "png" })));
		const result = await createOpenAiArticleVisualProvider().generate(BASE_BRIEF, OPTIONS);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.visual.width).toBe(1600);
			expect(result.visual.height).toBe(896); // 900 rounded down to a multiple of 16
		}
	});

	// 8. ArticleVisualBrief drives the provider instruction
	it("8. includes the brief's subject in the generated prompt", async () => {
		const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => jsonResponse({ data: [{ b64_json: pngBase64() }], size: "1600x896", output_format: "png" }));
		vi.stubGlobal("fetch", fetchMock);
		await createOpenAiArticleVisualProvider().generate(BASE_BRIEF, OPTIONS);
		const requestBody = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
		expect(requestBody.prompt).toContain(BASE_BRIEF.subject);
	});

	// 9-12. each category demonstrably influences the instruction
	const categories = ["build", "grow", "learn", "studio"] as const;
	const categoryKeywords: Record<(typeof categories)[number], string> = {
		build: "software engineering",
		grow: "business momentum",
		learn: "knowledge",
		studio: "creative technology",
	};
	for (const category of categories) {
		it(`9-12. category "${category}" demonstrably influences the prompt`, async () => {
			const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => jsonResponse({ data: [{ b64_json: pngBase64() }], size: "1600x896", output_format: "png" }));
			vi.stubGlobal("fetch", fetchMock);
			await createOpenAiArticleVisualProvider().generate({ ...BASE_BRIEF, categoryKey: category }, OPTIONS);
			const requestBody = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
			expect(requestBody.prompt).toContain(categoryKeywords[category]);
		});
	}

	// 13. avoidElements included
	it("13. includes the brief's avoidElements in the prompt", async () => {
		const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => jsonResponse({ data: [{ b64_json: pngBase64() }], size: "1600x896", output_format: "png" }));
		vi.stubGlobal("fetch", fetchMock);
		await createOpenAiArticleVisualProvider().generate(BASE_BRIEF, OPTIONS);
		const requestBody = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
		expect(requestBody.prompt).toContain("fabricated UI screenshots");
		expect(requestBody.prompt).toContain("real logos or trademarks");
	});

	// 14. no article/body dependency (structural: no import of the raw Article
	// type, article body field, ContentBrief, or MarketOpportunityEvidence --
	// deliberately not a bare /\bArticle\b/ scan, since "Article" also
	// appears legitimately inside the generated prompt's English text)
	it("14. never imports or references a raw Article, ContentBrief, or MarketOpportunityEvidence type", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const source = readFileSync(resolve(process.cwd(), "src/features/content-intelligence/visuals/OpenAiArticleVisualProvider.ts"), "utf8");
		const stripped = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
		expect(stripped).not.toMatch(/\bArticle\b,|\bArticle\b\s*}/); // no `Article` (the raw type) imported -- `CategoryKey` from the same module is fine, and is the only import taken from it
		expect(stripped).not.toMatch(/\bbrief\.body\b/);
		expect(stripped).not.toMatch(/ContentBrief/);
		expect(stripped).not.toMatch(/MarketOpportunityEvidence/);
	});

	// 15. no Supabase dependency
	it("15. never imports Supabase", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const source = readFileSync(resolve(process.cwd(), "src/features/content-intelligence/visuals/OpenAiArticleVisualProvider.ts"), "utf8");
		const stripped = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
		expect(stripped).not.toMatch(/supabase/i);
	});

	// 16. no Storage dependency
	it("16. never references Storage upload/bucket behaviour", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const source = readFileSync(resolve(process.cwd(), "src/features/content-intelligence/visuals/OpenAiArticleVisualProvider.ts"), "utf8");
		const stripped = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
		expect(stripped).not.toMatch(/\.storage\.from/);
		expect(stripped).not.toMatch(/ARTICLE_VISUALS_BUCKET/);
	});

	// 17. no approval call
	it("17. never references approval/review functions", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const source = readFileSync(resolve(process.cwd(), "src/features/content-intelligence/visuals/OpenAiArticleVisualProvider.ts"), "utf8");
		const stripped = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
		expect(stripped).not.toMatch(/approveArticleVisual/);
		expect(stripped).not.toMatch(/reviewed_(at|by)/);
	});

	// 18. no article mutation
	it("18. never references insights_articles or cover_image_* columns", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const source = readFileSync(resolve(process.cwd(), "src/features/content-intelligence/visuals/OpenAiArticleVisualProvider.ts"), "utf8");
		const stripped = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
		expect(stripped).not.toMatch(/insights_articles/);
		expect(stripped).not.toMatch(/cover_image_/);
	});

	// 19. no client-side import ("use client" absent, no browser API)
	it("19. is not marked as a client component and uses no browser-only APIs", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const source = readFileSync(resolve(process.cwd(), "src/features/content-intelligence/visuals/OpenAiArticleVisualProvider.ts"), "utf8");
		expect(source).not.toMatch(/"use client"/);
		expect(source).not.toMatch(/\bwindow\./);
		expect(source).not.toMatch(/\bdocument\./);
	});

	// 20. API/network error -> provider_error
	it("20. maps a network failure to a provider_error result", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url: string, _init: RequestInit) => {
				throw new Error("network down");
			}),
		);
		const result = await createOpenAiArticleVisualProvider().generate(BASE_BRIEF, OPTIONS);
		expect(result).toEqual({ ok: false, kind: "provider_error", message: expect.any(String) });
	});

	// 20b. non-2xx HTTP status -> provider_error
	it("20b. maps a non-2xx HTTP response to a provider_error result", async () => {
		vi.stubGlobal("fetch", vi.fn(async (_url: string, _init: RequestInit) => jsonResponse({ error: { message: "invalid api key" } }, 401)));
		const result = await createOpenAiArticleVisualProvider().generate(BASE_BRIEF, OPTIONS);
		expect(result).toMatchObject({ ok: false, kind: "provider_error" });
	});

	// 21. malformed successful response -> invalid_response
	it("21. maps an unreadable (non-JSON) successful response to invalid_response", async () => {
		vi.stubGlobal("fetch", vi.fn(async (_url: string, _init: RequestInit) => new Response("not json", { status: 200 })));
		const result = await createOpenAiArticleVisualProvider().generate(BASE_BRIEF, OPTIONS);
		expect(result).toMatchObject({ ok: false, kind: "invalid_response" });
	});

	// 22. missing image data -> invalid_response
	it("22. maps a response with no image data to invalid_response", async () => {
		vi.stubGlobal("fetch", vi.fn(async (_url: string, _init: RequestInit) => jsonResponse({ data: [] })));
		const result = await createOpenAiArticleVisualProvider().generate(BASE_BRIEF, OPTIONS);
		expect(result).toMatchObject({ ok: false, kind: "invalid_response" });
	});

	// 22b. unrecognised output_format -> invalid_response
	it("22b. maps an unrecognised output_format to invalid_response", async () => {
		vi.stubGlobal("fetch", vi.fn(async (_url: string, _init: RequestInit) => jsonResponse({ data: [{ b64_json: pngBase64() }], output_format: "gif" })));
		const result = await createOpenAiArticleVisualProvider().generate(BASE_BRIEF, OPTIONS);
		expect(result).toMatchObject({ ok: false, kind: "invalid_response" });
	});

	// 23. secret never appears in result/error
	it("23. never includes the API key in a returned error message", async () => {
		vi.stubGlobal("fetch", vi.fn(async (_url: string, _init: RequestInit) => jsonResponse({ error: { message: "bad request" } }, 400)));
		const result = await createOpenAiArticleVisualProvider().generate(BASE_BRIEF, OPTIONS);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.message).not.toContain("sk-test-key");
	});

	// 24. no automatic retry loop (exactly one fetch call, even on failure)
	it("24. calls fetch exactly once per generate() call, even on failure", async () => {
		const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => jsonResponse({}, 500));
		vi.stubGlobal("fetch", fetchMock);
		await createOpenAiArticleVisualProvider().generate(BASE_BRIEF, OPTIONS);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	// 25. same brief/options produce a deterministic request payload
	it("25. produces an identical request body for the same brief and options across calls", async () => {
		const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => jsonResponse({ data: [{ b64_json: pngBase64() }], size: "1600x896", output_format: "png" }));
		vi.stubGlobal("fetch", fetchMock);
		const provider = createOpenAiArticleVisualProvider();
		await provider.generate(BASE_BRIEF, OPTIONS);
		await provider.generate(BASE_BRIEF, OPTIONS);
		expect((fetchMock.mock.calls[0]![1] as RequestInit).body).toBe((fetchMock.mock.calls[1]![1] as RequestInit).body);
	});

	// 26. provider-specific size string never leaks into core types (structural)
	it("26. ArticleVisualGenerationOptions stays plain width/height (no provider size string leak)", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const source = readFileSync(resolve(process.cwd(), "src/features/content-intelligence/visuals/ArticleVisualProvider.ts"), "utf8");
		expect(source).not.toMatch(/1536x1024|1024x1536|gpt-image/);
	});

	// 27. no provider-specific field added to ArticleVisualBrief (structural)
	it("27. articleVisualBrief.ts has no OpenAI/provider-specific field added", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const source = readFileSync(resolve(process.cwd(), "src/features/content-intelligence/visuals/articleVisualBrief.ts"), "utf8");
		expect(source).not.toMatch(/openai|gpt-image|prompt:|provider:/i);
	});

	// 28. no image stored merely by generation (no store call happens)
	it("28. never calls a store*ArticleVisual function", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const source = readFileSync(resolve(process.cwd(), "src/features/content-intelligence/visuals/OpenAiArticleVisualProvider.ts"), "utf8");
		expect(source).not.toMatch(/store(Generated|Uploaded)ArticleVisual/);
	});

	// 29. no reviewed/approved status reference (covered again at the result level)
	it("29. a successful generate() result carries no status/approval field", async () => {
		vi.stubGlobal("fetch", vi.fn(async (_url: string, _init: RequestInit) => jsonResponse({ data: [{ b64_json: pngBase64() }], size: "1600x896", output_format: "png" })));
		const result = await createOpenAiArticleVisualProvider().generate(BASE_BRIEF, OPTIONS);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.visual).not.toHaveProperty("status");
			expect(result.visual).not.toHaveProperty("approved");
		}
	});

	// 30. server-only boundary: uses process.env / fetch, no browser APIs (see also #19)
	it("30. reads its API key from process.env, not from any client-supplied input", () => {
		const provider = createOpenAiArticleVisualProvider();
		expect(provider.generate.length).toBe(2); // (brief, options) only -- no apiKey/env parameter accepted from a caller
	});

	// Bonus: empty payload after base64 decode -> invalid_response
	it("31. maps an empty (zero-byte) decoded image to invalid_response", async () => {
		vi.stubGlobal("fetch", vi.fn(async (_url: string, _init: RequestInit) => jsonResponse({ data: [{ b64_json: "" }], output_format: "png" })));
		const result = await createOpenAiArticleVisualProvider().generate(BASE_BRIEF, OPTIONS);
		expect(result).toMatchObject({ ok: false, kind: "invalid_response" });
	});

	// Bonus: request size respects the 16px-multiple / floor rule
	it("32. rounds the requested size down to the nearest multiple of 16 in the request body", async () => {
		const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => jsonResponse({ data: [{ b64_json: pngBase64() }], size: "1600x896", output_format: "png" }));
		vi.stubGlobal("fetch", fetchMock);
		await createOpenAiArticleVisualProvider().generate(BASE_BRIEF, { width: 1600, height: 900 });
		const requestBody = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
		expect(requestBody.size).toBe("1600x896");
	});
});
