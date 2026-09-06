import { getAdminSession } from "@/lib/supabase/adminAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createArticle } from "@/features/insights/cms/service";
import type { CmsResult } from "@/features/insights/cms/service";
import { getBrief, updateBriefRow } from "./service";
import type { StageResult, GeneratedDraft } from "../types/contentAi";
import type { Locale } from "@/lib/routes";

const AI_AUTHOR_NAME = "CCS Editorial — AI-assisted draft";
const WORDS_PER_MINUTE = 200;

function estimateReadingMinutes(draft: GeneratedDraft): number {
	const words = draft.body.reduce((total, block) => {
		if (block.type === "paragraph" || block.type === "quote" || block.type === "callout") {
			return total + block.text.trim().split(/\s+/).filter(Boolean).length;
		}
		if (block.type === "heading") return total + block.text.trim().split(/\s+/).filter(Boolean).length;
		if (block.type === "list") return total + block.items.join(" ").trim().split(/\s+/).filter(Boolean).length;
		return total;
	}, 0);
	return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** Turns a failed `createArticle()` result into a message that names the
 * actual invalid field for a validation failure, instead of just Zod's
 * generic per-field text (e.g. a union mismatch's default message is
 * literally "Invalid input" with no indication of which field or why —
 * this is what made the original promotion bug so hard to diagnose from
 * the UI alone). */
function formatCreateArticleError(result: Extract<CmsResult, { ok: false }>): string {
	if (result.kind === "validation") {
		const [field, message] = Object.entries(result.fieldErrors)[0] ?? ["field", "Invalid input"];
		return `${field}: ${message}`;
	}
	return result.message;
}

/**
 * Stage 5 (final): the ONLY place `content-intelligence/**` ever writes
 * to `insights_articles` — and it does so through the exact same
 * Zod-validated `createArticle()` the human CMS editor's form submits
 * to, not a parallel or privileged write path
 * (docs/INSIGHTS_ARCHITECTURE.md §7's architectural boundary, preserved
 * unchanged by this checkpoint). Both created rows land as
 * `status: "in_review"` — Decision 10/11 still applies exactly as it
 * does to a human draft: nothing here can publish anything.
 *
 * Requires `quality_passed` — the gate this function enforces, not just
 * documents. A brief with unresolved quality issues, or one that skipped
 * generation entirely, is refused here regardless of what its `status`
 * column might otherwise suggest a caller could get away with.
 */
export async function promoteToArticles(briefId: string): Promise<StageResult> {
	const session = await getAdminSession();
	if (!session?.isEditor) return { ok: false, kind: "auth", message: "You must be signed in as an editor to do this." };

	const brief = await getBrief(briefId);
	if (!brief) return { ok: false, kind: "not_found", message: "Brief not found." };

	if (brief.status !== "quality_passed") {
		return { ok: false, kind: "validation", message: "Only a brief that has passed the quality gate can be promoted." };
	}
	if (!brief.generated) {
		return { ok: false, kind: "validation", message: "No generated draft to promote." };
	}

	// Retry safety: if a previous attempt already created the primary
	// article (e.g. the localized half failed afterwards, or a prior bug
	// caused a failure after this row existed), reuse that id instead of
	// creating a second one. `brief.primaryArticleId` is read fresh from
	// the database on every call via getBrief() above, so this reflects
	// reality even across separate promotion attempts.
	let primaryArticleId = brief.primaryArticleId;

	if (!primaryArticleId) {
		const primaryResult = await createArticle({
			locale: brief.primaryLocale,
			slug: brief.generated.slug,
			// "" (not null) - matches what the CMS form itself would send
			// for "no linked translation yet" (TranslationPicker's hidden
			// input defaults to ""). articleInputSchema's translationOf is
			// `z.union([uuidSchema, z.literal("")]).optional()`, which never
			// accepts `null` - passing null here was the original bug:
			// Zod's union validation rejected it with its generic
			// "Invalid input" message, unrelated to any real field content.
			translationOf: "",
			categoryId: brief.categoryId,
			tagIds: [],
			title: brief.generated.title,
			excerpt: brief.generated.excerpt,
			coverImageUrl: "",
			coverImageAlt: "",
			body: brief.generated.body,
			readingMinutes: estimateReadingMinutes(brief.generated),
			authorName: AI_AUTHOR_NAME,
			status: "in_review",
			scheduledAt: "",
			seoTitle: "",
			seoDescription: "",
			featured: false,
			source: "ai_generated",
		});

		if (!primaryResult.ok) {
			const message = formatCreateArticleError(primaryResult);
			await updateBriefRow(briefId, { status: "failed", error_message: `Promoting primary-locale article failed: ${message}` });
			return { ok: false, kind: "persistence", message };
		}

		primaryArticleId = primaryResult.id;
		// Persisted immediately (not deferred to the final update at the
		// bottom of this function) so that if the localized half fails
		// next, the brief already remembers this id and a retry won't
		// recreate it.
		await updateBriefRow(briefId, { primary_article_id: primaryArticleId });
	}

	let localizedArticleId: string | null = brief.localizedArticleId;

	if (brief.localized && brief.localizedLocale && !localizedArticleId) {
		const localizedResult = await createArticle({
			locale: brief.localizedLocale as Locale,
			slug: brief.localized.slug,
			translationOf: primaryArticleId,
			categoryId: brief.categoryId,
			tagIds: [],
			title: brief.localized.title,
			excerpt: brief.localized.excerpt,
			coverImageUrl: "",
			coverImageAlt: "",
			body: brief.localized.body,
			readingMinutes: estimateReadingMinutes(brief.localized),
			authorName: AI_AUTHOR_NAME,
			status: "in_review",
			scheduledAt: "",
			seoTitle: "",
			seoDescription: "",
			featured: false,
			source: "ai_generated",
		});

		if (!localizedResult.ok) {
			// The primary article already exists (and is already persisted
			// on the brief above) and is a perfectly valid in_review draft
			// on its own - a failed localized write doesn't roll that back,
			// it just means a retry needs to (and, per the check above,
			// will) skip straight to re-attempting the localized half.
			const message = formatCreateArticleError(localizedResult);
			await updateBriefRow(briefId, {
				status: "failed",
				primary_article_id: primaryArticleId,
				error_message: `Primary article created, but promoting the localized article failed: ${message}`,
			});
			return { ok: false, kind: "persistence", message };
		}

		localizedArticleId = localizedResult.id;
	}

	await updateBriefRow(briefId, {
		status: "promoted",
		primary_article_id: primaryArticleId,
		localized_article_id: localizedArticleId,
		error_message: null,
	});

	// Checkpoint 9 "adaptive scoring" — closes the loop back to the
	// opportunity this brief came from (if any), so
	// `learning/calibration.ts` can later compare this snapshot against
	// the article's real performance. Best-effort: a failure here doesn't
	// undo the promotion that already succeeded above, it just means this
	// one opportunity won't feed into a future calibration run.
	if (brief.opportunityId) {
		const supabase = await createSupabaseServerClient();
		if (supabase) {
			const { data: opportunity } = await supabase
				.from("content_opportunities")
				.select("opportunity_score, score_at_promotion")
				.eq("id", brief.opportunityId)
				.maybeSingle();

			if (opportunity && opportunity.score_at_promotion === null) {
				await supabase
					.from("content_opportunities")
					.update({ resulting_article_id: primaryArticleId, score_at_promotion: opportunity.opportunity_score })
					.eq("id", brief.opportunityId);
			}
		}
	}

	return { ok: true };
}
