import type { ParagraphBlock as ParagraphBlockData } from "../types/blocks";
import styles from "./ParagraphBlock.module.css";

export function ParagraphBlock({ block }: { block: ParagraphBlockData }) {
  return <p className={styles.paragraph}>{block.text}</p>;
}
