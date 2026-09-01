import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OpportunityRow = {
	id: string;
	query: string;
	locale: string | null;
	totalClicks: number;
	totalImpressions: number;
	avgPosition: number | null;
	opportunityScore: number;
	status: "new" | "reviewing" | "briefed" | "dismissed";
	matchedArticleId: string | null;
	updatedAt: string;
};

type RawOpportunity = {
	id: string;
	query: string;
	locale: string | null;
	total_clicks: number;
	total_impressions: number;
	avg_position: number | null;
	opportunity_score: number;
	status: string;
	matched_article_id: string | null;
	updated_at: string;
};

function mapOpportunity(row: RawOpportunity): OpportunityRow {
	return {
		id: row.id,
		query: row.query,
		locale: row.locale,
		totalClicks: row.total_clicks,
		totalImpressions: row.total_impressions,
		avgPosition: row.avg_position,
		opportunityScore: row.opportunity_score,
		status: row.status as OpportunityRow["status"],
		matchedArticleId: row.matched_article_id,
		updatedAt: row.updated_at,
	};
}

/**
 * The planner's core read: highest-scoring opportunities not yet
 * dismissed or already turned into a brief, ordered so an editor sees
 * the best candidates first. This is the whole "planner" deliverable for
 * Checkpoint 6 — actually generating a content brief from a selected
 * opportunity is Checkpoint 7's "briefs" item, deliberately not built
 * here (docs/INSIGHTS_ARCHITECTURE.md §7's boundary: content-intelligence
 * only ever gets a write path into insights_articles, and only once a
 * human or the future AI pipeline has turned an opportunity into an
 * actual draft).
 */
export async function listTopOpportunities(limit = 25): Promise<OpportunityRow[]> {
	const supabase = await createSupabaseServerClient();
	if (!supabase) return [];

	const { data } = await supabase
		.from("content_opportunities")
		.select("*")
		.in("status", ["new", "reviewing"])
		.order("opportunity_score", { ascending: false })
		.limit(limit);

	return (data ?? []).map(mapOpportunity);
}

export async function listAllOpportunities(limit = 100): Promise<OpportunityRow[]> {
	const supabase = await createSupabaseServerClient();
	if (!supabase) return [];

	const { data } = await supabase
		.from("content_opportunities")
		.select("*")
		.order("opportunity_score", { ascending: false })
		.limit(limit);

	return (data ?? []).map(mapOpportunity);
}
