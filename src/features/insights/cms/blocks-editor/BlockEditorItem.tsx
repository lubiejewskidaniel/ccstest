"use client";

import type { ContentBlock } from "@/features/insights/types/blocks";
import { generateUniqueHeadingId } from "@/features/insights/types/blocks";
import { BLOCK_TYPE_LABEL } from "./createDefaultBlock";
import { validateBlock } from "./validateBlock";
import styles from "./BlockEditor.module.css";

type Props = {
	block: ContentBlock;
	index: number;
	total: number;
	existingHeadingIds: string[];
	onChange: (next: ContentBlock) => void;
	onMove: (direction: -1 | 1) => void;
	onDelete: () => void;
};

export function BlockEditorItem({
	block,
	index,
	total,
	existingHeadingIds,
	onChange,
	onMove,
	onDelete,
}: Props) {
	const errors = validateBlock(block);

	return (
		<div className={styles.item}>
			<div className={styles.itemHeader}>
				<span className={styles.itemType}>{BLOCK_TYPE_LABEL[block.type]}</span>
				<div className={styles.itemControls}>
					<button
						type="button"
						className={styles.iconBtn}
						disabled={index === 0}
						onClick={() => onMove(-1)}
						aria-label="Move up"
						title="Move up"
					>
						↑
					</button>
					<button
						type="button"
						className={styles.iconBtn}
						disabled={index === total - 1}
						onClick={() => onMove(1)}
						aria-label="Move down"
						title="Move down"
					>
						↓
					</button>
					<button
						type="button"
						className={styles.iconBtnDanger}
						onClick={onDelete}
						aria-label="Delete block"
						title="Delete block"
					>
						✕
					</button>
				</div>
			</div>

			<div className={styles.itemBody}>
				{block.type === "paragraph" ? (
					<>
						<textarea
							className={styles.textarea}
							rows={4}
							value={block.text}
							placeholder="Paragraph text…"
							onChange={(e) => onChange({ ...block, text: e.target.value })}
						/>
						{errors.text ? (
							<span className="field-error">{errors.text}</span>
						) : null}
					</>
				) : null}

				{block.type === "heading" ? (
					<>
						<div className={styles.row}>
							<select
								className={styles.select}
								value={block.level}
								onChange={(e) =>
									onChange({ ...block, level: Number(e.target.value) as 2 | 3 })
								}
							>
								<option value={2}>Heading 2</option>
								<option value={3}>Heading 3</option>
							</select>
							<input
								className={styles.input}
								type="text"
								value={block.text}
								placeholder="Heading text…"
								onChange={(e) => {
									const text = e.target.value;
									// Generate the anchor id once, the first time this
									// heading gets real text — never recomputed after
									// that, so a stabilised id survives later wording
									// tweaks (existingHeadingIds already excludes this
									// block's own current id, so re-deriving on the very
									// first keystroke can't collide with itself).
									const id = block.id
										? block.id
										: text.trim()
											? generateUniqueHeadingId(text, existingHeadingIds)
											: block.id;
									onChange({ ...block, text, id });
								}}
							/>
						</div>
						{errors.text ? (
							<span className="field-error">{errors.text}</span>
						) : null}
						{block.id ? (
							<span className={styles.hintSmall}>Anchor id: {block.id}</span>
						) : null}
					</>
				) : null}

				{block.type === "image" ? (
					<>
						<div className="field-row">
							<div className="field">
								<label>Image URL</label>
								<input
									type="text"
									value={block.src}
									onChange={(e) => onChange({ ...block, src: e.target.value })}
								/>
								{errors.src ? (
									<span className="field-error">{errors.src}</span>
								) : null}
							</div>
							<div className="field">
								<label>
									Alt text <span className="req">required</span>
								</label>
								<input
									type="text"
									value={block.alt}
									onChange={(e) => onChange({ ...block, alt: e.target.value })}
								/>
								{errors.alt ? (
									<span className="field-error">{errors.alt}</span>
								) : null}
							</div>
						</div>
						{block.src ? (
							<div className={styles.imagePreviewWrap}>
								{/* eslint-disable-next-line @next/next/no-img-element -- editor-supplied URL on an unknown host, same reasoning as the public ImageBlock renderer */}
								<img
									src={block.src}
									alt=""
									className={styles.imagePreview}
									onError={(e) => {
										e.currentTarget.style.display = "none";
									}}
									onLoad={(e) => {
										e.currentTarget.style.display = "block";
									}}
								/>
							</div>
						) : null}
						<div className="field-row">
							<div className="field">
								<label>Width (px)</label>
								<input
									type="number"
									min={1}
									value={block.width}
									onChange={(e) =>
										onChange({ ...block, width: Number(e.target.value) || 0 })
									}
								/>
							</div>
							<div className="field">
								<label>Height (px)</label>
								<input
									type="number"
									min={1}
									value={block.height}
									onChange={(e) =>
										onChange({ ...block, height: Number(e.target.value) || 0 })
									}
								/>
							</div>
						</div>
						<div className="field">
							<label>
								Caption <span className="opt">optional</span>
							</label>
							<input
								type="text"
								value={block.caption ?? ""}
								onChange={(e) =>
									onChange({ ...block, caption: e.target.value || undefined })
								}
							/>
						</div>
					</>
				) : null}

				{block.type === "callout" ? (
					<>
						<select
							className={styles.select}
							value={block.variant}
							onChange={(e) =>
								onChange({
									...block,
									variant: e.target.value as typeof block.variant,
								})
							}
						>
							<option value="info">Info</option>
							<option value="warning">Warning</option>
							<option value="tip">Tip</option>
						</select>
						<textarea
							className={styles.textarea}
							rows={3}
							value={block.text}
							placeholder="Callout text…"
							onChange={(e) => onChange({ ...block, text: e.target.value })}
						/>
						{errors.text ? (
							<span className="field-error">{errors.text}</span>
						) : null}
					</>
				) : null}

				{block.type === "quote" ? (
					<>
						<textarea
							className={styles.textarea}
							rows={3}
							value={block.text}
							placeholder="Quote text…"
							onChange={(e) => onChange({ ...block, text: e.target.value })}
						/>
						{errors.text ? (
							<span className="field-error">{errors.text}</span>
						) : null}
						<input
							className={styles.input}
							type="text"
							placeholder="Attribution (optional)"
							value={block.attribution ?? ""}
							onChange={(e) =>
								onChange({ ...block, attribution: e.target.value || undefined })
							}
						/>
					</>
				) : null}

				{block.type === "list" ? (
					<>
						<select
							className={styles.select}
							value={block.style}
							onChange={(e) =>
								onChange({
									...block,
									style: e.target.value as typeof block.style,
								})
							}
						>
							<option value="unordered">Bulleted</option>
							<option value="ordered">Numbered</option>
						</select>
						<div className={styles.listItems}>
							{block.items.map((item, itemIndex) => (
								<div className={styles.listItemRow} key={itemIndex}>
									<input
										className={styles.input}
										type="text"
										value={item}
										placeholder={`Item ${itemIndex + 1}`}
										onChange={(e) => {
											const items = [...block.items];
											items[itemIndex] = e.target.value;
											onChange({ ...block, items });
										}}
									/>
									<button
										type="button"
										className={styles.iconBtnDanger}
										disabled={block.items.length <= 1}
										onClick={() =>
											onChange({
												...block,
												items: block.items.filter((_, i) => i !== itemIndex),
											})
										}
										aria-label="Remove item"
									>
										✕
									</button>
								</div>
							))}
						</div>
						<button
							type="button"
							className={styles.addItemBtn}
							onClick={() =>
								onChange({ ...block, items: [...block.items, ""] })
							}
						>
							+ Add item
						</button>
						{errors.items ? (
							<span className="field-error">{errors.items}</span>
						) : null}
					</>
				) : null}

				{block.type === "code" ? (
					<>
						<textarea
							className={styles.textareaMono}
							rows={8}
							value={block.code}
							placeholder="Code…"
							spellCheck={false}
							onChange={(e) => onChange({ ...block, code: e.target.value })}
						/>
						{errors.code ? (
							<span className="field-error">{errors.code}</span>
						) : null}
						<div className="field-row">
							<div className="field">
								<label>
									Language <span className="opt">optional</span>
								</label>
								<input
									type="text"
									placeholder="ts, bash, json…"
									value={block.language ?? ""}
									onChange={(e) =>
										onChange({
											...block,
											language: e.target.value || undefined,
										})
									}
								/>
							</div>
							<div className="field">
								<label>
									Filename <span className="opt">optional</span>
								</label>
								<input
									type="text"
									value={block.filename ?? ""}
									onChange={(e) =>
										onChange({
											...block,
											filename: e.target.value || undefined,
										})
									}
								/>
							</div>
						</div>
					</>
				) : null}
			</div>
		</div>
	);
}
