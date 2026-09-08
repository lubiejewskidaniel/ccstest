import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/supabase/adminAuth";
import type { ArticleVisualBrief } from "./articleVisualBrief";
import type { GeneratedArticleVisual } from "./ArticleVisualProvider";
import {
	buildArticleVisualStoragePath,
	validateArticleVisualAsset,
	MAX_ARTICLE_VISUAL_ASSET_BYTES,
	type ArticleVisualCandidate,
	type ArticleVisualSourceType,
	type StoreArticleVisualResult,
} from "./articleVisualStorage";

/**
 * Phase 3C.4B.3B — real server-side Supabase Storage integration for
 * article visual candidates.
 *
 * This is the ONLY module in the `content-intelligence/visuals` folder
 * that performs I/O (Supabase reads/writes, Supabase Storage
 * upload/remove, and — for a provider's `temporary_url` result — one
 * `fetch` per store call). `articleVisualBrief.ts` and
 * `ArticleVisualProvider.ts` stay pure; `articleVisualStorage.ts` stays
 * pure (validation + path-building only). Keeping all I/O in this one
 * file is deliberate, per the approved Phase 3C.4B.3 design: the pure
 * modules must stay trivially testable without mocking a network or a
 * database.
 *
 * Both public entry points below — `storeGeneratedArticleVisual` (a
 * provider's output) and `storeUploadedArticleVisual` (a human's
 * uploaded file) — converge on the same internal `persistValidatedVisual`
 * helper once each has real bytes and a declared MIME type in hand, so
 * there is exactly one code path that validates, uploads, inserts, and
 * (conditionally) advances `cover_image_status`.
 *
 * Explicitly OUT of scope for this phase (see this file's own tests for
 * the structural boundary that enforces it): approval, rejection,
 * superseding, replacing the article's active cover, publishing,
 * calling an `ArticleVisualProvider` to generate an image, any review
 * UI, and any use of `createSupabasePrivilegedClient()` (service role) —
 * every operation here runs as the signed-in editor's own session, so
 * ordinary Postgres RLS and Storage policies are the real authorization
 * boundary, exactly like every other CMS write in
 * `src/features/insights/cms/service.ts`.
 */

/** The Supabase Storage bucket every article visual candidate's object
 * lives in. This phase never creates the bucket from application code
 * (see this file's final report for the manual setup this bucket and
 * its policies require) — a missing or unreachable bucket surfaces as a
 * `storage_error` result, never a silent auto-create. */
const ARTICLE_VISUALS_BUCKET = "article-visuals";

/** How long a provider's `temporary_url` is given to respond before this
 * module gives up and reports `storage_error`. Chosen to be generous
 * enough for a real image download, short enough that a hung provider
 * can never block an editor's request indefinitely. */
const TEMPORARY_URL_FETCH_TIMEOUT_MS = 10_000;

type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

type EditorClientResult = { ok: true; supabase: SupabaseServerClient } | { ok: false; result: StoreArticleVisualResult };

/**
 * Step 1 (configuration/client check) + step 2 (auth/editor check), in
 * that order — deliberately not folded into one `getAdminSession()`
 * call, because `getAdminSession()` returns `null` for "Supabase isn't
 * configured" and "no authenticated editor" alike, and callers need to
 * tell those two apart (`not_configured` vs `auth`). The client
 * constructed here is reused for every later Postgres/Storage
 * operation, so this is the only `createSupabaseServerClient()` call in
 * a single store action — no new auth pattern, just the same
 * session-aware client every other CMS write in `cms/service.ts` uses.
 */
async function requireEditorClient(): Promise<EditorClientResult> {
	const supabase = await createSupabaseServerClient();
	if (!supabase) {
		return {
			ok: false,
			result: { ok: false, kind: "not_configured", message: "Supabase isn't configured in this environment." },
		};
	}

	const session = await getAdminSession();
	if (!session?.isEditor) {
		return {
			ok: false,
			result: { ok: false, kind: "auth", message: "You must be signed in as an editor to store an article visual." },
		};
	}

	return { ok: true, supabase };
}

type ArticleCoverStateResult =
	| { ok: true; coverImageStatus: string }
	| { ok: false; result: StoreArticleVisualResult };

/**
 * Step 3: verify the article exists (never upload an orphaned asset —
 * this is checked here, up front, rather than left to the
 * `article_visuals.article_id` foreign key to reject the later insert
 * after storage has already happened) and read its CURRENT
 * `cover_image_status`, needed for step 10's conditional update.
 */
async function readArticleCoverState(supabase: SupabaseServerClient, articleId: string): Promise<ArticleCoverStateResult> {
	const { data, error } = await supabase.from("insights_articles").select("cover_image_status").eq("id", articleId).maybeSingle();

	if (error) {
		return {
			ok: false,
			result: { ok: false, kind: "database_error", message: "Could not verify the article before storing this visual." },
		};
	}

	if (!data) {
		return { ok: false, result: { ok: false, kind: "not_found", message: "The article this visual belongs to does not exist." } };
	}

	return { ok: true, coverImageStatus: (data as { cover_image_status: string }).cover_image_status };
}

type ObtainBytesResult = { ok: true; data: Uint8Array } | { ok: false; message: string };

/**
 * Step 4 for a generated visual. If the provider already returned raw
 * bytes, use them directly — no network call. If the provider instead
 * returned a `temporary_url`, fetch it exactly once, server-side, and
 * never persist the URL itself anywhere (not in the DB row, not in any
 * log message below) — only the downloaded bytes ever reach validation
 * and storage.
 */
async function obtainGeneratedBytes(visual: GeneratedArticleVisual): Promise<ObtainBytesResult> {
	if (visual.data.kind === "bytes") {
		return { ok: true, data: visual.data.data };
	}
	return fetchTemporaryUrlOnce(visual.data.url);
}

/**
 * Fetches a provider-supplied temporary URL exactly once. The URL comes
 * only from a `GeneratedArticleVisual` a trusted server-side
 * `ArticleVisualProvider` call already produced — never from client
 * input — so this is not an open redirect/SSRF surface for arbitrary
 * caller-supplied URLs.
 *
 * Enforces, in order: a hard 10s timeout (`AbortController`), a non-2xx
 * response rejected outright, a missing body rejected outright, an
 * early size check against `Content-Length` when the header is present,
 * and — because a response can lie about or omit `Content-Length` — a
 * hard byte-size limit enforced while streaming the body, so a
 * misbehaving or malicious response can never be buffered unbounded
 * into memory. `Content-Type` is never consulted here at all; the
 * downloaded bytes are validated for real by `validateArticleVisualAsset`
 * (byte-signature detection, never a trusted header) once this function
 * returns them.
 */
async function fetchTemporaryUrlOnce(url: string): Promise<ObtainBytesResult> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), TEMPORARY_URL_FETCH_TIMEOUT_MS);

	try {
		let response: Response;
		try {
			response = await fetch(url, { signal: controller.signal });
		} catch {
			return { ok: false, message: "Could not download the generated image from the provider." };
		}

		if (!response.ok) {
			return { ok: false, message: `The provider's image download failed (HTTP ${response.status}).` };
		}

		if (!response.body) {
			return { ok: false, message: "The provider's image download returned no data." };
		}

		const contentLengthHeader = response.headers.get("content-length");
		if (contentLengthHeader !== null) {
			const declaredLength = Number(contentLengthHeader);
			if (Number.isFinite(declaredLength) && declaredLength > MAX_ARTICLE_VISUAL_ASSET_BYTES) {
				return { ok: false, message: "The generated image exceeds the maximum allowed size." };
			}
		}

		const reader = response.body.getReader();
		const chunks: Uint8Array[] = [];
		let totalBytes = 0;

		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			if (value && value.byteLength > 0) {
				totalBytes += value.byteLength;
				if (totalBytes > MAX_ARTICLE_VISUAL_ASSET_BYTES) {
					try {
						await reader.cancel();
					} catch {
						// best-effort only; the size violation is what matters.
					}
					return { ok: false, message: "The generated image exceeds the maximum allowed size." };
				}
				chunks.push(value);
			}
		}

		const merged = new Uint8Array(totalBytes);
		let offset = 0;
		for (const chunk of chunks) {
			merged.set(chunk, offset);
			offset += chunk.byteLength;
		}

		return { ok: true, data: merged };
	} catch {
		return { ok: false, message: "Could not download the generated image from the provider." };
	} finally {
		clearTimeout(timeout);
	}
}

function describeValidationFailure(kind: string): string {
	switch (kind) {
		case "empty_payload":
			return "The image data is empty.";
		case "too_large":
			return "The image exceeds the 8 MB maximum asset size.";
		case "svg_rejected":
			return "SVG images are not supported for article covers.";
		case "unsupported_mime_type":
			return "Unsupported image type. Only PNG, JPEG and WebP are accepted.";
		case "signature_mismatch":
			return "The image data does not match its declared file type.";
		case "malformed_image":
			return "The image data is malformed or truncated.";
		default:
			return "The image could not be validated.";
	}
}

type InsertedArticleVisualRow = {
	id: string;
	article_id: string;
	storage_path: string;
	alt_text: string | null;
	source_type: ArticleVisualSourceType;
	provider: string | null;
	width: number;
	height: number;
	mime_type: string;
	created_at: string;
};

function mapRowToCandidate(row: InsertedArticleVisualRow): ArticleVisualCandidate {
	return {
		articleId: row.article_id,
		visualId: row.id,
		storagePath: row.storage_path,
		altText: row.alt_text,
		sourceType: row.source_type,
		provider: row.provider,
		width: row.width,
		height: row.height,
		// `validateArticleVisualAsset` is the only place that ever
		// establishes this as one of the three supported MIME types; by
		// the time a row exists at all, `row.mime_type` can only be one
		// of those three values.
		mimeType: row.mime_type as ArticleVisualCandidate["mimeType"],
		createdAt: row.created_at,
	};
}

type PersistValidatedVisualInput = {
	supabase: SupabaseServerClient;
	articleId: string;
	currentCoverImageStatus: string;
	data: Uint8Array;
	declaredMimeType: string;
	altText: string | null;
	sourceType: ArticleVisualSourceType;
	provider: string | null;
};

/**
 * Steps 5-11, shared by both public entry points below. This is the one
 * place that validates bytes, generates the visual id, builds the
 * storage path, uploads the object, inserts the `article_visuals` row,
 * and (only when the article's cover was still `"missing"`) advances
 * `cover_image_status` to `"pending_review"`.
 */
async function persistValidatedVisual(input: PersistValidatedVisualInput): Promise<StoreArticleVisualResult> {
	// Step 5: validate — reuses Phase 3C.4B.3A's byte-level MIME/signature/
	// size/dimension checks verbatim. Never reimplemented here.
	const validation = validateArticleVisualAsset(input.data, input.declaredMimeType);
	if (!validation.ok) {
		return { ok: false, kind: "invalid_asset", message: describeValidationFailure(validation.kind) };
	}

	// Step 6: exactly one UUID for this store action, generated before
	// upload so the same id names both the storage object and the
	// `article_visuals` row.
	const visualId = randomUUID();

	// Step 7: the pure path helper returns only the object key *inside*
	// the bucket (Phase 3C.4B.3B correction — see articleVisualStorage.ts)
	// — the bucket name itself is passed to `.storage.from(...)`
	// separately, immediately below, so the two are never concatenated.
	const objectPath = buildArticleVisualStoragePath({
		articleId: input.articleId,
		visualId,
		mimeType: validation.asset.mimeType,
	});

	// Step 8: upload. `upsert: false` — a path collision (which should be
	// essentially impossible given a fresh UUID, but is not ruled out by
	// this code) is reported as a storage error, never a silent
	// overwrite of an existing candidate's object.
	const { error: uploadError } = await input.supabase.storage.from(ARTICLE_VISUALS_BUCKET).upload(objectPath, input.data, {
		contentType: validation.asset.mimeType,
		upsert: false,
	});

	if (uploadError) {
		return { ok: false, kind: "storage_error", message: "Could not upload the image to storage." };
	}

	// Step 9: insert the candidate row. Never writes `reviewed_at` /
	// `reviewed_by`, never writes `status` other than `"pending_review"`.
	const { data: insertedRow, error: insertError } = await input.supabase
		.from("article_visuals")
		.insert({
			id: visualId,
			article_id: input.articleId,
			storage_path: objectPath,
			alt_text: input.altText,
			source_type: input.sourceType,
			provider: input.provider,
			status: "pending_review",
			width: validation.asset.width,
			height: validation.asset.height,
			mime_type: validation.asset.mimeType,
		})
		.select("id, article_id, storage_path, alt_text, source_type, provider, width, height, mime_type, created_at")
		.single();

	if (insertError || !insertedRow) {
		// The upload already succeeded but the row didn't -- best-effort
		// delete the now-orphaned object so a failed store action never
		// leaves storage in a state a later retry could collide with
		// (`upsert: false` above). A cleanup failure must never mask the
		// original persistence error, so it's swallowed here, not
		// returned or thrown.
		try {
			await input.supabase.storage.from(ARTICLE_VISUALS_BUCKET).remove([objectPath]);
		} catch {
			// best-effort only; see comment above.
		}
		return {
			ok: false,
			kind: "database_error",
			message: "Could not save this visual candidate. The uploaded image has been removed.",
		};
	}

	const candidate = mapRowToCandidate(insertedRow as InsertedArticleVisualRow);

	// Step 10: only ever flips "missing" -> "pending_review". An
	// "approved" or already-"pending_review" article is left untouched --
	// never downgraded, never re-written. The extra `.eq("cover_image_status",
	// "missing")` guard re-checks the condition at write time (not just
	// at the step-3 read), so a concurrent approval that lands between
	// this store action's read and write can never be clobbered back to
	// "pending_review".
	if (input.currentCoverImageStatus === "missing") {
		const { error: statusUpdateError } = await input.supabase
			.from("insights_articles")
			.update({ cover_image_status: "pending_review" })
			.eq("id", input.articleId)
			.eq("cover_image_status", "missing");

		if (statusUpdateError) {
			// The candidate itself was stored successfully -- that is this
			// store action's actual job, and it must not be undone or
			// reported as a failure. Only the secondary, best-effort
			// readiness update didn't happen; the caller is told via the
			// `warning`, not a failure result.
			return { ok: true, candidate, warning: "cover_status_update_failed" };
		}
	}

	// Step 11.
	return { ok: true, candidate };
}

export type StoreGeneratedArticleVisualInput = {
	articleId: string;
	/** Supplies `altText` for the stored candidate — this module never
	 * derives alt text itself. */
	brief: ArticleVisualBrief;
	/** The `ArticleVisualProvider.id` that produced `visual`. Recorded
	 * verbatim as `article_visuals.provider`. */
	providerId: string;
	visual: GeneratedArticleVisual;
};

/**
 * Stores a provider-generated visual as a new, `pending_review`
 * `article_visuals` candidate. Never calls an `ArticleVisualProvider`
 * itself — `visual` is already the finished output of one, produced by
 * trusted server-side calling code.
 */
export async function storeGeneratedArticleVisual(input: StoreGeneratedArticleVisualInput): Promise<StoreArticleVisualResult> {
	const authResult = await requireEditorClient();
	if (!authResult.ok) return authResult.result;

	const coverState = await readArticleCoverState(authResult.supabase, input.articleId);
	if (!coverState.ok) return coverState.result;

	const bytesResult = await obtainGeneratedBytes(input.visual);
	if (!bytesResult.ok) {
		return { ok: false, kind: "storage_error", message: bytesResult.message };
	}

	return persistValidatedVisual({
		supabase: authResult.supabase,
		articleId: input.articleId,
		currentCoverImageStatus: coverState.coverImageStatus,
		data: bytesResult.data,
		declaredMimeType: input.visual.mimeType,
		altText: input.brief.altText,
		sourceType: "generated",
		provider: input.providerId,
	});
}

export type StoreUploadedArticleVisualInput = {
	articleId: string;
	/** Raw image bytes, already read server-side from whatever transport
	 * carried the upload (e.g. a Server Action's `File.arrayBuffer()`).
	 * Deliberately not a URL — manual uploads never fetch a remote
	 * location, and never accept a client-supplied storage credential. */
	data: Uint8Array;
	declaredMimeType: string;
	altText?: string | null;
};

/**
 * Stores a manually uploaded image as a new, `pending_review`
 * `article_visuals` candidate.
 */
export async function storeUploadedArticleVisual(input: StoreUploadedArticleVisualInput): Promise<StoreArticleVisualResult> {
	const authResult = await requireEditorClient();
	if (!authResult.ok) return authResult.result;

	const coverState = await readArticleCoverState(authResult.supabase, input.articleId);
	if (!coverState.ok) return coverState.result;

	return persistValidatedVisual({
		supabase: authResult.supabase,
		articleId: input.articleId,
		currentCoverImageStatus: coverState.coverImageStatus,
		data: input.data,
		declaredMimeType: input.declaredMimeType,
		altText: input.altText ?? null,
		sourceType: "uploaded",
		provider: null,
	});
}
