"use client";

import { useEffect, useRef } from "react";
import type { MouseEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";

const CLOSE_ICON = (
	<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
		<path d="M6 6l12 12M18 6L6 18" />
	</svg>
);

/**
 * Premium case-study overlay rendered by the intercepted `(.)[slug]`
 * routes (see `src/app/work/@modal/` and its PL equivalent). Closing
 * always goes through `router.back()` so the URL returns to `/work` (or
 * `/pl/realizacje`) the same way it got here - a direct visit to
 * `/work/[slug]` never reaches this component at all (Next.js only
 * resolves intercepting routes on a client-side navigation), so the
 * standalone case-study page is what search engines and shared links
 * always see.
 */
export function CaseStudyModal({
	children,
	closeLabel,
}: {
	children: ReactNode;
	closeLabel: string;
}) {
	const router = useRouter();
	const dialogRef = useRef<HTMLDivElement>(null);

	function close() {
		router.back();
	}

	function onBackdropClick(e: MouseEvent<HTMLDivElement>) {
		if (e.target === e.currentTarget) close();
	}

	useEffect(() => {
		const previouslyFocused = document.activeElement as HTMLElement | null;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		dialogRef.current?.focus();

		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") {
				e.preventDefault();
				close();
				return;
			}
			if (e.key !== "Tab") return;

			const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
			);
			if (!focusable || focusable.length === 0) return;
			const list = Array.from(focusable);
			const first = list[0]!;
			const last = list[list.length - 1]!;

			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}

		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			document.body.style.overflow = previousOverflow;
			previouslyFocused?.focus();
		};
		// Mount-only: this modal instance lives for exactly one intercepted
		// route render, so re-running on every render would keep re-locking
		// scroll and re-stealing focus from whatever the user just clicked.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<div className="case-modal-overlay" onClick={onBackdropClick}>
			<div className="case-modal" role="dialog" aria-modal="true" ref={dialogRef} tabIndex={-1}>
				<button type="button" className="case-modal-close" onClick={close} aria-label={closeLabel}>
					{CLOSE_ICON}
				</button>
				<div className="case-modal-scroll">{children}</div>
			</div>
		</div>
	);
}
