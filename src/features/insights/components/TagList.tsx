import Link from "next/link";
import type { Tag } from "../types/article";
import type { Locale } from "@/lib/routes";
import { tagPath } from "../seo/paths";
import styles from "./TagList.module.css";

export function TagList({ tags, locale }: { tags: Tag[]; locale: Locale }) {
	if (tags.length === 0) return null;
	return (
		<ul className={styles.list}>
			{tags.map((tag) => (
				<li key={tag.id}>
					<Link href={tagPath(tag.slug, locale)} className={styles.tag}>
						#{tag.name}
					</Link>
				</li>
			))}
		</ul>
	);
}
