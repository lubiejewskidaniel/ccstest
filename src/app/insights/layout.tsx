import "@/styles/insights/tokens.css";

/**
 * Scopes `src/styles/insights/*.css` to the `/insights/**` route subtree
 * only (Next.js loads global CSS wherever it's imported, but this keeps
 * it out of the shared bundle for every other page — docs/
 * INSIGHTS_ARCHITECTURE.md §3). The Polish tree has its own identical
 * layout at src/app/pl/wiedza/layout.tsx rather than sharing this file,
 * since there's no shared segment between the two locale trees to hang a
 * common layout off (docs/INSIGHTS_AUDIT.md §1.1 — no `[locale]` segment).
 */
export default function InsightsLayout({ children }: { children: React.ReactNode }) {
	return <>{children}</>;
}
