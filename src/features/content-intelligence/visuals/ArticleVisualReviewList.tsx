"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveArticleVisualAction, generateArticleVisualAction, deleteArticleVisualAction } from "@/lib/actions/insightsCms";
import type { ArticleVisualListItem } from "./articleVisualQueries";
import type { ArticleCoverImageStatus } from "@/features/insights/types/article";
import type { Locale } from "@/lib/routes";
import styles from "./ArticleVisualReviewPanel.module.css";

const STATUS_LABEL: Record<ArticleVisualListItem["status"], string> = {
	pending_review: "Pending review",
	approved: "Approved",
	superseded: "Superseded",
};

/** UX-only mirror of the server's authoritative
 * `MAX_ARTICLE_VISUAL_ASSET_BYTES` (articleVisualStorage.ts). Never a
 * security boundary -- the Route Handler's call into
 * `storeUploadedArticleVisual` re-validates this independently, and
 * this constant exists only so an editor gets immediate feedback
 * instead of waiting on a round trip for a file that can never pass. */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Browser `accept` guidance only -- purely a UX hint, never trusted.
 * The server never trusts extension, browser-declared MIME, or
 * filename; `validateArticleVisualAsset` decides for real via
 * byte-signature detection. SVG is deliberately never offered here. */
const ACCEPTED_UPLOAD_MIME_TYPES = "image/png,image/jpeg,image/webp";

/**
 * Phase 3C.4B.4B — owns every interactive part of visual review: the
 * per-candidate editable alt text, the approval transition, inline
 * replacement confirmation, and error feedback. Mirrors
 * `ArticleStatusActions`'s shape deliberately: `useTransition` (not
 * `useActionState`, since `approveArticleVisualAction` is a plain
 * `(args) => result` function, not a `(prevState, formData)` reducer),
 * and an explicit `router.refresh()` on success even though the action
 * already revalidates server-side — the same belt-and-braces the
 * status actions already rely on.
 *
 * Phase 3C.4B.5C adds the "Generate visual" control alongside review —
 * the explicit human trigger for `generateArticleVisualAction`, the
 * only thing that can cause a real, paid provider request. Approval and
 * generation are two independent transitions that can each be pending
 * or fail on their own, so each gets its own `useTransition` pair and
 * its own error state (`approvalError` / `generationError`) rather than
 * sharing one — a failed approval must never blank out a visible
 * generation error and vice versa, and the "Generating visual…" pending
 * text must never appear on an unrelated Approve click. Generation
 * itself contains no approval logic: a successful generation only ever
 * calls `router.refresh()` so the freshly stored, still-`pending_review`
 * candidate appears from real server state — it is never approved,
 * inserted optimistically, or combined with an approval call.
 *
 * Never calls Supabase directly, never derives a Storage URL itself
 * (every preview uses the already-derived `candidate.publicUrl`), never
 * imports the OpenAI provider or the generation/storage service
 * internals, and never submits anything beyond the four fields
 * `approveArticleVisualAction` accepts or the three fields
 * `generateArticleVisualAction` accepts.
 */
export function ArticleVisualReviewList({
	articleId,
	locale,
	slug,
	candidates,
	articleCoverImageUrl,
	articleCoverImageStatus,
}: {
	articleId: string;
	locale: Locale;
	slug: string;
	candidates: ArticleVisualListItem[];
	articleCoverImageUrl: string | null;
	articleCoverImageStatus: ArticleCoverImageStatus;
}) {
	const [altValues, setAltValues] = useState<Record<string, string>>({});
	// Identifies the exact candidate awaiting confirmation -- never a
	// bare boolean, since more than one pending candidate can exist at
	// once and each needs its own confirmation state.
	const [confirmingVisualId, setConfirmingVisualId] = useState<string | null>(null);
	// Kept separate from generation's own error/pending state below --
	// approving a candidate and generating a new one are independent
	// transitions, and one must never blank out or gate the other's
	// feedback.
	const [approvalError, setApprovalError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	const [generationError, setGenerationError] = useState<string | null>(null);
	const [generationPending, startGenerationTransition] = useTransition();
	// Manual upload's own state, fully independent of approval
	// (approvalError/pending) and generation (generationError/
	// generationPending) above -- a failed upload must never blank out
	// an unrelated approval/generation message, and vice versa, and the
	// "Uploading visual..." pending text must never appear on an
	// unrelated click.
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [uploadAlt, setUploadAlt] = useState("");
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [uploadPending, startUploadTransition] = useTransition();
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	// Deletion's own state (Phase 3C.4B.7A), fully independent of
	// approval/generation/upload above -- a failed delete must never
	// blank out an unrelated approval/generation/upload message, and
	// vice versa. `confirmingDeleteVisualId` is deliberately its own
	// piece of state, never shared with approval's `confirmingVisualId`
	// -- a candidate could otherwise appear to be mid-approval-confirm
	// and mid-delete-confirm at the same time, which would be genuinely
	// ambiguous to render and to reason about.
	const [confirmingDeleteVisualId, setConfirmingDeleteVisualId] = useState<string | null>(null);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [deletePending, startDeleteTransition] = useTransition();
	const router = useRouter();

	const approvedCandidates = candidates.filter((candidate) => candidate.status === "approved");
	const managedActiveCandidate = approvedCandidates.length === 1 ? (approvedCandidates[0] ?? null) : null;

	// Never guessed: only ever true when there's a real contradiction
	// between the managed candidates and the article's own cover state,
	// not merely because a legacy cover happens to be active with no
	// managed candidate at all (that's the ordinary "legacy cover"
	// case below, not an inconsistency).
	const isInconsistent =
		approvedCandidates.length > 1 ||
		(managedActiveCandidate !== null &&
			(articleCoverImageStatus !== "approved" || articleCoverImageUrl !== managedActiveCandidate.publicUrl));

	const hasLegacyActiveCover = approvedCandidates.length === 0 && articleCoverImageStatus === "approved" && Boolean(articleCoverImageUrl);

	// Approving replaces a real, currently-active cover whenever another
	// managed candidate is already approved, OR the article's live
	// cover is currently the legacy manual one -- both count as
	// "replacement" per the locked confirmation rule.
	const requiresConfirmation = approvedCandidates.length > 0 || hasLegacyActiveCover;

	function altValueFor(candidate: ArticleVisualListItem): string {
		return altValues[candidate.id] ?? candidate.altText ?? "";
	}

	function runApprove(candidate: ArticleVisualListItem) {
		setApprovalError(null);
		startTransition(async () => {
			const result = await approveArticleVisualAction({
				articleId,
				visualId: candidate.id,
				altText: altValueFor(candidate),
				locale,
				slug,
			});

			if (!result.ok) {
				// Keep the current list visible, keep the message on
				// screen, and never refresh -- the editor needs to see
				// exactly what went wrong before trying again.
				setApprovalError(result.message);
				setConfirmingVisualId(null);
				return;
			}

			setApprovalError(null);
			setConfirmingVisualId(null);
			// The action already revalidates server-side; this explicit
			// refresh is what actually makes the already-mounted client
			// tree re-read that fresh candidate/article state, matching
			// ArticleStatusActions's existing convention.
			router.refresh();
		});
	}

	function handleApproveClick(candidate: ArticleVisualListItem) {
		if (requiresConfirmation && confirmingVisualId !== candidate.id) {
			setApprovalError(null);
			setConfirmingVisualId(candidate.id);
			return;
		}
		runApprove(candidate);
	}

	// The explicit, human-triggered generation call (Phase 3C.4B.5C).
	// Never approves, never optimistically inserts a fake candidate into
	// `candidates` -- a successful call only clears `generationError` and
	// refreshes, so the newly stored `pending_review` row appears from
	// the same authoritative `listArticleVisuals()` read every other
	// candidate here already comes from. Allowed unconditionally,
	// regardless of how many candidates already exist, whether one is
	// approved, or whether the article itself is published -- nothing
	// here gates on `isInconsistent`, `hasLegacyActiveCover`, or
	// `article.status`.
	function runGenerate() {
		setGenerationError(null);
		startGenerationTransition(async () => {
			const result = await generateArticleVisualAction({ articleId, locale, slug });

			if (!result.ok) {
				// Keep every existing candidate visible, keep the safe
				// service message on screen, and never refresh -- same
				// failure contract as approval above.
				setGenerationError(result.message);
				return;
			}

			setGenerationError(null);
			// Same belt-and-braces refresh as approval: the action already
			// revalidates the edit route server-side, but this is what
			// makes the already-mounted client tree re-read it.
			router.refresh();
		});
	}

	// UX-only guard -- never a security boundary. A file at exactly
	// MAX_UPLOAD_BYTES is allowed through; only a file strictly larger
	// is rejected here, before it ever reaches the network. The Route
	// Handler's call into storeUploadedArticleVisual enforces the real
	// 8 MB ceiling independently, regardless of what happens here.
	function acceptSelectedFile(file: File | null) {
		setUploadError(null);
		if (file && file.size > MAX_UPLOAD_BYTES) {
			setUploadError("This file exceeds the 8 MB maximum asset size. Choose a smaller image.");
			setSelectedFile(null);
			if (fileInputRef.current) fileInputRef.current.value = "";
			return;
		}
		setSelectedFile(file);
	}

	// The explicit, human-triggered manual upload (Phase 3C.4B.6B).
	// Converts the selected File into a multipart/form-data POST to the
	// dedicated Route Handler -- never a Server Action, since this exact
	// Next.js version's default Server Action body-size ceiling (1 MB)
	// is smaller than the existing 8 MB asset contract. The Route
	// Handler is a thin transport adapter only: it never receives a
	// storage path, a public URL, a reviewedBy value, or an
	// approval/status field from here, and this function never
	// optimistically inserts a fake candidate into `candidates` -- a
	// successful upload only clears uploadError, resets the selected
	// file/alt text, and refreshes, so the newly stored `pending_review`
	// row appears from the same authoritative `listArticleVisuals()`
	// read every other candidate here already comes from.
	function runUpload() {
		if (!selectedFile) return;
		setUploadError(null);
		startUploadTransition(async () => {
			const formData = new FormData();
			formData.append("articleId", articleId);
			formData.append("file", selectedFile);
			if (uploadAlt.trim()) {
				formData.append("altText", uploadAlt);
			}

			let response: Response;
			try {
				response = await fetch("/api/admin/article-visuals/upload", { method: "POST", body: formData });
			} catch {
				setUploadError("Could not reach the server. Check your connection and try again.");
				return;
			}

			let result: { ok: boolean; message?: string } | null = null;
			try {
				result = await response.json();
			} catch {
				// fall through -- result stays null, handled below.
			}

			if (!result || !result.ok) {
				// Keep the selected file and proposed alt text in place so
				// the editor can retry without re-choosing the file, keep
				// every existing candidate visible, and never refresh --
				// same failure contract as approval and generation above.
				setUploadError(result?.message ?? "Could not upload this image.");
				return;
			}

			setUploadError(null);
			setSelectedFile(null);
			setUploadAlt("");
			if (fileInputRef.current) fileInputRef.current.value = "";
			// Same belt-and-braces refresh as approval/generation: the
			// route already revalidates the edit path server-side, but
			// this is what makes the already-mounted client tree re-read
			// it. No optimistic candidate is ever inserted here.
			router.refresh();
		});
	}

	// The explicit, human-triggered manual deletion (Phase 3C.4B.7A).
	// Deletion is always destructive and always requires explicit
	// confirmation -- unlike approval, this is unconditional, never
	// gated behind a `requiresConfirmation`-style computed flag. Never
	// optimistically removes `candidate` from local state -- a
	// successful delete only clears deleteError, closes the
	// confirmation box, and refreshes, so the candidate's real absence
	// is observed from the same authoritative `listArticleVisuals()`
	// read every other candidate here already comes from. Never sends
	// a storage path, public URL, provider id, reviewedBy, or
	// status/approved field -- only the same
	// `{ articleId, visualId, locale, slug }` shape
	// `approveArticleVisualAction` already uses.
	function runDelete(candidate: ArticleVisualListItem) {
		setDeleteError(null);
		startDeleteTransition(async () => {
			const result = await deleteArticleVisualAction({
				articleId,
				visualId: candidate.id,
				locale,
				slug,
			});

			if (!result.ok) {
				// Keep the current list visible (every candidate,
				// including this one, since it was never removed
				// optimistically), keep the message on screen, and never
				// refresh -- same failure contract as approval/
				// generation/upload above.
				setDeleteError(result.message);
				setConfirmingDeleteVisualId(null);
				return;
			}

			setDeleteError(null);
			setConfirmingDeleteVisualId(null);
			// Same belt-and-braces refresh as approval/generation/upload:
			// the action already revalidates the edit route server-side,
			// but this is what makes the already-mounted client tree
			// re-read it.
			router.refresh();
		});
	}

	function handleDeleteClick(candidate: ArticleVisualListItem) {
		if (confirmingDeleteVisualId !== candidate.id) {
			setDeleteError(null);
			setConfirmingDeleteVisualId(candidate.id);
			return;
		}
		runDelete(candidate);
	}

	return (
		<div className={styles.panel}>
			<p className={styles.label}>Article visual</p>

			{approvalError ? (
				<p className={styles.banner} role="alert">
					{approvalError}
				</p>
			) : null}

			{isInconsistent ? (
				<p className={styles.banner} role="alert">
					The active cover state is inconsistent. Refresh the page before making further visual changes.
				</p>
			) : null}

			{hasLegacyActiveCover ? (
				<p className={styles.note}>
					This article&apos;s live cover currently comes from the manual Cover image URL field below, not a reviewed visual candidate.
				</p>
			) : null}

			<div className={styles.generateRow}>
				<button type="button" className="btn btn-ghost" disabled={generationPending} onClick={runGenerate}>
					{generationPending ? "Generating visual…" : "Generate visual"}
				</button>
				<p className={styles.generateNote}>Generates one new visual candidate for review.</p>
			</div>

			{generationPending ? (
				<p className={styles.generatingStatus} role="status">
					Generating visual… this can take up to about a minute.
				</p>
			) : null}

			{generationError ? (
				<p className={styles.banner} role="alert">
					{generationError}
				</p>
			) : null}

			<div className={styles.uploadRow}>
				<div className="field">
					<label htmlFor="visual-upload-file">Upload visual</label>
					<input
						id="visual-upload-file"
						ref={fileInputRef}
						type="file"
						accept={ACCEPTED_UPLOAD_MIME_TYPES}
						disabled={uploadPending}
						onChange={(event) => acceptSelectedFile(event.target.files?.[0] ?? null)}
					/>
				</div>

				<div className="field">
					<label htmlFor="visual-upload-alt">Proposed alt text (optional)</label>
					<input
						id="visual-upload-alt"
						type="text"
						value={uploadAlt}
						disabled={uploadPending}
						onChange={(event) => setUploadAlt(event.target.value)}
					/>
				</div>

				<button type="button" className="btn btn-ghost" disabled={uploadPending || !selectedFile} onClick={runUpload}>
					{uploadPending ? "Uploading visual…" : "Upload visual"}
				</button>

				<p className={styles.generateNote}>PNG, JPEG or WebP, up to 8 MB. Creates a new candidate for review.</p>
			</div>

			{uploadPending ? (
				<p className={styles.generatingStatus} role="status">
					Uploading visual…
				</p>
			) : null}

			{uploadError ? (
				<p className={styles.banner} role="alert">
					{uploadError}
				</p>
			) : null}

			{deleteError ? (
				<p className={styles.banner} role="alert">
					{deleteError}
				</p>
			) : null}

			{candidates.length === 0 ? (
				<p className={styles.empty}>No visual candidates yet.</p>
			) : (
				<div className={styles.grid}>
					{candidates.map((candidate) => {
						const isActive = !isInconsistent && candidate.status === "approved";
						const isPending = candidate.status === "pending_review";
						const isConfirming = confirmingVisualId === candidate.id;
						// Locked rule (Phase 3C.4B.7A): only pending_review or
						// superseded candidates are ever deletable -- an
						// approved candidate (the article's live cover, or a
						// candidate otherwise claiming that status) is never
						// deletable in this phase, full stop. Deliberately
						// checked against candidate.status alone, never
						// against isActive/source_type -- a generated and an
						// uploaded candidate follow the identical rule.
						const isDeletable = candidate.status === "pending_review" || candidate.status === "superseded";
						const isConfirmingDelete = confirmingDeleteVisualId === candidate.id;

						return (
							<div key={candidate.id} className={styles.card} data-status={candidate.status}>
								{/* eslint-disable-next-line @next/next/no-img-element -- server-derived Supabase Storage public URL, not eligible for next/image without additional remote-pattern config (Phase 3C.4B.4B design report, section 8) */}
								<img src={candidate.publicUrl} alt="" className={styles.preview} />

								<div className={styles.meta}>
									<div className={styles.statusRow}>
										<span className={styles.statusBadge} data-status={candidate.status}>
											{STATUS_LABEL[candidate.status]}
										</span>
										{isActive ? <span className={styles.activeTag}>Active cover</span> : null}
									</div>

									{isPending ? (
										<div className="field">
											<label htmlFor={`visual-alt-${candidate.id}`}>Alt text</label>
											<input
												id={`visual-alt-${candidate.id}`}
												type="text"
												value={altValueFor(candidate)}
												onChange={(event) => {
													const { value } = event.target;
													setAltValues((prev) => ({ ...prev, [candidate.id]: value }));
												}}
											/>
										</div>
									) : (
										<p className={styles.altReadOnly}>{candidate.altText ?? "No alt text set."}</p>
									)}

									{isPending ? (
										isConfirming ? (
											<div className={styles.confirmBox}>
												<p>Approving this will replace the current active cover.</p>
												<div className={styles.confirmActions}>
													<button type="button" className="btn btn-primary" disabled={pending} onClick={() => runApprove(candidate)}>
														{pending ? "Working…" : "Confirm"}
													</button>
													<button type="button" className="btn btn-ghost" disabled={pending} onClick={() => setConfirmingVisualId(null)}>
														Cancel
													</button>
												</div>
											</div>
										) : (
											<button
												type="button"
												className="btn btn-primary"
												disabled={pending || isInconsistent}
												onClick={() => handleApproveClick(candidate)}
											>
												{pending ? "Working…" : "Approve visual"}
											</button>
										)
									) : null}

									{isDeletable ? (
										isConfirmingDelete ? (
											<div className={styles.confirmBox}>
												<p>Delete this visual candidate? This removes the stored image and cannot be undone.</p>
												<div className={styles.confirmActions}>
													<button
														type="button"
														className="btn btn-primary"
														disabled={deletePending}
														onClick={() => runDelete(candidate)}
													>
														{deletePending ? "Deleting…" : "Delete"}
													</button>
													<button
														type="button"
														className="btn btn-ghost"
														disabled={deletePending}
														onClick={() => setConfirmingDeleteVisualId(null)}
													>
														Cancel
													</button>
												</div>
											</div>
										) : (
											<button type="button" className="btn btn-ghost" onClick={() => handleDeleteClick(candidate)}>
												Delete visual
											</button>
										)
									) : null}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
