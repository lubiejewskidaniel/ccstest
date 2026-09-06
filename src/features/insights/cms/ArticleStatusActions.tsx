"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setArticleStatusAction, deleteArticleAction } from "@/lib/actions/insightsCms";
import { previewNextPublishSlotAction } from "@/lib/actions/scheduler";
import { articlePath } from "../seo/paths";
import type { Article, ArticleStatus } from "../types/article";
import type { Locale } from "@/lib/routes";
import { StatusBadge } from "./StatusBadge";
import styles from "./ArticleStatusActions.module.css";

/** Formats an ISO instant the way an editor actually needs to read it:
 * their own local wall-clock time, with the timezone name/offset spelled
 * out explicitly rather than left implicit — a `datetime-local` input
 * silently means "your browser's local time" with no on-screen label, so
 * saying so is the one thing standing between a schedule that means what
 * it looks like and one that quietly doesn't. */
function formatScheduleMoment(iso: string): string {
	const date = new Date(iso);
	const local = new Intl.DateTimeFormat(undefined, {
		weekday: "short",
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		timeZoneName: "short",
	}).format(date);
	const utc = date.toISOString().slice(0, 16).replace("T", " ");
	return `${local} (UTC: ${utc})`;
}

type PendingConfirm =
	| { kind: "publish" }
	| { kind: "archive" }
	| { kind: "delete" }
	| { kind: "scheduleThis"; iso: string }
	| { kind: "scheduleNext"; iso: string };

/**
 * Publish / schedule / archive / restore / delete — kept as its own
 * panel, separate from the content-editing form (`ArticleEditorForm`)
 * below it, so publication state can never change as a side effect of
 * saving unrelated content edits (see the hidden-field note in
 * `ArticleEditorForm.tsx`). "Save changes" in that form only ever
 * touches content; every state transition lives here instead.
 *
 * Every action that changes what the public can see, or is irreversible,
 * goes through the same one-at-a-time `confirm` state below rather than
 * firing immediately — Publish/Archive/Schedule get a plain confirmation
 * showing exactly what will happen; Delete keeps its already-red,
 * clearly-labelled confirmation (the strongest of the group, since it's
 * the only one that can't be undone from this UI at all). None of this
 * touches the scheduling backend itself (`transitionArticleStatus`,
 * `getNextPublishSlot`) — it only adds a confirmation step in front of
 * calls that already existed.
 */
export function ArticleStatusActions({ article, locale, isAdmin }: { article: Article; locale: Locale; isAdmin: boolean }) {
	const [scheduledAt, setScheduledAt] = useState("");
	const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
	const [previewing, setPreviewing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	const router = useRouter();

	function runStatus(status: ArticleStatus, isoScheduledAt?: string) {
		setError(null);
		startTransition(async () => {
			const result = await setArticleStatusAction({ id: article.id, locale, slug: article.slug }, status, isoScheduledAt);
			if (!result.ok) {
				setError(result.kind === "validation" ? (Object.values(result.fieldErrors)[0] ?? "Validation error.") : result.message);
				return;
			}
			setConfirm(null);
			router.refresh();
		});
	}

	function runDelete() {
		setError(null);
		startTransition(async () => {
			const result = await deleteArticleAction({ id: article.id, locale, slug: article.slug });
			if (!result.ok) {
				setError(result.kind === "validation" ? (Object.values(result.fieldErrors)[0] ?? "Couldn't delete.") : result.message);
				return;
			}
			router.push("/admin/insights");
		});
	}

	async function openNextSlotPreview() {
		setError(null);
		setPreviewing(true);
		try {
			const iso = await previewNextPublishSlotAction();
			setConfirm({ kind: "scheduleNext", iso });
		} catch {
			setError("Couldn't compute the next slot. Please try again.");
		} finally {
			setPreviewing(false);
		}
	}

	return (
		<div className={styles.panel} id="schedule">
			<div className={styles.statusRow}>
				<span className={styles.label}>Publication</span>
				<StatusBadge status={article.status} />
				<Link
					href={article.status === "published" ? articlePath(article.slug, locale) : `/admin/insights/${article.id}/preview`}
					target="_blank"
					rel="noopener noreferrer"
					className={styles.previewLink}
				>
					Preview ↗
				</Link>
			</div>

			{error ? <p className={styles.error}>{error}</p> : null}

			{confirm && confirm.kind !== "delete" ? (
				<div className={styles.confirmBox}>
					{confirm.kind === "publish" ? <p>Publish this article now? It will immediately become visible to everyone.</p> : null}
					{confirm.kind === "archive" ? (
						<p>Archive this article? It is currently live — archiving removes it from public view immediately.</p>
					) : null}
					{confirm.kind === "scheduleThis" || confirm.kind === "scheduleNext" ? (
						<p>
							Schedule this article to publish automatically at:
							<br />
							<strong>{formatScheduleMoment(confirm.iso)}</strong>
						</p>
					) : null}
					<div className={styles.confirmActions}>
						<button
							type="button"
							className="btn btn-primary"
							disabled={pending}
							onClick={() => {
								if (confirm.kind === "publish") runStatus("published");
								else if (confirm.kind === "archive") runStatus("archived");
								// scheduleThis and scheduleNext both apply the exact
								// previewed ISO instant directly - re-computing "next
								// slot" again at confirm time (instead of reusing the
								// one just shown) could resolve to a different moment
								// than what the editor just confirmed.
								else runStatus("scheduled", confirm.iso);
							}}
						>
							{pending ? "Working…" : "Confirm"}
						</button>
						<button type="button" className="btn btn-ghost" disabled={pending} onClick={() => setConfirm(null)}>
							Cancel
						</button>
					</div>
				</div>
			) : (
				<>
					<div className={styles.actions}>
						{article.status !== "published" ? (
							<button type="button" className="btn btn-primary" disabled={pending} onClick={() => setConfirm({ kind: "publish" })}>
								Publish now
							</button>
						) : null}

						{article.status !== "archived" ? (
							<button
								type="button"
								className="btn btn-ghost"
								disabled={pending}
								onClick={() => (article.status === "published" ? setConfirm({ kind: "archive" }) : runStatus("archived"))}
							>
								Archive
							</button>
						) : null}

						{article.status !== "draft" ? (
							<button type="button" className="btn btn-ghost" disabled={pending} onClick={() => runStatus("draft")}>
								{article.status === "archived" ? "Restore" : "Back to draft"}
							</button>
						) : null}
					</div>

					<div className={styles.scheduleRow}>
						<input
							type="datetime-local"
							value={scheduledAt}
							onChange={(event) => setScheduledAt(event.target.value)}
							className={styles.scheduleInput}
							aria-label="Schedule date and time"
						/>
						<button
							type="button"
							className="btn btn-ghost"
							disabled={pending || !scheduledAt}
							onClick={() => setConfirm({ kind: "scheduleThis", iso: new Date(scheduledAt).toISOString() })}
						>
							Schedule for this time
						</button>
						<button type="button" className="btn btn-ghost" disabled={pending || previewing} onClick={openNextSlotPreview}>
							{previewing ? "Calculating…" : "Schedule for next slot"}
						</button>
					</div>
				</>
			)}

			{isAdmin ? (
				<div className={styles.dangerRow}>
					{confirm?.kind === "delete" ? (
						<>
							<span className={styles.dangerLabel}>Delete this article permanently? This cannot be undone.</span>
							<button type="button" className="btn btn-ghost" disabled={pending} onClick={runDelete}>
								{pending ? "Deleting…" : "Yes, delete"}
							</button>
							<button type="button" className="btn btn-ghost" onClick={() => setConfirm(null)}>
								Cancel
							</button>
						</>
					) : (
						<button type="button" className={styles.deleteTrigger} onClick={() => setConfirm({ kind: "delete" })}>
							Delete article…
						</button>
					)}
				</div>
			) : null}
		</div>
	);
}
