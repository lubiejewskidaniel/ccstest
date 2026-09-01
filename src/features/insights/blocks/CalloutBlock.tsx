import type { CalloutBlock as CalloutBlockData } from "../types/blocks";
import styles from "./CalloutBlock.module.css";

const ICON: Record<CalloutBlockData["variant"], string> = {
	info: "i",
	warning: "!",
	tip: "★",
};

export function CalloutBlock({ block }: { block: CalloutBlockData }) {
	return (
		<div className={`${styles.callout} ${styles[block.variant]}`} role="note">
			<span className={styles.icon} aria-hidden="true">
				{ICON[block.variant]}
			</span>
			<p className={styles.text}>{block.text}</p>
		</div>
	);
}
