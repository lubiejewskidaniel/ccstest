import type { QuoteBlock as QuoteBlockData } from "../types/blocks";
import styles from "./QuoteBlock.module.css";

export function QuoteBlock({ block }: { block: QuoteBlockData }) {
	return (
		<blockquote className={styles.quote}>
			<p className={styles.text}>{block.text}</p>
			{block.attribution ? <cite className={styles.attribution}>{block.attribution}</cite> : null}
		</blockquote>
	);
}
