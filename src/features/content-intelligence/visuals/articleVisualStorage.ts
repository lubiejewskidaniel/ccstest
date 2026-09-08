/**
 * Phase 3C.4B.3A — Article visual asset validation and storage-path
 * construction.
 *
 * This module is pure and deterministic: no Supabase (client, service
 * role, or Storage), no `fetch`, no filesystem, no `insights_articles`
 * read/write, no `cover_image_url`/`cover_image_alt`/`cover_image_status`
 * mutation, no provider call, no image generation, no UI, no Server
 * Action, no `Date.now()`, no `Math.random()`, no `crypto.randomUUID()`,
 * and no new dependency (no Sharp or any other image-processing
 * library) — every byte-level check below is hand-rolled against the
 * PNG/JPEG/WebP container formats.
 *
 * `ArticleVisualCandidate` and `StoreArticleVisualResult` are declared
 * here now so Phase 3C.4B.3B's `storeGeneratedArticleVisual` /
 * `storeUploadedArticleVisual` (not implemented in this phase — this
 * module contains no I/O, so nothing here can ever produce a
 * `StoreArticleVisualResult`) can consume a stable shape from day one.
 *
 * Locked design decisions carried over from the approved Phase 3C.4B.3
 * design report:
 *   - No minimum-dimension rejection in this phase. Real width/height
 *     are decoded and returned, but an otherwise-valid image is never
 *     rejected solely for being "too small" — that is a future,
 *     separately-approved quality/approval rule.
 *   - 8 MB is the only size ceiling enforced here.
 *   - `buildArticleVisualStoragePath` never generates a `visualId` —
 *     both `articleId` and `visualId` are caller-supplied. UUID
 *     generation belongs to the orchestration layer added in 3C.4B.3B.
 */

/** The only source types a candidate row can have — mirrors
 * `article_visuals.source_type`'s check constraint in
 * `supabase/migrations/011_article_visuals.sql`. */
export type ArticleVisualSourceType = "generated" | "uploaded";

/** The only review states a candidate row can have — mirrors
 * `article_visuals.status`'s check constraint. This module never sets
 * or reads this value; it exists here only so `ArticleVisualCandidate`
 * can describe a full future row shape. */
export type ArticleVisualStatus = "pending_review" | "approved" | "superseded";

/** The exact set of MIME types this phase accepts. Deliberately not
 * just `string` — `buildArticleVisualStoragePath` below can only be
 * called with one of these, which is what guarantees a stored object's
 * extension always comes from a validated MIME type and never from
 * arbitrary caller input. */
export type SupportedArticleVisualMimeType = "image/png" | "image/jpeg" | "image/webp";

const MAX_ASSET_BYTES = 8 * 1024 * 1024;

const MIME_TO_EXTENSION: Record<SupportedArticleVisualMimeType, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
};

const SUPPORTED_MIME_TYPES: readonly string[] = ["image/png", "image/jpeg", "image/webp"];

function isSupportedMimeType(value: string): value is SupportedArticleVisualMimeType {
	return SUPPORTED_MIME_TYPES.includes(value);
}

/**
 * A future candidate row shape (Phase 3C.4B.3B writes these; this
 * module only describes the shape). Deliberately mirrors
 * `article_visuals`'s columns one-to-one, minus `id`/`created_at`/
 * `reviewed_at`/`reviewed_by`, which only exist once a row has actually
 * been written or reviewed.
 */
export type ArticleVisualCandidate = {
	articleId: string;
	visualId: string;
	storagePath: string;
	altText: string | null;
	sourceType: ArticleVisualSourceType;
	provider: string | null;
	width: number;
	height: number;
	mimeType: SupportedArticleVisualMimeType;
};

/**
 * The result shape a future `storeGeneratedArticleVisual` /
 * `storeUploadedArticleVisual` (Phase 3C.4B.3B) will return. Declared
 * now for forward compatibility; nothing in this module produces one,
 * since nothing here performs any storage or database write. Follows
 * the same `{ ok, kind, message }` discriminated-union convention as
 * `CmsResult`, `StageResult`, `ArticleVisualBriefResult`, and
 * `GenerateArticleVisualResult`.
 */
export type StoreArticleVisualResult =
	| { ok: true; candidate: ArticleVisualCandidate }
	| { ok: false; kind: "invalid_asset"; message: string }
	| { ok: false; kind: "storage_error"; message: string }
	| { ok: false; kind: "database_error"; message: string };

/** The real, byte-verified properties of an image asset that has passed
 * every check in `validateArticleVisualAsset`. `width`/`height` are
 * decoded directly from the image bytes — never a caller-declared or
 * provider-reported value. */
export type ValidatedArticleVisualAsset = {
	mimeType: SupportedArticleVisualMimeType;
	width: number;
	height: number;
	byteLength: number;
};

export type ValidateArticleVisualAssetResult =
	| { ok: true; asset: ValidatedArticleVisualAsset }
	| {
			ok: false;
			kind: "empty_payload" | "too_large" | "svg_rejected" | "unsupported_mime_type" | "signature_mismatch" | "malformed_image";
			message: string;
	  };

function detectSignature(data: Uint8Array): SupportedArticleVisualMimeType | null {
	if (
		data.length >= 8 &&
		data[0] === 0x89 &&
		data[1] === 0x50 &&
		data[2] === 0x4e &&
		data[3] === 0x47 &&
		data[4] === 0x0d &&
		data[5] === 0x0a &&
		data[6] === 0x1a &&
		data[7] === 0x0a
	) {
		return "image/png";
	}

	if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
		return "image/jpeg";
	}

	if (
		data.length >= 12 &&
		data[0] === 0x52 &&
		data[1] === 0x49 &&
		data[2] === 0x46 &&
		data[3] === 0x46 &&
		data[8] === 0x57 &&
		data[9] === 0x45 &&
		data[10] === 0x42 &&
		data[11] === 0x50
	) {
		return "image/webp";
	}

	return null;
}

function looksLikeSvg(data: Uint8Array): boolean {
	// SVG is text/XML, not a binary format with a fixed magic number.
	// Sniff the first ~256 bytes for the two markers real SVG files
	// always contain near the top, ignoring leading whitespace/BOM.
	const sampleLength = Math.min(data.length, 256);
	let text = "";
	for (let i = 0; i < sampleLength; i++) {
		text += String.fromCharCode(byteAt(data, i));
	}
	const lowered = text.toLowerCase();
	return lowered.includes("<svg") || (lowered.includes("<?xml") && lowered.includes("svg"));
}

function byteAt(data: Uint8Array, index: number): number {
	// `noUncheckedIndexedAccess` types `data[index]` as `number | undefined`.
	// Every call site below has already bounds-checked `index` against
	// `data.length`, so an out-of-range read here can only mean a bug in
	// that bounds check, not a real runtime possibility -- `?? 0` keeps
	// this a plain, non-throwing arithmetic helper either way.
	return data[index] ?? 0;
}

function readUint32BE(data: Uint8Array, offset: number): number {
	return ((byteAt(data, offset) << 24) | (byteAt(data, offset + 1) << 16) | (byteAt(data, offset + 2) << 8) | byteAt(data, offset + 3)) >>> 0;
}

function readUint16BE(data: Uint8Array, offset: number): number {
	return (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
}

function readUint16LE(data: Uint8Array, offset: number): number {
	return byteAt(data, offset) | (byteAt(data, offset + 1) << 8);
}

function decodePngDimensions(data: Uint8Array): { width: number; height: number } | null {
	// Signature (8 bytes) + length (4 bytes) + "IHDR" (4 bytes) = 16,
	// then width (4 bytes BE) at 16-19, height (4 bytes BE) at 20-23.
	if (data.length < 24) return null;
	const isIhdr = data[12] === 0x49 && data[13] === 0x48 && data[14] === 0x44 && data[15] === 0x52;
	if (!isIhdr) return null;

	const width = readUint32BE(data, 16);
	const height = readUint32BE(data, 20);
	if (width <= 0 || height <= 0) return null;
	return { width, height };
}

const JPEG_SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
const JPEG_NO_PAYLOAD_MARKERS = new Set([0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9]);

function decodeJpegDimensions(data: Uint8Array): { width: number; height: number } | null {
	if (data.length < 4) return null;

	let offset = 2; // past the SOI marker (FF D8)
	const maxIterations = 10_000; // hard bound so a corrupt stream can never spin forever
	let iterations = 0;

	while (offset + 1 < data.length && iterations < maxIterations) {
		iterations++;

		if (data[offset] !== 0xff) return null;

		// Skip any fill bytes (0xFF padding) before the real marker byte.
		let markerOffset = offset + 1;
		while (markerOffset < data.length && data[markerOffset] === 0xff) markerOffset++;
		if (markerOffset >= data.length) return null;

		const marker = byteAt(data, markerOffset);
		offset = markerOffset + 1;

		if (marker === 0xd9) return null; // EOI reached with no SOF found
		if (JPEG_NO_PAYLOAD_MARKERS.has(marker)) continue;

		if (offset + 1 >= data.length) return null;
		const segmentLength = readUint16BE(data, offset);
		if (segmentLength < 2) return null;

		if (JPEG_SOF_MARKERS.has(marker)) {
			if (offset + 6 >= data.length) return null;
			const height = readUint16BE(data, offset + 3);
			const width = readUint16BE(data, offset + 5);
			if (width <= 0 || height <= 0) return null;
			return { width, height };
		}

		offset += segmentLength;
	}

	return null;
}

function decodeWebpDimensions(data: Uint8Array): { width: number; height: number } | null {
	// RIFF header (12 bytes) + sub-chunk fourCC (4 bytes) + sub-chunk
	// size (4 bytes) = 20; the format-specific payload starts there.
	if (data.length < 21) return null;

	const fourCc = String.fromCharCode(byteAt(data, 12), byteAt(data, 13), byteAt(data, 14), byteAt(data, 15));
	const payloadStart = 20;

	if (fourCc === "VP8 ") {
		// Lossy: 3-byte frame tag, 3-byte start code (0x9d 0x01 0x2a), then
		// 2-byte little-endian width/height, each with the top 2 bits as
		// scaling flags to be masked off.
		if (data.length < payloadStart + 10) return null;
		const startCodeOk = data[payloadStart + 3] === 0x9d && data[payloadStart + 4] === 0x01 && data[payloadStart + 5] === 0x2a;
		if (!startCodeOk) return null;
		const rawWidth = readUint16LE(data, payloadStart + 6);
		const rawHeight = readUint16LE(data, payloadStart + 8);
		const width = rawWidth & 0x3fff;
		const height = rawHeight & 0x3fff;
		if (width <= 0 || height <= 0) return null;
		return { width, height };
	}

	if (fourCc === "VP8L") {
		// Lossless: 1-byte signature (0x2F), then a 32-bit little-endian
		// bitstream packing (width-1) as 14 bits and (height-1) as 14 bits.
		if (data.length < payloadStart + 5) return null;
		if (data[payloadStart] !== 0x2f) return null;
		const bits = byteAt(data, payloadStart + 1) | (byteAt(data, payloadStart + 2) << 8) | (byteAt(data, payloadStart + 3) << 16) | (byteAt(data, payloadStart + 4) << 24);
		const width = (bits & 0x3fff) + 1;
		const height = ((bits >>> 14) & 0x3fff) + 1;
		if (width <= 0 || height <= 0) return null;
		return { width, height };
	}

	if (fourCc === "VP8X") {
		// Extended format: 1-byte flags, 3 reserved bytes, then 24-bit
		// little-endian (canvas width - 1) and (canvas height - 1).
		if (data.length < payloadStart + 10) return null;
		const width = (byteAt(data, payloadStart + 4) | (byteAt(data, payloadStart + 5) << 8) | (byteAt(data, payloadStart + 6) << 16)) + 1;
		const height = (byteAt(data, payloadStart + 7) | (byteAt(data, payloadStart + 8) << 8) | (byteAt(data, payloadStart + 9) << 16)) + 1;
		if (width <= 0 || height <= 0) return null;
		return { width, height };
	}

	return null;
}

function decodeDimensions(mimeType: SupportedArticleVisualMimeType, data: Uint8Array): { width: number; height: number } | null {
	if (mimeType === "image/png") return decodePngDimensions(data);
	if (mimeType === "image/jpeg") return decodeJpegDimensions(data);
	return decodeWebpDimensions(data);
}

/**
 * Validates an image asset's bytes against every rule Phase 3C.4B.3A
 * requires, never trusting the caller-declared MIME type or any
 * provider-reported dimension. Never throws — malformed or truncated
 * image data always comes back as an `{ ok: false }` result.
 *
 * Check order (each short-circuits the next):
 *   1. empty payload
 *   2. payload over 8 MB
 *   3. explicit SVG rejection (declared as `image/svg+xml`, or the
 *      bytes sniff as SVG/XML markup)
 *   4. declared MIME type outside the png/jpeg/webp allowlist
 *   5. declared MIME type doesn't match the real byte-level signature
 *   6. real signature matches but width/height can't be decoded
 *      (malformed/truncated container)
 *
 * No minimum width/height is enforced — real dimensions are decoded
 * and returned, never used to reject an otherwise-valid image in this
 * phase.
 */
export function validateArticleVisualAsset(data: Uint8Array, declaredMimeType: string): ValidateArticleVisualAssetResult {
	if (data.length === 0) {
		return { ok: false, kind: "empty_payload", message: "The image data is empty." };
	}

	if (data.length > MAX_ASSET_BYTES) {
		return { ok: false, kind: "too_large", message: "The image exceeds the 8 MB maximum asset size." };
	}

	if (declaredMimeType === "image/svg+xml" || looksLikeSvg(data)) {
		return { ok: false, kind: "svg_rejected", message: "SVG images are not supported for article covers." };
	}

	if (!isSupportedMimeType(declaredMimeType)) {
		return {
			ok: false,
			kind: "unsupported_mime_type",
			message: `Unsupported image MIME type: ${declaredMimeType}. Only image/png, image/jpeg and image/webp are accepted.`,
		};
	}

	const actualMimeType = detectSignature(data);
	if (actualMimeType === null || actualMimeType !== declaredMimeType) {
		return {
			ok: false,
			kind: "signature_mismatch",
			message: "The image bytes do not match the declared MIME type's file signature.",
		};
	}

	const dimensions = decodeDimensions(actualMimeType, data);
	if (dimensions === null) {
		return { ok: false, kind: "malformed_image", message: "The image data is malformed or truncated." };
	}

	return {
		ok: true,
		asset: {
			mimeType: actualMimeType,
			width: dimensions.width,
			height: dimensions.height,
			byteLength: data.length,
		},
	};
}

/**
 * Builds the deterministic storage object path for a validated article
 * visual: `article-visuals/{articleId}/{visualId}.{ext}`, where `ext`
 * comes exclusively from `mimeType` (typed as
 * `SupportedArticleVisualMimeType`, which only a prior
 * `validateArticleVisualAsset` success can produce) — never from
 * arbitrary caller input.
 *
 * Pure: never generates `visualId` itself. Both `articleId` and
 * `visualId` are caller-supplied; UUID generation belongs to the
 * orchestration layer added in Phase 3C.4B.3B.
 */
export function buildArticleVisualStoragePath(input: {
	articleId: string;
	visualId: string;
	mimeType: SupportedArticleVisualMimeType;
}): string {
	const extension = MIME_TO_EXTENSION[input.mimeType];
	return `article-visuals/${input.articleId}/${input.visualId}.${extension}`;
}
