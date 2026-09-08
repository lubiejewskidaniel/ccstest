import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticleVisualBrief } from "../articleVisualBrief";
import type { GeneratedArticleVisual } from "../ArticleVisualProvider";

/**
 * Phase 3C.4B.3B — coverage for the real Supabase Storage integration
 * layer. Same mocking shape as `service.publicationGate.test.ts`
 * (`@/lib/supabase/adminAuth` + `@/lib/supabase/server` mocked, a
 * hand-built fake Supabase client covering only the
 * `.from(...).select/update/insert` and `.storage.from(...).upload/remove`
 * surface this service actually touches), extended with a mocked global
 * `fetch` for the `temporary_url` provider-result path.
 */

const mockGetAdminSession = vi.fn();
vi.mock("@/lib/supabase/adminAuth", () => ({
	getAdminSession: () => mockGetAdminSession(),
}));

const mockCreateSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: () => mockCreateSupabaseServerClient(),
}));

const { storeGeneratedArticleVisual, storeUploadedArticleVisual } = await import("../articleVisualStorageService");

const EDITOR_SESSION = { userId: "u1", email: "editor@example.com", roles: ["editor"], isAdmin: false, isEditor: true };
const NON_EDITOR_SESSION = { userId: "u2", email: "viewer@example.com", roles: [], isAdmin: false, isEditor: false };

const ARTICLE_ID = "11111111-1111-4111-8111-111111111111";

// --- Minimal, real, byte-level image fixtures (same construction as
// articleVisualStorage.test.ts) -- header bytes only, no pixel payload,
// since only header bytes are ever read by validation. ---

function pngBytes(width: number, height: number): Uint8Array {
	const bytes = new Uint8Array(33);
	bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
	bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
	bytes.set([0x49, 0x48, 0x44, 0x52], 12);
	const view = new DataView(bytes.buffer);
	view.setUint32(16, width, false);
	view.setUint32(20, height, false);
	return bytes;
}

function jpegBytes(width: number, height: number): Uint8Array {
	const bytes = new Uint8Array(14);
	let offset = 0;
	bytes.set([0xff, 0xd8], offset);
	offset += 2;
	bytes.set([0xff, 0xc0], offset);
	offset += 2;
	const view = new DataView(bytes.buffer);
	view.setUint16(offset, 8, false);
	offset += 2;
	bytes[offset] = 0x08;
	offset += 1;
	view.setUint16(offset, height, false);
	offset += 2;
	view.setUint16(offset, width, false);
	offset += 2;
	bytes[offset] = 0x00;
	offset += 1;
	bytes.set([0xff, 0xd9], offset);
	return bytes;
}

function webpBytes(width: number, height: number): Uint8Array {
	const bytes = new Uint8Array(30);
	bytes.set([0x52, 0x49, 0x46, 0x46], 0);
	new DataView(bytes.buffer).setUint32(4, 22, true);
	bytes.set([0x57, 0x45, 0x42, 0x50], 8);
	bytes.set([0x56, 0x50, 0x38, 0x20], 12);
	new DataView(bytes.buffer).setUint32(16, 10, true);
	bytes.set([0x00, 0x00, 0x00], 20);
	bytes.set([0x9d, 0x01, 0x2a], 23);
	const view = new DataView(bytes.buffer);
	view.setUint16(26, width & 0x3fff, true);
	view.setUint16(28, height & 0x3fff, true);
	return bytes;
}

const VALID_PNG = pngBytes(1600, 900);

const BRIEF: ArticleVisualBrief = {
	subject: "Test Article",
	categoryKey: "build",
	locale: "en",
	requiredElements: [],
	avoidElements: [],
	altText: 'Cover illustration for the article "Test Article"',
};

function bytesVisual(data: Uint8Array, mimeType = "image/png", width = 1600, height = 900): GeneratedArticleVisual {
	return { data: { kind: "bytes", data }, mimeType, width, height };
}

function urlVisual(url: string, mimeType = "image/png", width = 1600, height = 900): GeneratedArticleVisual {
	return { data: { kind: "temporary_url", url }, mimeType, width, height };
}

const TEMPORARY_URL = "https://provider.example.com/tmp/generated-image-abc123";

type FakeSupabaseOptions = {
	article?: { cover_image_status: string } | null;
	selectError?: { message: string } | null;
	updateError?: { message: string } | null;
	insertError?: { message: string } | null;
	uploadError?: { message: string } | null;
	removeError?: { message: string } | null;
	createdAt?: string;
};

/** A minimal fake of the exact Supabase surface `articleVisualStorageService.ts`
 * touches: `.from("insights_articles").select(...).eq(...).maybeSingle()`,
 * `.from("insights_articles").update(...).eq(...).eq(...)`,
 * `.from("article_visuals").insert(...).select(...).single()`, and
 * `.storage.from("article-visuals").upload(...)` / `.remove(...)`. */
function fakeSupabase(opts: FakeSupabaseOptions = {}) {
	const { article = { cover_image_status: "missing" }, selectError = null, updateError = null, insertError = null, uploadError = null, removeError = null, createdAt = "2026-02-02T00:00:00.000Z" } = opts;

	const maybeSingle = vi.fn(async () => ({ data: article, error: selectError }));
	const selectEq = vi.fn(() => ({ maybeSingle }));
	const select = vi.fn(() => ({ eq: selectEq }));

	const updateEq2 = vi.fn(async () => ({ error: updateError }));
	const updateEq1 = vi.fn(() => ({ eq: updateEq2 }));
	const update = vi.fn((_patch: Record<string, unknown>) => ({ eq: updateEq1 }));

	let lastInsertPayload: Record<string, unknown> | null = null;
	const insertSingle = vi.fn(async () => {
		if (insertError) return { data: null, error: insertError };
		return { data: { ...lastInsertPayload, created_at: createdAt }, error: null };
	});
	const insertSelect = vi.fn((_columns: string) => ({ single: insertSingle }));
	const insert = vi.fn((row: Record<string, unknown>) => {
		lastInsertPayload = row;
		return { select: insertSelect };
	});

	const from = vi.fn((table: string) => {
		if (table === "insights_articles") return { select, update };
		if (table === "article_visuals") return { insert };
		throw new Error(`fakeSupabase: unexpected table "${table}"`);
	});

	const upload = vi.fn(async (_path: string, _data: Uint8Array, _options: Record<string, unknown>) => ({
		data: uploadError ? null : { path: _path },
		error: uploadError,
	}));
	const remove = vi.fn(async (_paths: string[]) => ({ data: removeError ? null : {}, error: removeError }));
	const storageFrom = vi.fn((_bucket: string) => ({ upload, remove }));

	return {
		from,
		storage: { from: storageFrom },
		spies: { select, selectEq, maybeSingle, update, updateEq1, updateEq2, insert, insertSelect, insertSingle, upload, remove, storageFrom },
		getLastInsertPayload: () => lastInsertPayload,
	};
}

beforeEach(() => {
	mockGetAdminSession.mockReset().mockResolvedValue(EDITOR_SESSION);
	mockCreateSupabaseServerClient.mockReset();
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("auth and article existence gates", () => {
	it("1. rejects a non-editor before any storage or database call", async () => {
		mockGetAdminSession.mockResolvedValue(NON_EDITOR_SESSION);
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await storeUploadedArticleVisual({ articleId: ARTICLE_ID, data: VALID_PNG, declaredMimeType: "image/png" });

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.kind).toBe("auth");
		expect(supabase.spies.select).not.toHaveBeenCalled();
		expect(supabase.spies.storageFrom).not.toHaveBeenCalled();
	});

	it("2. returns not_found for a missing article before any upload", async () => {
		const supabase = fakeSupabase({ article: null });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await storeUploadedArticleVisual({ articleId: ARTICLE_ID, data: VALID_PNG, declaredMimeType: "image/png" });

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.kind).toBe("not_found");
		expect(supabase.spies.storageFrom).not.toHaveBeenCalled();
	});
});

describe("generated visual: bytes and temporary_url", () => {
	it("3. stores a bytes-kind generated visual successfully", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await storeGeneratedArticleVisual({
			articleId: ARTICLE_ID,
			brief: BRIEF,
			providerId: "openai-images",
			visual: bytesVisual(VALID_PNG),
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.candidate.mimeType).toBe("image/png");
			expect(result.candidate.width).toBe(1600);
			expect(result.candidate.height).toBe(900);
		}
	});

	it("4. fetches a temporary_url exactly once and stores it successfully", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const fetchMock = vi.fn(
			async () => new Response(VALID_PNG.buffer as ArrayBuffer, { status: 200, headers: { "content-length": String(VALID_PNG.length) } }),
		);
		vi.stubGlobal("fetch", fetchMock);

		const result = await storeGeneratedArticleVisual({
			articleId: ARTICLE_ID,
			brief: BRIEF,
			providerId: "openai-images",
			visual: urlVisual(TEMPORARY_URL),
		});

		expect(result.ok).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("5. never persists the temporary URL anywhere", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(VALID_PNG.buffer as ArrayBuffer, { status: 200, headers: { "content-length": String(VALID_PNG.length) } })),
		);

		await storeGeneratedArticleVisual({ articleId: ARTICLE_ID, brief: BRIEF, providerId: "openai-images", visual: urlVisual(TEMPORARY_URL) });

		const insertPayload = supabase.getLastInsertPayload();
		expect(JSON.stringify(insertPayload)).not.toContain(TEMPORARY_URL);
		const uploadCall = supabase.spies.upload.mock.calls[0];
		expect(JSON.stringify(uploadCall)).not.toContain(TEMPORARY_URL);
	});

	it("6. maps a temporary_url HTTP failure to storage_error", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);
		vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));

		const result = await storeGeneratedArticleVisual({
			articleId: ARTICLE_ID,
			brief: BRIEF,
			providerId: "openai-images",
			visual: urlVisual(TEMPORARY_URL),
		});

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.kind).toBe("storage_error");
		expect(supabase.spies.storageFrom).not.toHaveBeenCalled();
	});

	it("7. maps a temporary_url timeout to storage_error", async () => {
		vi.useFakeTimers();
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		vi.stubGlobal(
			"fetch",
			vi.fn(
				(_url: string, options: { signal: AbortSignal }) =>
					new Promise((_resolve, reject) => {
						options.signal.addEventListener("abort", () => {
							const error = new Error("The operation was aborted.");
							error.name = "AbortError";
							reject(error);
						});
					}),
			),
		);

		const resultPromise = storeGeneratedArticleVisual({
			articleId: ARTICLE_ID,
			brief: BRIEF,
			providerId: "openai-images",
			visual: urlVisual(TEMPORARY_URL),
		});

		await vi.advanceTimersByTimeAsync(10_000);
		const result = await resultPromise;

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.kind).toBe("storage_error");
	});

	it("8. rejects an oversized downloaded asset using Content-Length, without reading the body", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const getReader = vi.fn(() => {
			throw new Error("must not be called: Content-Length should short-circuit before the body is read");
		});
		const oversizedResponse = {
			ok: true,
			status: 200,
			body: { getReader },
			headers: { get: (name: string) => (name === "content-length" ? String(9 * 1024 * 1024) : null) },
		};
		vi.stubGlobal("fetch", vi.fn(async () => oversizedResponse as unknown as Response));

		const result = await storeGeneratedArticleVisual({
			articleId: ARTICLE_ID,
			brief: BRIEF,
			providerId: "openai-images",
			visual: urlVisual(TEMPORARY_URL),
		});

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.kind).toBe("storage_error");
		expect(getReader).not.toHaveBeenCalled();
	});

	it("9. rejects invalid MIME/magic bytes for a generated visual before any upload", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		// Declares image/png but the bytes are really a JPEG signature.
		const result = await storeGeneratedArticleVisual({
			articleId: ARTICLE_ID,
			brief: BRIEF,
			providerId: "openai-images",
			visual: bytesVisual(jpegBytes(100, 100), "image/png"),
		});

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.kind).toBe("invalid_asset");
		expect(supabase.spies.storageFrom).not.toHaveBeenCalled();
	});
});

describe("manual upload", () => {
	it("10. stores a valid uploaded PNG", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);
		const result = await storeUploadedArticleVisual({ articleId: ARTICLE_ID, data: pngBytes(800, 450), declaredMimeType: "image/png" });
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.candidate.mimeType).toBe("image/png");
	});

	it("11. stores a valid uploaded JPEG", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);
		const result = await storeUploadedArticleVisual({ articleId: ARTICLE_ID, data: jpegBytes(800, 450), declaredMimeType: "image/jpeg" });
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.candidate.mimeType).toBe("image/jpeg");
	});

	it("12. stores a valid uploaded WebP", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);
		const result = await storeUploadedArticleVisual({ articleId: ARTICLE_ID, data: webpBytes(800, 450), declaredMimeType: "image/webp" });
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.candidate.mimeType).toBe("image/webp");
	});

	it("13. rejects an uploaded SVG", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);
		const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
		const result = await storeUploadedArticleVisual({ articleId: ARTICLE_ID, data: svg, declaredMimeType: "image/svg+xml" });
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.kind).toBe("invalid_asset");
		expect(supabase.spies.storageFrom).not.toHaveBeenCalled();
	});
});

describe("row shape and write invariants", () => {
	it("14. a generated candidate's row has source_type=generated and provider=providerId", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);
		await storeGeneratedArticleVisual({ articleId: ARTICLE_ID, brief: BRIEF, providerId: "openai-images", visual: bytesVisual(VALID_PNG) });
		const payload = supabase.getLastInsertPayload();
		expect(payload?.source_type).toBe("generated");
		expect(payload?.provider).toBe("openai-images");
	});

	it("15. an uploaded candidate's row has source_type=uploaded and provider=null", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);
		await storeUploadedArticleVisual({ articleId: ARTICLE_ID, data: VALID_PNG, declaredMimeType: "image/png" });
		const payload = supabase.getLastInsertPayload();
		expect(payload?.source_type).toBe("uploaded");
		expect(payload?.provider).toBeNull();
	});

	it("16. status is always pending_review for both flows", async () => {
		const supabaseA = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabaseA);
		await storeGeneratedArticleVisual({ articleId: ARTICLE_ID, brief: BRIEF, providerId: "openai-images", visual: bytesVisual(VALID_PNG) });
		expect(supabaseA.getLastInsertPayload()?.status).toBe("pending_review");

		const supabaseB = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabaseB);
		await storeUploadedArticleVisual({ articleId: ARTICLE_ID, data: VALID_PNG, declaredMimeType: "image/png" });
		expect(supabaseB.getLastInsertPayload()?.status).toBe("pending_review");
	});

	it("17. the storage upload call uses upsert: false", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);
		await storeUploadedArticleVisual({ articleId: ARTICLE_ID, data: VALID_PNG, declaredMimeType: "image/png" });
		const call = supabase.spies.upload.mock.calls[0];
		if (!call) throw new Error("upload was not called");
		const [, , options] = call;
		expect(options.upsert).toBe(false);
	});

	it("18. the storage upload call's contentType comes from the validated MIME type", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);
		await storeUploadedArticleVisual({ articleId: ARTICLE_ID, data: webpBytes(400, 300), declaredMimeType: "image/webp" });
		const call = supabase.spies.upload.mock.calls[0];
		if (!call) throw new Error("upload was not called");
		const [, , options] = call;
		expect(options.contentType).toBe("image/webp");
	});

	it("19. the article_visuals insert uses the same visualId as the storage path", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);
		const result = await storeUploadedArticleVisual({ articleId: ARTICLE_ID, data: VALID_PNG, declaredMimeType: "image/png" });
		expect(result.ok).toBe(true);

		const uploadCall = supabase.spies.upload.mock.calls[0];
		if (!uploadCall) throw new Error("upload was not called");
		const [uploadedPath] = uploadCall;
		const payload = supabase.getLastInsertPayload();
		expect(payload?.id).toBeTruthy();
		expect(uploadedPath).toBe(`${ARTICLE_ID}/${payload?.id}.png`);
		if (result.ok) expect(result.candidate.storagePath).toBe(uploadedPath);
	});
});

describe("cover_image_status transition", () => {
	it("20. missing -> pending_review updates cover_image_status only", async () => {
		const supabase = fakeSupabase({ article: { cover_image_status: "missing" } });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);
		await storeUploadedArticleVisual({ articleId: ARTICLE_ID, data: VALID_PNG, declaredMimeType: "image/png" });
		expect(supabase.spies.update).toHaveBeenCalledTimes(1);
		expect(supabase.spies.update).toHaveBeenCalledWith({ cover_image_status: "pending_review" });
	});

	it("21. pending_review stays pending_review (no update call at all)", async () => {
		const supabase = fakeSupabase({ article: { cover_image_status: "pending_review" } });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);
		await storeUploadedArticleVisual({ articleId: ARTICLE_ID, data: VALID_PNG, declaredMimeType: "image/png" });
		expect(supabase.spies.update).not.toHaveBeenCalled();
	});

	it("22. approved stays approved (no update call at all)", async () => {
		const supabase = fakeSupabase({ article: { cover_image_status: "approved" } });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);
		const result = await storeUploadedArticleVisual({ articleId: ARTICLE_ID, data: VALID_PNG, declaredMimeType: "image/png" });
		expect(result.ok).toBe(true);
		expect(supabase.spies.update).not.toHaveBeenCalled();
	});

	it("23. an approved article's cover_image_url is never touched", async () => {
		const supabase = fakeSupabase({ article: { cover_image_status: "approved" } });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);
		await storeUploadedArticleVisual({ articleId: ARTICLE_ID, data: VALID_PNG, declaredMimeType: "image/png" });
		for (const call of supabase.spies.update.mock.calls) {
			expect(JSON.stringify(call)).not.toContain("cover_image_url");
		}
	});

	it("24. an approved article's cover_image_alt is never touched", async () => {
		const supabase = fakeSupabase({ article: { cover_image_status: "approved" } });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);
		await storeUploadedArticleVisual({ articleId: ARTICLE_ID, data: VALID_PNG, declaredMimeType: "image/png" });
		for (const call of supabase.spies.update.mock.calls) {
			expect(JSON.stringify(call)).not.toContain("cover_image_alt");
		}
	});
});

describe("partial-failure handling", () => {
	it("25. an article_visuals insert failure triggers best-effort storage cleanup", async () => {
		const supabase = fakeSupabase({ insertError: { message: "insert failed" } });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await storeUploadedArticleVisual({ articleId: ARTICLE_ID, data: VALID_PNG, declaredMimeType: "image/png" });

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.kind).toBe("database_error");
		expect(supabase.spies.remove).toHaveBeenCalledTimes(1);
		const uploadCall = supabase.spies.upload.mock.calls[0];
		if (!uploadCall) throw new Error("upload was not called");
		const [uploadedPath] = uploadCall;
		expect(supabase.spies.remove).toHaveBeenCalledWith([uploadedPath]);
	});

	it("26. a cleanup failure does not mask the original persistence error", async () => {
		const supabase = fakeSupabase({ insertError: { message: "insert failed" }, removeError: { message: "cleanup also failed" } });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await storeUploadedArticleVisual({ articleId: ARTICLE_ID, data: VALID_PNG, declaredMimeType: "image/png" });

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.kind).toBe("database_error");
			expect(result.message.toLowerCase()).not.toContain("cleanup also failed");
		}
	});

	it("27. an upload failure causes no database insert at all", async () => {
		const supabase = fakeSupabase({ uploadError: { message: "upload failed" } });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await storeUploadedArticleVisual({ articleId: ARTICLE_ID, data: VALID_PNG, declaredMimeType: "image/png" });

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.kind).toBe("storage_error");
		expect(supabase.spies.insert).not.toHaveBeenCalled();
	});

	it("28. a validation failure causes no upload at all", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await storeUploadedArticleVisual({ articleId: ARTICLE_ID, data: new Uint8Array(0), declaredMimeType: "image/png" });

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.kind).toBe("invalid_asset");
		expect(supabase.spies.storageFrom).not.toHaveBeenCalled();
	});

	it("a failed cover-status update after a successful insert returns ok:true with a warning, and does not delete the candidate", async () => {
		const supabase = fakeSupabase({ article: { cover_image_status: "missing" }, updateError: { message: "update failed" } });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await storeUploadedArticleVisual({ articleId: ARTICLE_ID, data: VALID_PNG, declaredMimeType: "image/png" });

		expect(result.ok).toBe(true);
		if (result.ok) expect(result.warning).toBe("cover_status_update_failed");
		expect(supabase.spies.remove).not.toHaveBeenCalled();
	});
});

describe("candidate mapping and idempotency", () => {
	it("29. the returned candidate's createdAt comes from the DB row, never Date.now()", async () => {
		const FIXED_CREATED_AT = "2030-05-05T12:00:00.000Z";
		const supabase = fakeSupabase({ createdAt: FIXED_CREATED_AT });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const before = Date.now();
		const result = await storeUploadedArticleVisual({ articleId: ARTICLE_ID, data: VALID_PNG, declaredMimeType: "image/png" });

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.candidate.createdAt).toBe(FIXED_CREATED_AT);
			expect(result.candidate.createdAt).not.toBe(new Date(before).toISOString());
		}
	});

	it("35. generated and uploaded paths converge to the same candidate shape", async () => {
		const supabaseA = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabaseA);
		const generated = await storeGeneratedArticleVisual({
			articleId: ARTICLE_ID,
			brief: BRIEF,
			providerId: "openai-images",
			visual: bytesVisual(VALID_PNG),
		});

		const supabaseB = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabaseB);
		const uploaded = await storeUploadedArticleVisual({ articleId: ARTICLE_ID, data: VALID_PNG, declaredMimeType: "image/png" });

		expect(generated.ok).toBe(true);
		expect(uploaded.ok).toBe(true);
		if (generated.ok && uploaded.ok) {
			expect(Object.keys(generated.candidate).sort()).toEqual(Object.keys(uploaded.candidate).sort());
		}
	});

	it("36. two explicit invocations create different candidate ids and paths", async () => {
		const supabaseA = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabaseA);
		const first = await storeUploadedArticleVisual({ articleId: ARTICLE_ID, data: VALID_PNG, declaredMimeType: "image/png" });

		const supabaseB = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabaseB);
		const second = await storeUploadedArticleVisual({ articleId: ARTICLE_ID, data: VALID_PNG, declaredMimeType: "image/png" });

		expect(first.ok).toBe(true);
		expect(second.ok).toBe(true);
		if (first.ok && second.ok) {
			expect(first.candidate.visualId).not.toBe(second.candidate.visualId);
			expect(first.candidate.storagePath).not.toBe(second.candidate.storagePath);
		}
	});

	it("37. the storage path does not double-prefix the bucket name", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);
		await storeUploadedArticleVisual({ articleId: ARTICLE_ID, data: VALID_PNG, declaredMimeType: "image/png" });

		expect(supabase.spies.storageFrom).toHaveBeenCalledWith("article-visuals");
		const uploadCall = supabase.spies.upload.mock.calls[0];
		if (!uploadCall) throw new Error("upload was not called");
		const [uploadedPath] = uploadCall;
		expect(uploadedPath.startsWith("article-visuals/")).toBe(false);
	});
});

describe("articleVisualStorageService.ts structural boundaries", () => {
	const SOURCE_PATH = resolve(process.cwd(), "src/features/content-intelligence/visuals/articleVisualStorageService.ts");
	const source = readFileSync(SOURCE_PATH, "utf8");
	const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

	it("30. never calls Date.now()", () => {
		expect(codeOnly).not.toMatch(/Date\.now\s*\(/);
	});

	it("31. never imports or uses the service-role/privileged client", () => {
		expect(codeOnly).not.toMatch(/privileged/i);
		expect(codeOnly).not.toMatch(/createSupabasePrivilegedClient/);
		expect(codeOnly).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
	});

	it('32. never writes status "approved" or "superseded"', () => {
		expect(codeOnly).not.toMatch(/approved/i);
		expect(codeOnly).not.toMatch(/superseded/i);
	});

	it("33. never calls a publish/status-transition path", () => {
		expect(codeOnly).not.toMatch(/transitionArticleStatus/);
		expect(codeOnly).not.toMatch(/["']published["']/);
	});

	it("34. never mutates cover_image_url or cover_image_alt", () => {
		expect(codeOnly).not.toMatch(/cover_image_url/);
		expect(codeOnly).not.toMatch(/cover_image_alt/);
	});

	it("never calls an ArticleVisualProvider's generate()", () => {
		expect(codeOnly).not.toMatch(/\.generate\s*\(/);
	});

	it("has no UI or Server Action markers", () => {
		expect(codeOnly).not.toMatch(/"use client"|"use server"|from "react"/);
	});

	it("never auto-creates the storage bucket", () => {
		expect(codeOnly).not.toMatch(/createBucket/i);
	});
});
