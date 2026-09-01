"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { events, getBaseContext } from "@/lib/analytics";

/** Fires `tag_view` once per page load — same mount-once pattern as
 * `ArticleViewTracker`. */
export function TagViewTracker({ slug }: { slug: string }) {
	const pathname = usePathname();
	const firedRef = useRef(false);

	useEffect(() => {
		if (firedRef.current) return;
		firedRef.current = true;
		events.tagView(slug, getBaseContext(pathname));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return null;
}
