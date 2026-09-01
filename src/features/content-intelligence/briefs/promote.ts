import { getAdminSession } from "@/lib/supabase/adminAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createArticle } from "@/features/insights/cms/service";
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

	const primaryResult = await createArticle({
		locale: brief.primaryLocale,
		slug: brief.generated.slug,
		translationOf: null,
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
		const message = primaryResult.kind === "validation" ? Object.values(primaryResult.fieldErrors)[0] : primaryResult.message;
		await updateBriefRow(briefId, { status: "failed", error_message: `Promoting primary-locale article failed: ${message}` });
		return { ok: false, kind: "persistence", message: message ?? "Unknown error." };
	}

	let localizedArticleId: string | null = null;

	if (brief.localized && brief.localizedLocale) {
		const localizedResult = await createArticle({
			locale: brief.localizedLocale as Locale,
			slug: brief.localized.slug,
			translationOf: primaryResult.id,
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
			// The primary article already exists and is a perfectly valid
			// in_review draft on its own - a failed localisation write
			// doesn't roll that back, it just means this brief needs a
			// retry on the localized half (the brief keeps
			// primary_article_id set below, so it's clear one half
			// succeeded).
			const message = localizedResult.kind === "validation" ? Object.values(localizedResult.fieldErrors)[0] : localizedResult.message;
			await updateBriefRow(briefId, {
				status: "failed",
				primary_article_id: primaryResult.id,
				error_message: `Primary article created, but promoting the localized article failed: ${message}`,
			});
			return { ok: false, kind: "persistence", message: message ?? "Unknown error." };
		}

		localizedArticleId = localizedResult.id;
	}

	await updateBriefRow(briefId, {
		status: "promoted",
		primary_article_id: primaryResult.id,
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
					.update({ resulting_article_id: primaryResult.id, score_at_promotion: opportunity.opportunity_score })
					.eq("id", brief.opportunityId);
			}
		}
	}

	return { ok: true };
}
