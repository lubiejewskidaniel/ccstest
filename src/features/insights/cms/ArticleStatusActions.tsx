"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setArticleStatusAction } from "@/lib/actions/insightsCms";
import { scheduleAtNextSlotAction } from "@/lib/actions/scheduler";
import type { Article, ArticleStatus } from "../types/article";
import type { Locale } from "@/lib/routes";
import styles from "./ArticleStatusActions.module.css";

const STATUS_LABEL: Record<ArticleStatus, string> = {
	draft: "Draft",
	in_review: "In review",
	scheduled: "Scheduled",
	published: "Published",
	archived: "Archived",
};

/**
 * Publish / schedule / archive / back-to-draft — separate from the main
 * editor form (`ArticleEditorForm`) so changing lifecycle state doesn't
 * require resubmitting the whole article, and so a status mistake can't
 * accidentally happen as a side effect of an unrelated content edit
 * (see the hidden-field note in `ArticleEditorForm.tsx`).
 */
export function ArticleStatusActions({ article, locale }: { article: Article; locale: Locale }) {
	const [scheduledAt, setScheduledAt] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	const router = useRouter();

	function run(status: ArticleStatus, isoScheduledAt?: string) {
		setError(null);
		startTransition(async () => {
			const result = await setArticleStatusAction(
				{ id: article.id, locale, slug: article.slug },
				status,
				isoScheduledAt,
			);
			if (!result.ok) {
				setError(
					result.kind === "validation"
						? (Object.values(result.fieldErrors)[0] ?? "Validation error.")
						: result.message,
				);
				return;
			}
			router.refresh();
		});
	}

	function runNextSlot() {
		setError(null);
		startTransition(async () => {
			const result = await scheduleAtNextSlotAction({ id: article.id, locale, slug: article.slug });
			if (!result.ok) {
				setError(
					result.kind === "validation"
						? (Object.values(result.fieldErrors)[0] ?? "Validation error.")
						: result.message,
				);
				return;
			}
			router.refresh();
		});
	}

	return (
		<div className={styles.panel}>
			<div className={styles.statusRow}>
				<span className={styles.label}>Status</span>
				<span className={styles.badge} data-status={article.status}>
					{STATUS_LABEL[article.status]}
				</span>
			</div>

			{error ? <p className={styles.error}>{error}</p> : null}

			<div className={styles.actions}>
				{article.status !== "published" ? (
					<button type="button" className="btn btn-primary" disabled={pending} onClick={() => run("published")}>
						Publish now
					</button>
				) : null}

				{article.status !== "archived" ? (
					<button type="button" className="btn btn-ghost" disabled={pending} onClick={() => run("archived")}>
						Archive
					</button>
				) : null}

				{article.status !== "draft" ? (
					<button type="button" className="btn btn-ghost" disabled={pending} onClick={() => run("draft")}>
						Back to draft
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
					onClick={() => run("scheduled", new Date(scheduledAt).toISOString())}
				>
					Schedule for this time
				</button>
				<button type="button" className="btn btn-ghost" disabled={pending} onClick={runNextSlot}>
					Schedule for next slot
				</button>
			</div>
		</div>
	);
}
