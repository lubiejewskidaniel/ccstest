import type { ArticleStatus } from "../types/article";
import styles from "./StatusBadge.module.css";

const STATUS_LABEL: Record<ArticleStatus, string> = {
	draft: "Draft",
	in_review: "In review",
	scheduled: "Scheduled",
	published: "Published",
	archived: "Archived",
};

export function StatusBadge({ status }: { status: ArticleStatus }) {
	return (
		<span className={styles.badge} data-status={status}>
			{STATUS_LABEL[status]}
		</span>
	);
}
