"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { events, getBaseContext } from "@/lib/analytics";

const THRESHOLDS = [25, 50, 75, 100] as const;

/**
 * Fires `article_read_progress` once per threshold as the visitor
 * scrolls through the article body (master instruction Checkpoint 5
 * "engagement"). A plain scroll listener with a passive flag and a
 * throttling ref — no IntersectionObserver needed since this only cares
 * about overall scroll depth, not any specific element's visibility.
 */
export function ReadProgressTracker({ slug }: { slug: string }) {
	const pathname = usePathname();
	const firedRef = useRef<Set<number>>(new Set());
	const tickingRef = useRef(false);

	useEffect(() => {
		function computeDepthPercent(): number {
			const doc = document.documentElement;
			const scrollable = doc.scrollHeight - doc.clientHeight;
			if (scrollable <= 0) return 100; // page shorter than the viewport - fully "read" immediately
			return Math.round((window.scrollY / scrollable) * 100);
		}

		function onScroll() {
			if (tickingRef.current) return;
			tickingRef.current = true;
			requestAnimationFrame(() => {
				tickingRef.current = false;
				const depth = computeDepthPercent();
				for (const threshold of THRESHOLDS) {
					if (depth >= threshold && !firedRef.current.has(threshold)) {
						firedRef.current.add(threshold);
						events.articleReadProgress(slug, threshold, getBaseContext(pathname));
					}
				}
			});
		}

		window.addEventListener("scroll", onScroll, { passive: true });
		onScroll(); // catch a short article that's already fully visible on load
		return () => window.removeEventListener("scroll", onScroll);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return null;
}
