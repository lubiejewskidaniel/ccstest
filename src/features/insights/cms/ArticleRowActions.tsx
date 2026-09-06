"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setArticleStatusAction, deleteArticleAction } from "@/lib/actions/insightsCms";
import { articlePath } from "../seo/paths";
import type { ArticleStatus } from "../types/article";
import type { Locale } from "@/lib/routes";
import styles from "./ArticleRowActions.module.css";

type PendingConfirm = "publish" | "archive" | "delete" | null;
type MenuPosition = { top: number; right: number };

/**
 * The list's compact "⋯" menu — one-click, no-extra-input actions only
 * (publish/archive/restore). Scheduling a specific date/time and the full
 * editor stay on the edit page (`ArticleStatusActions`), so there is
 * exactly one place that owns the date picker rather than a second,
 * smaller copy living here too.
 *
 * "Preview" opens the article's normal public URL in a new tab — an
 * authenticated editor session can already see any status there (RLS's
 * "editor select all" policy), so this needs no separate preview route.
 *
 * Publish/Archive/Delete all go through the same inline confirm step
 * (only one shown at a time via `confirm`) rather than firing
 * immediately — Archive is only ever shown here when the article is
 * currently `published`, so every archive from this menu genuinely does
 * remove a live article.
 *
 * The menu itself renders through a portal into `document.body`,
 * positioned with `position: fixed` from the trigger button's own
 * bounding rect. The row lives inside the article table's horizontal
 * scroll wrapper (`overflow-x: auto` on the admin list page), which also
 * clips vertical overflow — an absolutely-positioned menu nested inside
 * that wrapper was getting cut off instead of floating above the page.
 * Fixed positioning via a portal escapes that ancestor's overflow
 * entirely, which a CSS-only fix on this component couldn't do without
 * changing the table wrapper's scroll behavior itself.
 */
export function ArticleRowActions({
	id,
	locale,
	slug,
	status,
	isAdmin,
}: {
	id: string;
	locale: Locale;
	slug: string;
	status: ArticleStatus;
	isAdmin: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [position, setPosition] = useState<MenuPosition | null>(null);
	const [confirm, setConfirm] = useState<PendingConfirm>(null);
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	const router = useRouter();
	const triggerRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);

	function openMenu() {
		const rect = triggerRef.current?.getBoundingClientRect();
		if (!rect) return;
		setPosition({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
		setOpen(true);
		setConfirm(null);
	}

	function closeMenu() {
		setOpen(false);
		setConfirm(null);
	}

	useEffect(() => {
		if (!open) return;

		function onOutside(event: MouseEvent) {
			const target = event.target as Node;
			if (triggerRef.current?.contains(target)) return;
			if (menuRef.current?.contains(target)) return;
			closeMenu();
		}
		function onEscape(event: KeyboardEvent) {
			if (event.key === "Escape") closeMenu();
		}
		// The menu is fixed-positioned from a rect captured at open time -
		// closing on scroll (capture: true catches scrolling inside the
		// table's own wrapper, not just the window) avoids it visually
		// drifting away from the button it belongs to.
		function onScroll() {
			closeMenu();
		}

		document.addEventListener("mousedown", onOutside);
		document.addEventListener("keydown", onEscape);
		document.addEventListener("scroll", onScroll, true);
		return () => {
			document.removeEventListener("mousedown", onOutside);
			document.removeEventListener("keydown", onEscape);
			document.removeEventListener("scroll", onScroll, true);
		};
	}, [open]);

	function runStatus(next: ArticleStatus) {
		setError(null);
		startTransition(async () => {
			const result = await setArticleStatusAction({ id, locale, slug }, next);
			if (!result.ok) {
				setError(result.kind === "validation" ? (Object.values(result.fieldErrors)[0] ?? "Couldn't update status.") : result.message);
				return;
			}
			closeMenu();
			router.refresh();
		});
	}

	function runDelete() {
		setError(null);
		startTransition(async () => {
			const result = await deleteArticleAction({ id, locale, slug });
			if (!result.ok) {
				setError(result.kind === "validation" ? (Object.values(result.fieldErrors)[0] ?? "Couldn't delete.") : result.message);
				return;
			}
			router.refresh();
		});
	}

	return (
		<div className={styles.root}>
			<button
				ref={triggerRef}
				type="button"
				className={styles.trigger}
				aria-haspopup="menu"
				aria-expanded={open}
				aria-label="Article actions"
				onClick={() => (open ? closeMenu() : openMenu())}
			>
				⋯
			</button>

			{open && position
				? createPortal(
						<div ref={menuRef} className={styles.menu} role="menu" style={{ position: "fixed", top: position.top, right: position.right }}>
							{confirm ? (
								<div className={styles.confirmRow}>
									<span>
										{confirm === "publish" ? "Publish this now?" : confirm === "archive" ? "Archive this live article?" : "Delete permanently?"}
									</span>
									<button
										type="button"
										className={confirm === "delete" ? styles.confirmYes : styles.confirmYesNeutral}
										disabled={pending}
										onClick={() => (confirm === "publish" ? runStatus("published") : confirm === "archive" ? runStatus("archived") : runDelete())}
									>
										{pending ? "Working…" : "Yes"}
									</button>
									<button type="button" className={styles.confirmNo} onClick={() => setConfirm(null)}>
										Cancel
									</button>
								</div>
							) : (
								<>
									<Link href={`/admin/insights/${id}/edit`} className={styles.item} role="menuitem">
										Edit
									</Link>
									<Link
										href={status === "published" ? articlePath(slug, locale) : `/admin/insights/${id}/preview`}
										target="_blank"
										rel="noopener noreferrer"
										className={styles.item}
										role="menuitem"
									>
										Preview
									</Link>

									<div className={styles.divider} />

									{status !== "published" ? (
										<button type="button" className={styles.item} role="menuitem" disabled={pending} onClick={() => setConfirm("publish")}>
											Publish now
										</button>
									) : null}

									{status === "draft" || status === "in_review" ? (
										<Link href={`/admin/insights/${id}/edit#schedule`} className={styles.item} role="menuitem">
											Schedule…
										</Link>
									) : null}

									{status === "published" ? (
										<button type="button" className={styles.item} role="menuitem" disabled={pending} onClick={() => setConfirm("archive")}>
											Archive
										</button>
									) : null}

									{status === "archived" ? (
										<button type="button" className={styles.item} role="menuitem" disabled={pending} onClick={() => runStatus("draft")}>
											Restore to draft
										</button>
									) : null}

									{isAdmin ? (
										<>
											<div className={styles.divider} />
											<button type="button" className={styles.itemDanger} role="menuitem" onClick={() => setConfirm("delete")}>
												Delete…
											</button>
										</>
									) : null}
								</>
							)}

							{error ? <p className={styles.error}>{error}</p> : null}
						</div>,
						document.body,
					)
				: null}
		</div>
	);
}
