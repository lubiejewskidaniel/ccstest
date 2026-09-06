"use client";

import { useState } from "react";
import type { ContentBlock } from "@/features/insights/types/blocks";
import { articleBodySchema } from "@/features/insights/types/blocks";
import { BlockEditorItem } from "./BlockEditorItem";
import { createDefaultBlock, BLOCK_TYPE_LABEL, type BlockType } from "./createDefaultBlock";
import styles from "./BlockEditor.module.css";

const BLOCK_TYPES: BlockType[] = ["paragraph", "heading", "image", "list", "callout", "quote", "code"];

/**
 * Replaces the raw JSON textarea that used to be the only way to author
 * an article body. The stored/submitted shape is unchanged — this still
 * serializes to the same hidden `bodyJson` form field the Server Action
 * already parses and validates
 * (`src/lib/actions/insightsCms.ts`/`src/features/insights/cms/schema.ts`),
 * so nothing downstream of the form needed to change. AI-generated and
 * human-edited articles both keep going through the exact same
 * `ContentBlock[]` shape and the exact same Zod schemas
 * (`@/features/insights/types/blocks`) this editor validates against
 * live — there is no second, editor-only validation model to drift out
 * of sync with what the server accepts.
 */
export function BlockEditor({ initialBlocks, fieldError }: { initialBlocks: ContentBlock[]; fieldError?: string }) {
	const [blocks, setBlocks] = useState<ContentBlock[]>(initialBlocks);
	const [addMenuOpen, setAddMenuOpen] = useState(false);
	const [advancedOpen, setAdvancedOpen] = useState(false);
	const [jsonDraft, setJsonDraft] = useState("");
	const [jsonEditing, setJsonEditing] = useState(false);
	const [jsonError, setJsonError] = useState<string | null>(null);

	function updateBlock(index: number, next: ContentBlock) {
		setBlocks((prev) => prev.map((b, i) => (i === index ? next : b)));
	}

	function moveBlock(index: number, direction: -1 | 1) {
		setBlocks((prev) => {
			const targetIndex = index + direction;
			if (targetIndex < 0 || targetIndex >= prev.length) return prev;
			const next = [...prev];

			const current = next[index];
			const target = next[targetIndex];

			if (!current || !target) {
				return prev;
			}

			next[index] = target;
			next[targetIndex] = current;
			return next;
		});
	}

	function deleteBlock(index: number) {
		setBlocks((prev) => prev.filter((_, i) => i !== index));
	}

	function addBlock(type: BlockType) {
		setBlocks((prev) => [...prev, createDefaultBlock(type)]);
		setAddMenuOpen(false);
	}

	function openAdvanced() {
		setJsonDraft(JSON.stringify(blocks, null, 2));
		setJsonEditing(false);
		setJsonError(null);
		setAdvancedOpen(true);
	}

	function applyJson() {
		let parsed: unknown;
		try {
			parsed = JSON.parse(jsonDraft);
		} catch {
			setJsonError("Not valid JSON.");
			return;
		}
		const result = articleBodySchema.safeParse(parsed);
		if (!result.success) {
			setJsonError(result.error.issues[0]?.message ?? "Doesn't match the content block schema.");
			return;
		}
		setBlocks(result.data);
		setJsonEditing(false);
		setJsonError(null);
	}

	return (
		<div className={styles.editor}>
			<input type="hidden" name="bodyJson" value={JSON.stringify(blocks)} />

			{blocks.length === 0 ? (
				<div className={styles.empty}>No content yet — add the first block below.</div>
			) : (
				<div className={styles.list}>
					{blocks.map((block, index) => {
						const existingHeadingIds = blocks
							.filter((b, i) => b.type === "heading" && i !== index)
							.map((b) => (b as { id: string }).id)
							.filter(Boolean);
						return (
							<BlockEditorItem
								key={index}
								block={block}
								index={index}
								total={blocks.length}
								existingHeadingIds={existingHeadingIds}
								onChange={(next) => updateBlock(index, next)}
								onMove={(direction) => moveBlock(index, direction)}
								onDelete={() => deleteBlock(index)}
							/>
						);
					})}
				</div>
			)}

			{fieldError ? <span className="field-error">{fieldError}</span> : null}

			<div className={styles.addRow}>
				<div className={styles.addMenuWrap}>
					<button type="button" className="btn btn-ghost" onClick={() => setAddMenuOpen((v) => !v)}>
						+ Add block
					</button>
					{addMenuOpen ? (
						<div className={styles.addMenu} role="menu">
							{BLOCK_TYPES.map((type) => (
								<button key={type} type="button" className={styles.addMenuItem} onClick={() => addBlock(type)}>
									{BLOCK_TYPE_LABEL[type]}
								</button>
							))}
						</div>
					) : null}
				</div>
			</div>

			<details
				className={styles.advanced}
				open={advancedOpen}
				onToggle={(e) => !e.currentTarget.open && setAdvancedOpen(false)}
			>
				<summary
					onClick={(e) => {
						e.preventDefault();
						if (advancedOpen) setAdvancedOpen(false);
						else openAdvanced();
					}}
				>
					Advanced: view/edit as JSON
				</summary>
				{advancedOpen ? (
					<div className={styles.advancedBody}>
						{jsonEditing ? (
							<>
								<textarea
									className={styles.jsonTextarea}
									value={jsonDraft}
									onChange={(e) => setJsonDraft(e.target.value)}
									rows={16}
									spellCheck={false}
								/>
								{jsonError ? <span className="field-error">{jsonError}</span> : null}
								<div className={styles.advancedActions}>
									<button type="button" className="btn btn-primary" onClick={applyJson}>
										Apply JSON
									</button>
									<button type="button" className="btn btn-ghost" onClick={() => setJsonEditing(false)}>
										Cancel
									</button>
								</div>
							</>
						) : (
							<>
								<pre className={styles.jsonPreview}>{JSON.stringify(blocks, null, 2)}</pre>
								<button type="button" className="btn btn-ghost" onClick={() => setJsonEditing(true)}>
									Edit as JSON
								</button>
							</>
						)}
					</div>
				) : null}
			</details>
		</div>
	);
}
