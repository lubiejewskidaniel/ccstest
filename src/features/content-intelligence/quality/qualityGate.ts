import { getAdminSession } from "@/lib/supabase/adminAuth";
import { getBrief, updateBriefRow } from "../briefs/service";
import type { GeneratedDraft, QualityIssue, StageResult } from "../types/contentAi";
import type { ContentBlock } from "@/features/insights/types/blocks";

const PLACEHOLDER_PATTERNS = [/\[TODO/i, /lorem ipsum/i, /\{\{.*?\}\}/, /\bXXX\b/, /\btbd\b/i];
const MIN_WORDS = 250;
const MAX_WORDS = 3000;
const MIN_HEADINGS = 2;
const MIN_BLOCKS = 4;

function countWords(blocks: ContentBlock[]): number {
	let words = 0;
	for (const block of blocks) {
		if (block.type === "paragraph" || block.type === "quote" || block.type === "callout") {
			words += block.text.trim().split(/\s+/).filter(Boolean).length;
		} else if (block.type === "heading") {
			words += block.text.trim().split(/\s+/).filter(Boolean).length;
		} else if (block.type === "list") {
			for (const item of block.items) words += item.trim().split(/\s+/).filter(Boolean).length;
		}
	}
	return words;
}

function textOf(blocks: ContentBlock[]): string {
	return blocks
		.map((block) => {
			if (block.type === "paragraph" || block.type === "quote" || block.type === "callout") return block.text;
			if (block.type === "heading") return block.text;
			if (block.type === "list") return block.items.join(" ");
			return "";
		})
		.join(" ");
}

/**
 * Checks one locale's draft. Pure and synchronous — no database, no AI
 * call, no side effect — so it's trivially re-runnable and independently
 * verifiable from the pipeline stages that call it.
 */
export function checkDraftQuality(draft: GeneratedDraft): QualityIssue[] {
	const issues: QualityIssue[] = [];

	if (draft.title.length < 10) issues.push({ field: "title", message: "Title is unusually short for an article headline." });
	if (draft.excerpt.length < 40) issues.push({ field: "excerpt", message: "Excerpt is unusually short." });

	const headingCount = draft.body.filter((b) => b.type === "heading").length;
	if (headingCount < MIN_HEADINGS) {
		issues.push({ field: "body", message: `Only ${headingCount} heading(s) — expected at least ${MIN_HEADINGS} for a structured article.` });
	}

	if (draft.body.length < MIN_BLOCKS) {
		issues.push({ field: "body", message: `Only ${draft.body.length} content block(s) — expected at least ${MIN_BLOCKS}.` });
	}

	const wordCount = countWords(draft.body);
	if (wordCount < MIN_WORDS) issues.push({ field: "body", message: `Only ~${wordCount} words — expected at least ${MIN_WORDS}.` });
	if (wordCount > MAX_WORDS) issues.push({ field: "body", message: `~${wordCount} words — longer than the ${MAX_WORDS}-word guideline.` });

	const fullText = `${draft.title} ${draft.excerpt} ${textOf(draft.body)}`;
	for (const pattern of PLACEHOLDER_PATTERNS) {
		if (pattern.test(fullText)) {
			issues.push({ field: "body", message: `Contains what looks like placeholder text matching ${pattern}.` });
		}
	}

	const codeBlocksWithoutLanguage = draft.body.filter((b) => b.type === "code" && !b.language).length;
	if (codeBlocksWithoutLanguage > 0) {
		issues.push({ field: "body", message: `${codeBlocksWithoutLanguage} code block(s) have no language set — fine to publish, worth a human glance.` });
	}

	return issues;
}

/**
 * Stage 4: runs `checkDraftQuality` against both the primary and
 * localized drafts (when present) and persists the combined issue list.
 * Sets `quality_passed`/`quality_failed` — `quality_failed` does not
 * block an editor from reviewing or manually fixing the brief's content,
 * it blocks the *promotion* step (`briefs/promote.ts`) from creating
 * `insights_articles` rows until the issues are resolved or the brief is
 * regenerated.
 */
export async function runQualityCheck(briefId: string): Promise<StageResult> {
	const session = await getAdminSession();
	if (!session?.isEditor) return { ok: false, kind: "auth", message: "You must be signed in as an editor to do this." };

	const brief = await getBrief(briefId);
	if (!brief) return { ok: false, kind: "not_found", message: "Brief not found." };
	if (!brief.generated) return { ok: false, kind: "validation", message: "Run generation before the quality check." };

	const issues: QualityIssue[] = [...checkDraftQuality(brief.generated)];
	if (brief.localized) issues.push(...checkDraftQuality(brief.localized).map((issue) => ({ ...issue, field: `localized.${issue.field}` })));

	const status = issues.length === 0 ? "quality_passed" : "quality_failed";
	const result = await updateBriefRow(briefId, { status, quality_issues: issues, error_message: null });
	if (!result.ok) return { ok: false, kind: "persistence", message: result.message };

	return { ok: true };
}
