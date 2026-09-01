import type { ListBlock as ListBlockData } from "../types/blocks";
import styles from "./ListBlock.module.css";

export function ListBlock({ block }: { block: ListBlockData }) {
	const Tag = block.style === "ordered" ? "ol" : "ul";
	return (
		<Tag className={styles.list}>
			{block.items.map((item, index) => (
				<li key={index} className={styles.item}>
					{item}
				</li>
			))}
		</Tag>
	);
}
