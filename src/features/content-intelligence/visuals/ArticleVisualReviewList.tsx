"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveArticleVisualAction } from "@/lib/actions/insightsCms";
import type { ArticleVisualListItem } from "./articleVisualQueries";
import type { ArticleCoverImageStatus } from "@/features/insights/types/article";
import type { Locale } from "@/lib/routes";
import styles from "./ArticleVisualReviewPanel.module.css";

const STATUS_LABEL: Record<ArticleVisualListItem["status"], string> = {
	pending_review: "Pending review",
	approved: "Approved",
	superseded: "Superseded",
};

/**
 * Phase 3C.4B.4B — owns every interactive part of visual review: the
 * per-candidate editable alt text, the approval transition, inline
 * replacement confirmation, and error feedback. Mirrors
 * `ArticleStatusActions`'s shape deliberately: `useTransition` (not
 * `useActionState`, since `approveArticleVisualAction` is a plain
 * `(args) => result` function, not a `(prevState, formData)` reducer),
 * a single pending flag, and an explicit `router.refresh()` on success
 * even though the action already revalidates server-side — the same
 * belt-and-braces the status actions already rely on.
 *
 * Never calls Supabase directly, never derives a Storage URL itself
 * (every preview uses the already-derived `candidate.publicUrl`), and
 * never submits anything beyond the four fields
 * `approveArticleVisualAction` actually accepts.
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
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
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
		setError(null);
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
				setError(result.message);
				setConfirmingVisualId(null);
				return;
			}

			setError(null);
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
			setError(null);
			setConfirmingVisualId(candidate.id);
			return;
		}
		runApprove(candidate);
	}

	return (
		<div className={styles.panel}>
			<p className={styles.label}>Article visual</p>

			{error ? (
				<p className={styles.banner} role="alert">
					{error}
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

			{candidates.length === 0 ? (
				<p className={styles.empty}>No visual candidates yet.</p>
			) : (
				<div className={styles.grid}>
					{candidates.map((candidate) => {
						const isActive = !isInconsistent && candidate.status === "approved";
						const isPending = candidate.status === "pending_review";
						const isConfirming = confirmingVisualId === candidate.id;

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
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
