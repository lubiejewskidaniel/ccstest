import type { CodeBlock as CodeBlockData } from "../types/blocks";
import styles from "./CodeBlock.module.css";

/**
 * Plain, well-styled `<pre><code>` — no syntax-highlighting dependency
 * for v1 (docs/INSIGHTS_ARCHITECTURE.md §5: this project has zero UI
 * dependencies beyond Supabase/Zod today, adding one is a real decision,
 * not a default). A highlighter can be dropped in here later without
 * touching anything else that renders blocks.
 */
export function CodeBlock({ block }: { block: CodeBlockData }) {
	return (
		<div className={styles.wrapper}>
			{block.filename ? <div className={styles.filename}>{block.filename}</div> : null}
			<pre className={styles.pre}>
				<code className={styles.code}>{block.code}</code>
			</pre>
		</div>
	);
}
