import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/supabase/adminAuth";
import { storeUploadedArticleVisual } from "@/features/content-intelligence/visuals/articleVisualStorageService";
import { MAX_ARTICLE_VISUAL_ASSET_BYTES, type StoreArticleVisualResult } from "@/features/content-intelligence/visuals/articleVisualStorage";

/**
 * Phase 3C.4B.6B — the human-facing transport for manually uploading an
 * article visual. This route is a THIN TRANSPORT ADAPTER ONLY: it reads
 * a browser-submitted `multipart/form-data` body, converts the selected
 * `File` into raw bytes, and calls `storeUploadedArticleVisual` — the
 * one and only place that performs auth, 8 MB/MIME/magic-byte/SVG
 * validation, dimension decoding, the Supabase Storage upload, and the
 * `article_visuals` insert. Nothing here duplicates any of that.
 *
 * Deliberately a Route Handler, not a Server Action: this exact
 * installed Next.js version (16.3.1) enforces a default 1 MB body-size
 * ceiling on every Server Action request (`experimental.serverActions.
 * bodySizeLimit`, unset in `next.config.mjs`), which would silently
 * reject any upload between ~1 MB and the storage service's real 8 MB
 * limit. A Route Handler has no such Next.js-imposed ceiling, so the
 * existing 8 MB asset contract is preserved without widening any
 * global Server Action limit (see Phase 3C.4B.6A's design report for
 * the full trade-off).
 *
 * Phase 3C.4B.6C transport-security correction — two boundary issues
 * fixed here, both purely at the transport layer:
 *
 *   1. Auth preflight moved BEFORE `request.formData()` /
 *      `file.arrayBuffer()`. Previously an unauthenticated, non-editor,
 *      or unconfigured-Supabase request still reached full multipart
 *      parsing and file-byte buffering before `storeUploadedArticleVisual`
 *      rejected it. The preflight below (`createSupabaseServerClient()`
 *      + `getAdminSession()?.isEditor`) mirrors, but does NOT replace,
 *      `storeUploadedArticleVisual`'s own internal `requireEditorClient()`
 *      check — that remains the one authoritative auth boundary, run
 *      again, unchanged, when the service is called further down. This
 *      preflight is a transport optimization only: it never uses a
 *      service-role client, and a request that somehow reached the
 *      service despite failing this preflight would still be correctly
 *      rejected by the service's own check.
 *
 *   2. `file.size` is now checked against the storage module's own
 *      exported `MAX_ARTICLE_VISUAL_ASSET_BYTES` BEFORE
 *      `file.arrayBuffer()` is ever called, so an oversized file (a
 *      bypassed or absent client-side check) is rejected before this
 *      Node process buffers its bytes into memory. This is transport/
 *      memory protection only — `validateArticleVisualAsset` (inside
 *      `storeUploadedArticleVisual`) remains the real, authoritative 8
 *      MB check once real bytes exist, and this route never duplicates
 *      the `8 * 1024 * 1024` literal or adds any MIME/magic-byte check
 *      of its own.
 *
 * Known, honestly-documented limitation: `request.formData()` itself is
 * Next.js/undici's own multipart parser — it can still read and buffer
 * some or all of the incoming body before a `File` object (and its
 * `.size`) exists for this route to inspect. Nothing in this phase
 * attempts a custom streaming multipart parser to close that gap; doing
 * so would be a materially larger change than this correction's scope.
 * The layered protection this route participates in is, in order:
 *   Nginx request-size limit (production; see this file's own repo-level
 *   deployment note) → this route's auth preflight (before formData()) →
 *   this route's file.size check (before arrayBuffer()) →
 *   validateArticleVisualAsset's authoritative validation → Storage.
 * Each layer narrows what can reach the next; none of them alone is a
 * complete guarantee against a large or malicious body being read this
 * far, which is exactly why the outer Nginx limit still matters in
 * production regardless of anything implemented here.
 *
 * The client's declared `file.type` is passed straight through as an
 * UNTRUSTED value — `declaredMimeType` is never trusted anywhere in
 * this file; `validateArticleVisualAsset` (inside the storage service)
 * is the only place a real byte-signature check happens.
 *
 * Never receives, reads, or forwards a storage path, a public URL, a
 * bucket name, a `reviewedBy` value, or an approval/status field from
 * the client — the only fields read from the incoming form are
 * `articleId`, `file`, and an optional `altText`.
 */
export async function POST(request: NextRequest) {
	// --- Transport auth preflight (Phase 3C.4B.6C) ---------------------
	// Deliberately BEFORE request.formData() / file.arrayBuffer(). Never
	// a service-role client. storeUploadedArticleVisual's own auth check
	// further down remains authoritative and unchanged; this only avoids
	// buffering a multipart body for a request that can never succeed.
	const supabase = await createSupabaseServerClient();
	if (!supabase) {
		return NextResponse.json({ ok: false, kind: "not_configured", message: "Supabase isn't configured in this environment." }, { status: 503 });
	}

	const session = await getAdminSession();
	if (!session?.isEditor) {
		return NextResponse.json({ ok: false, kind: "auth", message: "You must be signed in as an editor to upload an article visual." }, { status: 401 });
	}
	// --------------------------------------------------------------------

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return NextResponse.json({ ok: false, kind: "invalid_request", message: "Could not read the upload request." }, { status: 400 });
	}

	const articleIdRaw = formData.get("articleId");
	const articleId = typeof articleIdRaw === "string" ? articleIdRaw.trim() : "";
	if (!articleId) {
		return NextResponse.json({ ok: false, kind: "invalid_request", message: "Missing articleId." }, { status: 400 });
	}

	const file = formData.get("file");
	if (!(file instanceof File)) {
		return NextResponse.json({ ok: false, kind: "invalid_request", message: "Missing or invalid file." }, { status: 400 });
	}

	// Never a security boundary by itself -- validateArticleVisualAsset
	// (inside storeUploadedArticleVisual) is what actually enforces this.
	// This early check only avoids reading an obviously-oversized body
	// into memory before handing it to the service.
	if (file.size === 0) {
		return NextResponse.json({ ok: false, kind: "invalid_asset", message: "The image data is empty." }, { status: 400 });
	}

	// --- Pre-buffer size guard (Phase 3C.4B.6C) -------------------------
	// Checked BEFORE file.arrayBuffer() so an oversized file never gets
	// buffered into memory by this Node process. Reuses the storage
	// module's own exported MAX_ARTICLE_VISUAL_ASSET_BYTES -- never a
	// duplicated `8 * 1024 * 1024` literal. Exactly MAX_ARTICLE_VISUAL_
	// ASSET_BYTES itself still passes (strict `>` comparison). This is
	// transport/memory protection only; validateArticleVisualAsset
	// remains the real, authoritative 8 MB check once bytes exist.
	if (file.size > MAX_ARTICLE_VISUAL_ASSET_BYTES) {
		return NextResponse.json({ ok: false, kind: "invalid_asset", message: "The image exceeds the 8 MB maximum asset size." }, { status: 400 });
	}
	// --------------------------------------------------------------------

	const altTextRaw = formData.get("altText");
	const altText = typeof altTextRaw === "string" && altTextRaw.trim().length > 0 ? altTextRaw : null;

	let data: Uint8Array;
	try {
		const arrayBuffer = await file.arrayBuffer();
		data = new Uint8Array(arrayBuffer);
	} catch {
		return NextResponse.json({ ok: false, kind: "invalid_request", message: "Could not read the uploaded file." }, { status: 400 });
	}

	// `file.type` is the browser's own declared MIME type -- untrusted,
	// passed through as-is. Real validation happens inside the service.
	const result: StoreArticleVisualResult = await storeUploadedArticleVisual({
		articleId,
		data,
		declaredMimeType: file.type,
		altText,
	});

	if (result.ok) {
		revalidatePath(`/admin/insights/${articleId}/edit`);
		return NextResponse.json(result, { status: 201 });
	}

	const status = statusForFailureKind(result.kind);
	return NextResponse.json(result, { status });
}

function statusForFailureKind(kind: Exclude<StoreArticleVisualResult, { ok: true }>["kind"]): number {
	switch (kind) {
		case "not_configured":
			return 503;
		case "auth":
			return 401;
		case "not_found":
			return 404;
		case "invalid_asset":
			return 400;
		case "storage_error":
		case "database_error":
			return 502;
		default:
			return 400;
	}
}
