"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { events, getBaseContext } from "@/lib/analytics";

/** Fires `insights_search` once per results page load — same
 * mount-once-guarded-by-ref pattern as `ArticleViewTracker`. */
export function SearchViewTracker({ query, resultCount }: { query: string; resultCount: number }) {
	const pathname = usePathname();
	const firedRef = useRef(false);

	useEffect(() => {
		if (firedRef.current || !query) return;
		firedRef.current = true;
		events.insightsSearch(query, resultCount, getBaseContext(pathname));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return null;
}
