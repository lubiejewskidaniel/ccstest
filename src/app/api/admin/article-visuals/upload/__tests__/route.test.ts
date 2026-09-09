import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/**
 * Phase 3C.4B.6C — transport-security correction coverage for the
 * manual article visual upload Route Handler.
 *
 * Same mocking shape as `articleVisualStorageService.test.ts`
 * (`@/lib/supabase/adminAuth` + `@/lib/supabase/server` mocked), plus
 * `articleVisualStorageService` itself and `next/cache` mocked so this
 * file can genuinely invoke `POST` and observe real call order and
 * responses -- not just structural source-text assertions. Real
 * behavioural coverage is used here (rather than this repo's usual
 * structural-only technique) specifically because the defect being
 * fixed is about CALL ORDER (auth before `request.formData()`, the
 * size guard before `file.arrayBuffer()`), which only an actual
 * invocation can prove.
 *
 * `storeUploadedArticleVisual` is mocked as an opaque function here --
 * its own auth/validation/storage behaviour is covered exhaustively by
 * `articleVisualStorageService.test.ts` and is never re-tested in this
 * file. This file proves only the transport layer sitting in front of
 * it.
 */

const mockGetAdminSession = vi.fn();
vi.mock("@/lib/supabase/adminAuth", () => ({
	getAdminSession: () => mockGetAdminSession(),
}));

const mockCreateSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: () => mockCreateSupabaseServerClient(),
}));

const mockStoreUploadedArticleVisual = vi.fn();
vi.mock("@/features/content-intelligence/visuals/articleVisualStorageService", () => ({
	storeUploadedArticleVisual: (...args: unknown[]) => mockStoreUploadedArticleVisual(...args),
}));

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
	revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { POST } = await import("../route");
const { MAX_ARTICLE_VISUAL_ASSET_BYTES } = await import("@/features/content-intelligence/visuals/articleVisualStorage");

const EDITOR_SESSION = { userId: "u1", email: "editor@example.com", roles: ["editor"], isAdmin: false, isEditor: true };
const NON_EDITOR_SESSION = { userId: "u2", email: "viewer@example.com", roles: [], isAdmin: false, isEditor: false };
const ARTICLE_ID = "11111111-1111-4111-8111-111111111111";

// A minimal fake Supabase client -- this route's auth preflight never
// calls anything on it beyond what createSupabaseServerClient()/
// getAdminSession() themselves need, both of which are mocked directly
// above, so an empty object is sufficient and deliberately does not
// pretend to be a real Supabase client.
const FAKE_SUPABASE_CLIENT = {};

/**
 * A request stand-in whose `formData()` is a spy that THROWS if it is
 * ever called -- used by every auth-preflight-failure test below to
 * prove, behaviourally, that the route returns before parsing the
 * multipart body at all (not just that the source text places the
 * check first).
 */
function requestThatMustNotParseFormData(): NextRequest {
	return {
		formData: vi.fn(async () => {
			throw new Error("request.formData() must not be called when the auth preflight rejects the request");
		}),
	} as unknown as NextRequest;
}

/**
 * A real `File` instance (so `file instanceof File` in the route still
 * passes) whose `.size` is overridden via `defineProperty` -- avoiding
 * allocating real megabyte-scale buffers in memory just to exercise
 * the size guard -- and whose `.arrayBuffer()` is a spy returning
 * test-owned bytes, so tests can assert whether it was called without
 * doing a real multipart round-trip (which would construct a
 * brand-new File the route never sees, making the original spy
 * unobservable).
 *
 * Deliberately never calls or binds the environment-provided
 * `File.prototype.arrayBuffer()`: some Vitest/jsdom environments (as
 * surfaced by a real Windows Vitest run) don't implement it at all, and
 * even where a real implementation exists, calling through to it here
 * would defeat the point of a deterministic, test-owned spy -- it must
 * return exactly the bytes this test controls, not whatever the
 * platform's underlying Blob backing store happens to produce. The
 * small `content` fixture (4 bytes by default) is kept independent of
 * `size` on purpose -- boundary tests that need a large `.size` (e.g.
 * exactly MAX_ARTICLE_VISUAL_ASSET_BYTES) still never allocate a real
 * multi-megabyte buffer just to exercise the size guard.
 */
function makeSpyFile(options: { size: number; arrayBufferShouldBeCalled: boolean; content?: Uint8Array }): File {
	const content = options.content ?? new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
	const file = new File([content as unknown as BlobPart], "photo.png", { type: "image/png" });
	Object.defineProperty(file, "size", { value: options.size, configurable: true });
	Object.defineProperty(file, "arrayBuffer", {
		configurable: true,
		value: vi.fn(async () => {
			if (!options.arrayBufferShouldBeCalled) {
				throw new Error("file.arrayBuffer() must not be called before the size guard rejects an oversized file");
			}
			// A fresh ArrayBuffer built from this test's own bytes each
			// call, matching the real Web API's contract that
			// arrayBuffer() returns a new buffer -- never the
			// environment's real File.arrayBuffer() implementation.
			return content.slice().buffer;
		}),
	});
	return file;
}

/** A fake FormData-like object -- deliberately hand-built (not a real
 * `FormData`) so the exact `File` instance constructed by
 * `makeSpyFile` above is the one the route actually receives via
 * `.get("file")`, with no multipart serialize/parse round-trip that
 * would otherwise hand the route an unrelated, freshly-parsed File the
 * spy could never observe. */
function requestWithFormData(fields: { articleId?: string; file?: File; altText?: string }): NextRequest {
	const map = new Map<string, unknown>();
	if (fields.articleId !== undefined) map.set("articleId", fields.articleId);
	if (fields.file !== undefined) map.set("file", fields.file);
	if (fields.altText !== undefined) map.set("altText", fields.altText);
	return {
		formData: vi.fn(async () => ({
			get: (key: string) => map.get(key) ?? null,
		})),
	} as unknown as NextRequest;
}

beforeEach(() => {
	mockGetAdminSession.mockReset();
	mockCreateSupabaseServerClient.mockReset();
	mockStoreUploadedArticleVisual.mockReset();
	mockRevalidatePath.mockReset();
});

afterEach(() => {
	vi.clearAllMocks();
});

describe("Auth preflight runs before request.formData() (Phase 3C.4B.6C, item 1)", () => {
	it("Supabase not configured -> 503, and request.formData() is never called", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(null);

		const response = await POST(requestThatMustNotParseFormData());
		const body = await response.json();

		expect(response.status).toBe(503);
		expect(body).toEqual({ ok: false, kind: "not_configured", message: expect.any(String) });
		expect(mockGetAdminSession).not.toHaveBeenCalled();
		expect(mockStoreUploadedArticleVisual).not.toHaveBeenCalled();
	});

	it("unauthenticated (no session) -> 401, and request.formData() is never called", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(FAKE_SUPABASE_CLIENT);
		mockGetAdminSession.mockResolvedValue(null);

		const response = await POST(requestThatMustNotParseFormData());
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body).toEqual({ ok: false, kind: "auth", message: expect.any(String) });
		expect(mockStoreUploadedArticleVisual).not.toHaveBeenCalled();
	});

	it("non-editor session -> 401, and request.formData() is never called", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(FAKE_SUPABASE_CLIENT);
		mockGetAdminSession.mockResolvedValue(NON_EDITOR_SESSION);

		const response = await POST(requestThatMustNotParseFormData());
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body.ok).toBe(false);
		expect(body.kind).toBe("auth");
		expect(mockStoreUploadedArticleVisual).not.toHaveBeenCalled();
	});

	it("does not leak the raw Supabase/session objects in the response body", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(FAKE_SUPABASE_CLIENT);
		mockGetAdminSession.mockResolvedValue(null);

		const response = await POST(requestThatMustNotParseFormData());
		const body = await response.json();
		const serialized = JSON.stringify(body);

		expect(serialized).not.toMatch(/supabase|postgres|database|stack/i);
	});
});

describe("Pre-buffer size guard runs before file.arrayBuffer() (Phase 3C.4B.6C, item 2)", () => {
	beforeEach(() => {
		mockCreateSupabaseServerClient.mockResolvedValue(FAKE_SUPABASE_CLIENT);
		mockGetAdminSession.mockResolvedValue(EDITOR_SESSION);
	});

	it("a file larger than MAX_ARTICLE_VISUAL_ASSET_BYTES is rejected before arrayBuffer() is called", async () => {
		const oversizedFile = makeSpyFile({ size: MAX_ARTICLE_VISUAL_ASSET_BYTES + 1, arrayBufferShouldBeCalled: false });
		const request = requestWithFormData({ articleId: ARTICLE_ID, file: oversizedFile });

		const response = await POST(request);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body).toEqual({ ok: false, kind: "invalid_asset", message: expect.any(String) });
		expect(oversizedFile.arrayBuffer).not.toHaveBeenCalled();
		expect(mockStoreUploadedArticleVisual).not.toHaveBeenCalled();
	});

	it("a file at exactly MAX_ARTICLE_VISUAL_ASSET_BYTES is allowed through to arrayBuffer() and the service", async () => {
		const exactFile = makeSpyFile({ size: MAX_ARTICLE_VISUAL_ASSET_BYTES, arrayBufferShouldBeCalled: true });
		mockStoreUploadedArticleVisual.mockResolvedValue({
			ok: true,
			candidate: { articleId: ARTICLE_ID, visualId: "v1", storagePath: "x", altText: null, sourceType: "uploaded", provider: null, width: 1, height: 1, mimeType: "image/png", createdAt: "now" },
		});
		const request = requestWithFormData({ articleId: ARTICLE_ID, file: exactFile });

		const response = await POST(request);

		expect(response.status).toBe(201);
		expect(exactFile.arrayBuffer).toHaveBeenCalledTimes(1);
		expect(mockStoreUploadedArticleVisual).toHaveBeenCalledTimes(1);
	});
});

describe("storeUploadedArticleVisual remains the authoritative service boundary, unchanged", () => {
	beforeEach(() => {
		mockCreateSupabaseServerClient.mockResolvedValue(FAKE_SUPABASE_CLIENT);
		mockGetAdminSession.mockResolvedValue(EDITOR_SESSION);
	});

	it("the route calls storeUploadedArticleVisual with exactly articleId/data/declaredMimeType/altText -- no auth-derived field forwarded to it", async () => {
		mockStoreUploadedArticleVisual.mockResolvedValue({
			ok: true,
			candidate: { articleId: ARTICLE_ID, visualId: "v1", storagePath: "x", altText: null, sourceType: "uploaded", provider: null, width: 1, height: 1, mimeType: "image/png", createdAt: "now" },
		});
		const file = makeSpyFile({ size: 4, arrayBufferShouldBeCalled: true });
		const request = requestWithFormData({ articleId: ARTICLE_ID, file, altText: "A cat" });

		await POST(request);

		expect(mockStoreUploadedArticleVisual).toHaveBeenCalledWith(
			expect.objectContaining({
				articleId: ARTICLE_ID,
				declaredMimeType: "image/png",
				altText: "A cat",
				data: expect.any(Uint8Array),
			}),
		);
		const callArgs = mockStoreUploadedArticleVisual.mock.calls[0]?.[0];
		expect(callArgs).not.toHaveProperty("session");
		expect(callArgs).not.toHaveProperty("isEditor");
		expect(callArgs).not.toHaveProperty("userId");
	});

	it("a storeUploadedArticleVisual auth failure (defense in depth) still surfaces as a safe 401, never a raw error", async () => {
		mockStoreUploadedArticleVisual.mockResolvedValue({ ok: false, kind: "auth", message: "You must be signed in as an editor to store an article visual." });
		const file = makeSpyFile({ size: 4, arrayBufferShouldBeCalled: true });
		const request = requestWithFormData({ articleId: ARTICLE_ID, file });

		const response = await POST(request);
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body.ok).toBe(false);
	});

	it("successful upload flow is unchanged: 201, revalidatePath called with the edit route, result returned as-is", async () => {
		const candidate = { articleId: ARTICLE_ID, visualId: "v1", storagePath: "x", altText: null, sourceType: "uploaded", provider: null, width: 1, height: 1, mimeType: "image/png", createdAt: "now" };
		mockStoreUploadedArticleVisual.mockResolvedValue({ ok: true, candidate });
		const file = makeSpyFile({ size: 4, arrayBufferShouldBeCalled: true });
		const request = requestWithFormData({ articleId: ARTICLE_ID, file });

		const response = await POST(request);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body).toEqual({ ok: true, candidate });
		expect(mockRevalidatePath).toHaveBeenCalledWith(`/admin/insights/${ARTICLE_ID}/edit`);
	});
});

describe("No service-role client and no route-level MIME sniffing (structural, source-text)", () => {
	const ROUTE_SOURCE_PATH = resolve(process.cwd(), "src/app/api/admin/article-visuals/upload/route.ts");
	const routeSource = readFileSync(ROUTE_SOURCE_PATH, "utf8");
	const routeCode = routeSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

	it("no service-role client is imported or referenced", () => {
		expect(routeCode).not.toMatch(/createSupabasePrivilegedClient|service[-_]?role/i);
	});

	it("no MIME/magic-byte sniffing was added to the route", () => {
		expect(routeCode).not.toMatch(/0x89|0x50|0x4e|0x47|detectSignature|magic/i);
	});

	it("the 8 MB literal is never duplicated -- the route imports MAX_ARTICLE_VISUAL_ASSET_BYTES rather than writing 8 * 1024 * 1024 itself", () => {
		expect(routeCode).toMatch(/import\s*\{[^}]*MAX_ARTICLE_VISUAL_ASSET_BYTES[^}]*\}\s*from\s*"@\/features\/content-intelligence\/visuals\/articleVisualStorage"/);
		expect(routeCode).not.toMatch(/8 \* 1024 \* 1024/);
	});

	it("the auth preflight appears before request.formData() in source order, and the size guard appears before file.arrayBuffer() in source order", () => {
		const authIdx = routeCode.indexOf("getAdminSession()");
		const formDataIdx = routeCode.indexOf("request.formData()");
		const sizeGuardIdx = routeCode.indexOf("file.size > MAX_ARTICLE_VISUAL_ASSET_BYTES");
		const arrayBufferIdx = routeCode.indexOf("file.arrayBuffer()");

		expect(authIdx).toBeGreaterThan(-1);
		expect(formDataIdx).toBeGreaterThan(-1);
		expect(sizeGuardIdx).toBeGreaterThan(-1);
		expect(arrayBufferIdx).toBeGreaterThan(-1);
		expect(authIdx).toBeLessThan(formDataIdx);
		expect(sizeGuardIdx).toBeLessThan(arrayBufferIdx);
	});
});
