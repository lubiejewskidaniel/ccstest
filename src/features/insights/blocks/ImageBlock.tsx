import type { ImageBlock as ImageBlockData } from "../types/blocks";
import styles from "./ImageBlock.module.css";

/**
 * Plain <img>, not next/image: article body images come from
 * editor-supplied URLs (CMS today, Content Engine later) and
 * next.config.mjs has no `images.remotePatterns` configured for an
 * unknown, per-article host. Revisit once the actual asset host (e.g. a
 * Supabase Storage bucket) is known and can be whitelisted.
 */
export function ImageBlock({ block }: { block: ImageBlockData }) {
	return (
		<figure className={styles.figure}>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				src={block.src}
				alt={block.alt}
				width={block.width}
				height={block.height}
				className={styles.image}
				loading="lazy"
			/>
			{block.caption ? <figcaption className={styles.caption}>{block.caption}</figcaption> : null}
		</figure>
	);
}
