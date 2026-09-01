import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/supabase/adminAuth";
import { createBriefSchema } from "./schema";
import type { ContentBrief, GeneratedDraft, QualityIssue } from "../types/contentAi";

export type BriefResult =
	| { ok: true; id: string }
	| { ok: false; kind: "auth"; message: string }
	| { ok: false; kind: "validation"; fieldErrors: Record<string, string> }
	| { ok: false; kind: "persistence"; message: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBrief(row: any): ContentBrief {
	const generated: GeneratedDraft | null = row.generated_title
		? {
				title: row.generated_title,
				excerpt: row.generated_excerpt,
				slug: row.generated_slug,
				body: row.generated_body ?? [],
			}
		: null;

	const localized: GeneratedDraft | null = row.localized_title
		? {
				title: row.localized_title,
				excerpt: row.localized_excerpt,
				slug: row.localized_slug,
				body: row.localized_body ?? [],
			}
		: null;

	return {
		id: row.id,
		opportunityId: row.opportunity_id,
		primaryLocale: row.primary_locale,
		categoryId: row.category_id,
		topic: row.topic,
		keyPoints: row.key_points,
		status: row.status,
		researchNotes: row.research_notes,
		generated,
		localizedLocale: row.localized_locale,
		localized,
		qualityIssues: (row.quality_issues ?? []) as QualityIssue[],
		errorMessage: row.error_message,
		primaryArticleId: row.primary_article_id,
		localizedArticleId: row.localized_article_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export async function createBrief(raw: unknown): Promise<BriefResult> {
	const session = await getAdminSession();
	if (!session?.isEditor) return { ok: false, kind: "auth", message: "You must be signed in as an editor to do this." };

	const parsed = createBriefSchema.safeParse(raw);
	if (!parsed.success) {
		const fieldErrors: Record<string, string> = {};
		for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".") || "form"] = issue.message;
		return { ok: false, kind: "validation", fieldErrors };
	}

	const supabase = await createSupabaseServerClient();
	if (!supabase) return { ok: false, kind: "persistence", message: "Supabase isn't configured in this environment." };

	const { data, error } = await supabase
		.from("content_briefs")
		.insert({
			opportunity_id: parsed.data.opportunityId,
			primary_locale: parsed.data.primaryLocale,
			category_id: parsed.data.categoryId,
			topic: parsed.data.topic,
			key_points: parsed.data.keyPoints,
			created_by: session.userId,
		})
		.select("id")
		.single();

	if (error || !data) return { ok: false, kind: "persistence", message: error?.message ?? "Could not create the brief." };

	return { ok: true, id: data.id };
}

export async function getBrief(id: string): Promise<ContentBrief | null> {
	const supabase = await createSupabaseServerClient();
	if (!supabase) return null;

	const { data } = await supabase.from("content_briefs").select("*").eq("id", id).maybeSingle();
	if (!data) return null;

	return mapBrief(data);
}

export async function listBriefs(): Promise<ContentBrief[]> {
	const supabase = await createSupabaseServerClient();
	if (!supabase) return [];

	const { data } = await supabase.from("content_briefs").select("*").order("updated_at", { ascending: false });
	return (data ?? []).map(mapBrief);
}

/** Internal helper shared by every pipeline stage
 * (research/generate/localise/qualityGate/promote) to persist its
 * result — never exported outside `content-intelligence/**`, since a
 * raw column-name patch is exactly the kind of thing the rest of the app
 * should go through named functions for, not call directly. */
export async function updateBriefRow(id: string, patch: Record<string, unknown>): Promise<{ ok: true } | { ok: false; message: string }> {
	const supabase = await createSupabaseServerClient();
	if (!supabase) return { ok: false, message: "Supabase isn't configured in this environment." };

	const { error } = await supabase.from("content_briefs").update(patch).eq("id", id);
	if (error) return { ok: false, message: error.message };
	return { ok: true };
}

