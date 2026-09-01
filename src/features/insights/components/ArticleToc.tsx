import type { HeadingBlock } from "../types/blocks";
import styles from "./ArticleToc.module.css";

const TOC_LABEL: Record<"en" | "pl", string> = {
	en: "On this page",
	pl: "Na tej stronie",
};

/**
 * Reads directly from the article's own heading blocks
 * (`extractHeadings`, called by the article page) so the table of
 * contents and in-body anchors can never drift apart
 * (docs/INSIGHTS_ARCHITECTURE.md §3/§5).
 */
export function ArticleToc({ headings, locale }: { headings: HeadingBlock[]; locale: "en" | "pl" }) {
	if (headings.length < 2) return null; // not worth a TOC for a short article

	return (
		<nav className={styles.toc} aria-label={TOC_LABEL[locale]}>
			<span className={styles.label}>{TOC_LABEL[locale]}</span>
			<ol className={styles.list}>
				{headings.map((heading) => (
					<li key={heading.id} className={heading.level === 3 ? styles.subItem : styles.item}>
						<a href={`#${heading.id}`}>{heading.text}</a>
					</li>
				))}
			</ol>
		</nav>
	);
}
