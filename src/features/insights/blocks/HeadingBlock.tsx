import type { HeadingBlock as HeadingBlockData } from "../types/blocks";
import styles from "./HeadingBlock.module.css";

export function HeadingBlock({ block }: { block: HeadingBlockData }) {
	const className = block.level === 2 ? styles.h2 : styles.h3;
	if (block.level === 2) {
		return (
			<h2 id={block.id} className={className}>
				{block.text}
			</h2>
		);
	}
	return (
		<h3 id={block.id} className={className}>
			{block.text}
		</h3>
	);
}
