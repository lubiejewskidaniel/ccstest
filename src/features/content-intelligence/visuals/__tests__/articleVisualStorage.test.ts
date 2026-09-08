import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	buildArticleVisualStoragePath,
	validateArticleVisualAsset,
	type SupportedArticleVisualMimeType,
} from "../articleVisualStorage";

// --- Hand-built, minimal fixture encoders -----------------------------
//
// These build the smallest possible byte sequences that satisfy each
// container format's header rules well enough for a decoder to read
// real width/height back out. They are not renderable images (no pixel
// data, no real entropy-coded scan/compressed payload) -- that's fine,
// because `validateArticleVisualAsset` only ever reads header bytes; it
// never decodes pixel data.

function pngBytes(width: number, height: number): Uint8Array {
	const bytes = new Uint8Array(33);
	// PNG signature.
	bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
	// IHDR chunk: 4-byte length (13), "IHDR", then a 13-byte payload
	// (width, height, bit depth, color type, compression, filter,
	// interlace). Only the first 8 payload bytes (width/height) matter
	// to the decoder; the rest can be zero.
	bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
	bytes.set([0x49, 0x48, 0x44, 0x52], 12);
	const view = new DataView(bytes.buffer);
	view.setUint32(16, width, false);
	view.setUint32(20, height, false);
	return bytes;
}

function jpegBytes(width: number, height: number): Uint8Array {
	// SOI, then a single SOF0 marker segment carrying the real
	// dimensions, then EOI. No APPn/DQT/scan data -- the decoder stops
	// scanning the instant it finds an SOF marker.
	const bytes = new Uint8Array(2 + 2 + 2 + 1 + 2 + 2 + 1 + 2);
	let offset = 0;
	bytes.set([0xff, 0xd8], offset); // SOI
	offset += 2;
	bytes.set([0xff, 0xc0], offset); // SOF0
	offset += 2;
	const view = new DataView(bytes.buffer);
	view.setUint16(offset, 8, false); // segment length (2 length + 1 precision + 2 height + 2 width, minus 1 component byte we omit)
	offset += 2;
	bytes[offset] = 0x08; // precision
	offset += 1;
	view.setUint16(offset, height, false);
	offset += 2;
	view.setUint16(offset, width, false);
	offset += 2;
	bytes[offset] = 0x00; // component count (unused by the decoder)
	offset += 1;
	bytes.set([0xff, 0xd9], offset); // EOI
	return bytes;
}

function webpVp8Bytes(width: number, height: number): Uint8Array {
	const bytes = new Uint8Array(30);
	bytes.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
	new DataView(bytes.buffer).setUint32(4, 22, true); // RIFF size (little-endian, not exact -- unused by the decoder)
	bytes.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"
	bytes.set([0x56, 0x50, 0x38, 0x20], 12); // "VP8 "
	new DataView(bytes.buffer).setUint32(16, 10, true); // chunk size
	// Payload starts at offset 20: 3-byte frame tag, 3-byte start code.
	bytes.set([0x00, 0x00, 0x00], 20);
	bytes.set([0x9d, 0x01, 0x2a], 23);
	const view = new DataView(bytes.buffer);
	view.setUint16(26, width & 0x3fff, true);
	view.setUint16(28, height & 0x3fff, true);
	return bytes;
}

function webpVp8lBytes(width: number, height: number): Uint8Array {
	const bytes = new Uint8Array(25);
	bytes.set([0x52, 0x49, 0x46, 0x46], 0);
	new DataView(bytes.buffer).setUint32(4, 17, true);
	bytes.set([0x57, 0x45, 0x42, 0x50], 8);
	bytes.set([0x56, 0x50, 0x38, 0x4c], 12); // "VP8L"
	new DataView(bytes.buffer).setUint32(16, 5, true);
	bytes[20] = 0x2f; // VP8L signature
	const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
	bytes[21] = bits & 0xff;
	bytes[22] = (bits >>> 8) & 0xff;
	bytes[23] = (bits >>> 16) & 0xff;
	bytes[24] = (bits >>> 24) & 0xff;
	return bytes;
}

function webpVp8xBytes(width: number, height: number): Uint8Array {
	const bytes = new Uint8Array(30);
	bytes.set([0x52, 0x49, 0x46, 0x46], 0);
	new DataView(bytes.buffer).setUint32(4, 22, true);
	bytes.set([0x57, 0x45, 0x42, 0x50], 8);
	bytes.set([0x56, 0x50, 0x38, 0x58], 12); // "VP8X"
	new DataView(bytes.buffer).setUint32(16, 10, true);
	bytes[20] = 0x00; // flags
	bytes.set([0x00, 0x00, 0x00], 21); // reserved
	const w = width - 1;
	const h = height - 1;
	bytes[24] = w & 0xff;
	bytes[25] = (w >>> 8) & 0xff;
	bytes[26] = (w >>> 16) & 0xff;
	bytes[27] = h & 0xff;
	bytes[28] = (h >>> 8) & 0xff;
	bytes[29] = (h >>> 16) & 0xff;
	return bytes;
}

const SVG_TEXT = new TextEncoder().encode('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');

describe("validateArticleVisualAsset", () => {
	it("accepts a valid PNG and decodes its real dimensions", () => {
		const result = validateArticleVisualAsset(pngBytes(1600, 900), "image/png");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.asset.mimeType).toBe("image/png");
			expect(result.asset.width).toBe(1600);
			expect(result.asset.height).toBe(900);
			expect(result.asset.byteLength).toBe(pngBytes(1600, 900).length);
		}
	});

	it("accepts a valid JPEG and decodes its real dimensions", () => {
		const result = validateArticleVisualAsset(jpegBytes(1200, 630), "image/jpeg");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.asset.mimeType).toBe("image/jpeg");
			expect(result.asset.width).toBe(1200);
			expect(result.asset.height).toBe(630);
		}
	});

	it("accepts a valid lossy WebP (VP8) and decodes its real dimensions", () => {
		const result = validateArticleVisualAsset(webpVp8Bytes(800, 450), "image/webp");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.asset.mimeType).toBe("image/webp");
			expect(result.asset.width).toBe(800);
			expect(result.asset.height).toBe(450);
		}
	});

	it("accepts a valid lossless WebP (VP8L) and decodes its real dimensions", () => {
		const result = validateArticleVisualAsset(webpVp8lBytes(640, 360), "image/webp");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.asset.width).toBe(640);
			expect(result.asset.height).toBe(360);
		}
	});

	it("accepts a valid extended WebP (VP8X) and decodes its real dimensions", () => {
		const result = validateArticleVisualAsset(webpVp8xBytes(1920, 1080), "image/webp");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.asset.width).toBe(1920);
			expect(result.asset.height).toBe(1080);
		}
	});

	it("rejects an empty payload", () => {
		const result = validateArticleVisualAsset(new Uint8Array(0), "image/png");
		expect(result).toEqual({ ok: false, kind: "empty_payload", message: expect.any(String) });
	});

	it("rejects a payload over 8 MB", () => {
		const oversized = new Uint8Array(8 * 1024 * 1024 + 1);
		oversized.set(pngBytes(10, 10).subarray(0, 33), 0);
		const result = validateArticleVisualAsset(oversized, "image/png");
		expect(result).toEqual({ ok: false, kind: "too_large", message: expect.any(String) });
	});

	it("accepts a payload exactly at the 8 MB boundary (structurally -- still must decode)", () => {
		// Exactly 8 MB of PNG-signature-prefixed bytes should not be
		// rejected for size; it may still fail decoding if malformed,
		// which is a separate concern from the size check itself.
		const exact = new Uint8Array(8 * 1024 * 1024);
		exact.set(pngBytes(10, 10), 0);
		const result = validateArticleVisualAsset(exact, "image/png");
		expect(result.ok).toBe(true);
	});

	it("rejects SVG declared via its MIME type", () => {
		const result = validateArticleVisualAsset(SVG_TEXT, "image/svg+xml");
		expect(result).toEqual({ ok: false, kind: "svg_rejected", message: expect.any(String) });
	});

	it("rejects SVG content sniffed by its markup even under a different declared MIME type", () => {
		const result = validateArticleVisualAsset(SVG_TEXT, "image/png");
		expect(result).toEqual({ ok: false, kind: "svg_rejected", message: expect.any(String) });
	});

	it("rejects an unsupported MIME type", () => {
		const result = validateArticleVisualAsset(new Uint8Array([1, 2, 3, 4]), "image/gif");
		expect(result).toEqual({ ok: false, kind: "unsupported_mime_type", message: expect.any(String) });
	});

	it("rejects a PNG-signature payload declared as image/jpeg (signature mismatch)", () => {
		const result = validateArticleVisualAsset(pngBytes(100, 100), "image/jpeg");
		expect(result).toEqual({ ok: false, kind: "signature_mismatch", message: expect.any(String) });
	});

	it("rejects a JPEG-signature payload declared as image/png (signature mismatch)", () => {
		const result = validateArticleVisualAsset(jpegBytes(100, 100), "image/png");
		expect(result).toEqual({ ok: false, kind: "signature_mismatch", message: expect.any(String) });
	});

	it("rejects a WebP-signature payload declared as image/jpeg (signature mismatch)", () => {
		const result = validateArticleVisualAsset(webpVp8Bytes(100, 100), "image/jpeg");
		expect(result).toEqual({ ok: false, kind: "signature_mismatch", message: expect.any(String) });
	});

	it("rejects bytes with no recognizable signature at all", () => {
		const result = validateArticleVisualAsset(new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]), "image/png");
		expect(result).toEqual({ ok: false, kind: "signature_mismatch", message: expect.any(String) });
	});

	it("rejects a truncated PNG (valid signature, no IHDR)", () => {
		const truncated = pngBytes(100, 100).subarray(0, 12);
		const result = validateArticleVisualAsset(truncated, "image/png");
		expect(result).toEqual({ ok: false, kind: "malformed_image", message: expect.any(String) });
	});

	it("rejects a truncated JPEG (SOI + SOF marker byte only, segment cut off before its length/height/width)", () => {
		const truncated = jpegBytes(100, 100).subarray(0, 4);
		const result = validateArticleVisualAsset(truncated, "image/jpeg");
		expect(result).toEqual({ ok: false, kind: "malformed_image", message: expect.any(String) });
	});

	it("rejects a JPEG whose marker stream never reaches an SOF segment", () => {
		// SOI followed directly by EOI -- structurally a JPEG signature,
		// but no frame header to decode dimensions from.
		const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
		const result = validateArticleVisualAsset(bytes, "image/jpeg");
		expect(result).toEqual({ ok: false, kind: "malformed_image", message: expect.any(String) });
	});

	it("rejects a truncated WebP (RIFF/WEBP header only, no VP8 sub-chunk)", () => {
		const truncated = webpVp8Bytes(100, 100).subarray(0, 16);
		const result = validateArticleVisualAsset(truncated, "image/webp");
		expect(result).toEqual({ ok: false, kind: "malformed_image", message: expect.any(String) });
	});

	it("rejects a WebP with an unrecognized sub-format fourCC", () => {
		const bytes = webpVp8Bytes(100, 100);
		bytes.set([0x00, 0x00, 0x00, 0x00], 12); // corrupt the "VP8 " fourCC
		const result = validateArticleVisualAsset(bytes, "image/webp");
		expect(result).toEqual({ ok: false, kind: "malformed_image", message: expect.any(String) });
	});

	it("does not reject a very small (below any conventional minimum) image on dimension grounds", () => {
		const result = validateArticleVisualAsset(pngBytes(1, 1), "image/png");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.asset.width).toBe(1);
			expect(result.asset.height).toBe(1);
		}
	});

	it("never throws on arbitrary random bytes", () => {
		const random = new Uint8Array(64);
		for (let i = 0; i < random.length; i++) random[i] = (i * 37) % 256;
		expect(() => validateArticleVisualAsset(random, "image/png")).not.toThrow();
		expect(() => validateArticleVisualAsset(random, "image/jpeg")).not.toThrow();
		expect(() => validateArticleVisualAsset(random, "image/webp")).not.toThrow();
	});
});

describe("buildArticleVisualStoragePath", () => {
	const CASES: Array<{ mimeType: SupportedArticleVisualMimeType; ext: string }> = [
		{ mimeType: "image/png", ext: "png" },
		{ mimeType: "image/jpeg", ext: "jpg" },
		{ mimeType: "image/webp", ext: "webp" },
	];

	for (const { mimeType, ext } of CASES) {
		it(`maps ${mimeType} to the .${ext} extension`, () => {
			const path = buildArticleVisualStoragePath({ articleId: "article-1", visualId: "visual-1", mimeType });
			expect(path).toBe(`article-1/visual-1.${ext}`);
		});
	}

	it("builds a deterministic path for the same inputs", () => {
		const a = buildArticleVisualStoragePath({ articleId: "article-1", visualId: "visual-1", mimeType: "image/png" });
		const b = buildArticleVisualStoragePath({ articleId: "article-1", visualId: "visual-1", mimeType: "image/png" });
		expect(a).toBe(b);
	});

	it("produces different paths for different visualIds under the same article", () => {
		const a = buildArticleVisualStoragePath({ articleId: "article-1", visualId: "visual-1", mimeType: "image/png" });
		const b = buildArticleVisualStoragePath({ articleId: "article-1", visualId: "visual-2", mimeType: "image/png" });
		expect(a).not.toBe(b);
	});

	it("produces different paths for different articleIds under the same visualId", () => {
		const a = buildArticleVisualStoragePath({ articleId: "article-1", visualId: "visual-1", mimeType: "image/png" });
		const b = buildArticleVisualStoragePath({ articleId: "article-2", visualId: "visual-1", mimeType: "image/png" });
		expect(a).not.toBe(b);
	});

	it("derives the extension only from the validated MIME type, never from the raw id strings", () => {
		const path = buildArticleVisualStoragePath({
			articleId: "article.with.dots.jpg",
			visualId: "visual.with.dots.png",
			mimeType: "image/webp",
		});
		expect(path).toBe("article.with.dots.jpg/visual.with.dots.png.webp");
	});

	it("never includes the bucket name as a path segment (Phase 3C.4B.3B regression: the bucket name and this object key are separate Storage API arguments, so a returned path that already started with \"article-visuals/\" would double-prefix once passed to `supabase.storage.from(\"article-visuals\").upload(path, ...)`)", () => {
		const path = buildArticleVisualStoragePath({ articleId: "article-1", visualId: "visual-1", mimeType: "image/png" });
		expect(path.startsWith("article-visuals/")).toBe(false);
		expect(path).toBe("article-1/visual-1.png");
	});
});

describe("supabase/migrations/011_article_visuals.sql", () => {
	const MIGRATION_PATH = resolve(process.cwd(), "supabase/migrations/011_article_visuals.sql");
	const migrationSource = readFileSync(MIGRATION_PATH, "utf8");

	it("creates the article_visuals table with source_type, status and provenance columns", () => {
		expect(migrationSource).toMatch(/create table if not exists public\.article_visuals/);
		expect(migrationSource).toMatch(/source_type text not null/);
		expect(migrationSource).toMatch(/status text not null default 'pending_review'/);
	});

	it("includes the partial unique index guaranteeing one approved row per article", () => {
		expect(migrationSource).toContain(
			"create unique index if not exists article_visuals_one_approved_per_article_idx\n  on public.article_visuals (article_id)\n  where status = 'approved';",
		);
	});

	it("enables row level security and follows the is_active_editor_or_admin() convention", () => {
		expect(migrationSource).toMatch(/enable row level security/);
		expect(migrationSource).toMatch(/is_active_editor_or_admin\(\)/);
	});

	it("defines select, insert and update policies but no delete policy", () => {
		expect(migrationSource).toContain('"article_visuals: editor select"');
		expect(migrationSource).toContain('"article_visuals: editor insert"');
		expect(migrationSource).toContain('"article_visuals: editor update"');
		expect(migrationSource).not.toMatch(/for delete/);
	});

	it("grants select/insert/update to authenticated and all to service_role", () => {
		expect(migrationSource).toMatch(/grant select, insert, update\s+on table public\.article_visuals\s+to authenticated;/);
		expect(migrationSource).toMatch(/grant all\s+on table public\.article_visuals\s+to service_role;/);
	});

	it("does not modify insights_articles or its cover_image_* columns", () => {
		// Real structural check: this migration must never issue an
		// `alter table public.insights_articles` statement at all.
		expect(migrationSource).not.toMatch(/alter table public\.insights_articles/);

		// The naive follow-up check -- a raw substring/regex search for
		// `cover_image_url` / `cover_image_alt` / `cover_image_status`
		// anywhere in the file -- is a false positive here: this
		// migration's own doc comments *name* those existing
		// `insights_articles` columns specifically to explain that they
		// are left untouched (see the module header and the "Lifecycle"
		// note above the table definition). Comments are documentation,
		// not executable SQL, so they must not fail this check.
		//
		// Strip `--` line comments and `/* ... */` block comments first,
		// then assert the remaining executable SQL contains no
		// `add column` / `drop column` / `alter column` clause naming any
		// of those columns -- the actual thing this test cares about.
		const executableSql = migrationSource
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/--.*$/gm, "");

		const coverImageColumns = ["cover_image_url", "cover_image_alt", "cover_image_status"];
		const mutationVerbs = ["add column", "drop column", "alter column"];

		for (const column of coverImageColumns) {
			for (const verb of mutationVerbs) {
				const mutationPattern = new RegExp(`${verb}\\s+(if (not )?exists\\s+)?${column}\\b`, "i");
				expect(executableSql).not.toMatch(mutationPattern);
			}
		}
	});
});

describe("articleVisualStorage.ts structural boundaries", () => {
	const SOURCE_PATH = resolve(process.cwd(), "src/features/content-intelligence/visuals/articleVisualStorage.ts");
	const source = readFileSync(SOURCE_PATH, "utf8");
	// Strip comments first: this module's own doc comments legitimately
	// *name* forbidden concepts (Supabase, fetch, Sharp, crypto.randomUUID,
	// insights_articles, cover_image_*) to document that they are absent --
	// a raw, comment-inclusive substring check would false-positive on
	// that prose.
	const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

	it("never imports Supabase", () => {
		expect(codeOnly).not.toMatch(/supabase/i);
	});

	it("never calls fetch", () => {
		expect(codeOnly).not.toMatch(/\bfetch\s*\(/);
	});

	it("never references insights_articles or cover_image_* fields", () => {
		expect(codeOnly).not.toMatch(/insights_articles/);
		expect(codeOnly).not.toMatch(/cover_image_(url|alt|status)/);
	});

	it("never calls an image-generation provider", () => {
		expect(codeOnly).not.toMatch(/ArticleVisualProvider|\.generate\(/);
	});

	it("has no UI or Server Action markers", () => {
		expect(codeOnly).not.toMatch(/"use client"|"use server"|from "react"/);
	});

	it("never calls Date.now(), Math.random(), or crypto.randomUUID()", () => {
		expect(codeOnly).not.toMatch(/Date\.now\s*\(/);
		expect(codeOnly).not.toMatch(/Math\.random\s*\(/);
		expect(codeOnly).not.toMatch(/randomUUID\s*\(/);
	});

	it("does not implement storeGeneratedArticleVisual or storeUploadedArticleVisual", () => {
		expect(codeOnly).not.toMatch(/function\s+storeGeneratedArticleVisual/);
		expect(codeOnly).not.toMatch(/function\s+storeUploadedArticleVisual/);
	});

	it("does not add a new image-processing dependency (no Sharp)", () => {
		expect(codeOnly).not.toMatch(/from "sharp"|require\("sharp"\)/);
	});

	it("imports nothing from outside this module's own folder", () => {
		const importLines = source.split("\n").filter((line) => line.trimStart().startsWith("import"));
		expect(importLines).toEqual([]);
	});
});
