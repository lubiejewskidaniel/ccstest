import Link from "next/link";
import type { Category } from "../types/article";
import type { Locale } from "@/lib/routes";
import { categoryPath } from "../seo/paths";
import styles from "./PillarCard.module.css";

export function PillarCard({ category, locale }: { category: Category; locale: Locale }) {
	return (
		<Link href={categoryPath(category.slug, locale)} className={styles.card} data-pillar={category.key}>
			<span className={styles.key}>{category.key.toUpperCase()}</span>
			<h3 className={styles.name}>{category.name}</h3>
			{category.description ? <p className={styles.description}>{category.description}</p> : null}
			<span className={styles.arrow} aria-hidden="true">
				→
			</span>
		</Link>
	);
}
