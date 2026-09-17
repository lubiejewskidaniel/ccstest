"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/routes";
import { events, getBaseContext } from "@/lib/analytics";
import styles from "./ArticleShare.module.css";

/**
 * Premium article-sharing section, rendered between the article content
 * and the existing "Have a similar problem to solve?" CTA (see
 * `ArticlePage.tsx`). Presentation only -- never touches article content,
 * SEO metadata, or the publication pipeline. `url` is the article's own
 * absolute canonical URL, computed by the caller via the existing
 * `articleUrl()` helper (`seo/paths.ts`) -- this component never builds
 * or guesses a URL itself.
 *
 * Standard web share intents only (LinkedIn/Facebook/X) -- no SDK, no
 * app id, no third-party script. Copy link uses the Clipboard API with a
 * dependency-free fallback for browsers/contexts where it's unavailable.
 */

export type ArticleShareChannel = "linkedin" | "facebook" | "x" | "copy";

/** Pure share-target URL builders -- directly testable without rendering
 * the component. Each is a plain web share intent; none requires a
 * client id, SDK, or app registration. */
export function buildShareUrl(channel: "linkedin" | "facebook" | "x", url: string): string {
	const encoded = encodeURIComponent(url);
	switch (channel) {
		case "linkedin":
			return `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`;
		case "facebook":
			return `https://www.facebook.com/sharer/sharer.php?u=${encoded}`;
		case "x":
			return `https://twitter.com/intent/tweet?url=${encoded}`;
	}
}

/**
 * Copies `text` to the clipboard, preferring the async Clipboard API and
 * falling back to the classic `execCommand("copy")` technique when the
 * API is unavailable (e.g. a non-secure context) or it rejects. Never
 * throws -- returns whether the copy actually succeeded, so the caller
 * can decide what to show without ever calling `alert()`.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
	if (typeof navigator !== "undefined" && navigator.clipboard && typeof window !== "undefined" && window.isSecureContext) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			// Fall through to the legacy fallback below.
		}
	}
	return legacyCopyFallback(text);
}

/** Classic, dependency-free clipboard fallback: a temporary, invisible,
 * off-screen textarea selected and copied via `execCommand`. Deprecated
 * but still the standard no-dependency fallback for environments without
 * the async Clipboard API. Removes the textarea in every case. */
function legacyCopyFallback(text: string): boolean {
	if (typeof document === "undefined") return false;

	const textarea = document.createElement("textarea");
	textarea.value = text;
	textarea.setAttribute("readonly", "");
	textarea.style.position = "fixed";
	textarea.style.top = "0";
	textarea.style.left = "0";
	textarea.style.opacity = "0";
	textarea.style.pointerEvents = "none";
	document.body.appendChild(textarea);
	textarea.select();
	textarea.setSelectionRange(0, textarea.value.length);

	let succeeded = false;
	try {
		succeeded = document.execCommand("copy");
	} catch {
		succeeded = false;
	} finally {
		document.body.removeChild(textarea);
	}
	return succeeded;
}

const COPIED_LABEL_DURATION_MS = 2000;

const COPY: Record<Locale, { heading: string; linkedin: string; facebook: string; x: string; copy: string; copied: string }> = {
	en: {
		heading: "Share this insight",
		linkedin: "LinkedIn",
		facebook: "Facebook",
		x: "X",
		copy: "Copy link",
		copied: "Copied",
	},
	pl: {
		heading: "Udostępnij artykuł",
		linkedin: "LinkedIn",
		facebook: "Facebook",
		x: "X",
		copy: "Kopiuj link",
		copied: "Skopiowano",
	},
};

function LinkedInIcon() {
	return (
		<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
			<path d="M6.94 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM3.28 8.75h3.32V21H3.28V8.75zM9.5 8.75h3.18v1.68h.05c.44-.83 1.52-1.7 3.13-1.7 3.35 0 3.97 2.2 3.97 5.07V21h-3.31v-5.6c0-1.34-.02-3.06-1.87-3.06-1.87 0-2.16 1.46-2.16 2.96V21H9.5V8.75z" />
		</svg>
	);
}

function FacebookIcon() {
	return (
		<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
			<path d="M13.9 21v-8.2h2.75l.41-3.2h-3.16V7.5c0-.93.26-1.56 1.59-1.56h1.7V3.1C16.9 3.05 15.9 3 14.75 3c-2.4 0-4.05 1.47-4.05 4.16v2.44H8v3.2h2.7V21h3.2z" />
		</svg>
	);
}

function XIcon() {
	return (
		<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
			<path d="M18.24 3h2.6l-5.68 6.49L21.8 21h-5.23l-4.1-5.36L7.76 21H5.15l6.08-6.95L4 3h5.36l3.7 4.9L18.24 3zm-.91 16.2h1.44L7.72 4.72H6.18L17.33 19.2z" />
		</svg>
	);
}

function CopyIcon() {
	return (
		<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
			<rect x="8" y="8" width="12" height="12" rx="2" />
			<path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
		</svg>
	);
}

function CheckIcon() {
	return (
		<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
			<path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

export function ArticleShare({ slug, locale, url }: { slug: string; locale: Locale; url: string }) {
	const pathname = usePathname();
	const [copied, setCopied] = useState(false);
	const resetTimer = useRef<number | null>(null);

	useEffect(() => {
		return () => {
			if (resetTimer.current) window.clearTimeout(resetTimer.current);
		};
	}, []);

	function track(channel: ArticleShareChannel) {
		events.articleShare(slug, channel, getBaseContext(pathname));
	}

	async function handleCopy() {
		track("copy");
		const succeeded = await copyTextToClipboard(url);
		if (!succeeded) return;

		setCopied(true);
		if (resetTimer.current) window.clearTimeout(resetTimer.current);
		resetTimer.current = window.setTimeout(() => setCopied(false), COPIED_LABEL_DURATION_MS);
	}

	const copy = COPY[locale];

	return (
		<section className={styles.share} aria-labelledby="article-share-heading">
			<div className={styles.divider}>
				<span className={styles.dividerLine} aria-hidden="true" />
				<h2 id="article-share-heading" className={styles.label}>
					{copy.heading}
				</h2>
				<span className={styles.dividerLine} aria-hidden="true" />
			</div>

			<div className={styles.actions}>
				<a
					href={buildShareUrl("linkedin", url)}
					target="_blank"
					rel="noopener noreferrer"
					className={styles.action}
					onClick={() => track("linkedin")}
				>
					<LinkedInIcon />
					{copy.linkedin}
				</a>
				<a
					href={buildShareUrl("facebook", url)}
					target="_blank"
					rel="noopener noreferrer"
					className={styles.action}
					onClick={() => track("facebook")}
				>
					<FacebookIcon />
					{copy.facebook}
				</a>
				<a
					href={buildShareUrl("x", url)}
					target="_blank"
					rel="noopener noreferrer"
					className={styles.action}
					onClick={() => track("x")}
				>
					<XIcon />
					{copy.x}
				</a>
				<button type="button" className={styles.action} onClick={handleCopy} aria-live="polite">
					{copied ? <CheckIcon /> : <CopyIcon />}
					{copied ? copy.copied : copy.copy}
				</button>
			</div>
		</section>
	);
}
