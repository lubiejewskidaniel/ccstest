import Link from "next/link";
import { StatusBadge } from "../cms/StatusBadge";
import type { ArticleStatus } from "../types/article";
import styles from "./PreviewBanner.module.css";

/**
 * Sits above the reused public `ArticlePage` render so an editor can
 * never mistake a preview for the live site — the whole point of a
 * preview is checking an article that ISN'T publicly visible yet, and
 * the banner is the one visual cue this page adds on top of the
 * unmodified public renderer.
 */
export function PreviewBanner({ articleId, status }: { articleId: string; status: ArticleStatus }) {
	return (
		<div className={styles.banner}>
			<div className={styles.inner}>
				<span className={styles.label}>Preview</span>
				<StatusBadge status={status} />
				<span className={styles.note}>Not publicly visible — only you can see this.</span>
				<Link href={`/admin/insights/${articleId}/edit`} className={styles.back}>
					← Back to editor
				</Link>
			</div>
		</div>
	);
}
