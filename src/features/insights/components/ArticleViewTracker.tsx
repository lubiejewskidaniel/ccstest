"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { events, getBaseContext } from "@/lib/analytics";

/**
 * Fires `article_view` once per page load — the article-level sibling of
 * `FireViewEvent` (which only knows a fixed set of section-level events
 * and has no slots for `slug`/`category`). Same mount-once-guarded-by-ref
 * pattern to survive Strict Mode's dev double-invoke.
 */
export function ArticleViewTracker({ slug, category }: { slug: string; category: string }) {
	const pathname = usePathname();
	const firedRef = useRef(false);

	useEffect(() => {
		if (firedRef.current) return;
		firedRef.current = true;
		events.articleView(slug, category, getBaseContext(pathname));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return null;
}
