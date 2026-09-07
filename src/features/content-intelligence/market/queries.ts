import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MarketCode, MarketIntelligenceProviderId } from "./types";

export type MarketKeywordObservationRow = {
	status: "observed" | "no_data";
	/** Null for a `no_data` row. */
	periodStart: string | null;
	impressions: number | null;
	broadImpressions: number | null;
	fetchedAt: string;
};

type RawObservation = {
	status: string;
	period_start: string | null;
	impressions: number | null;
	broad_impressions: number | null;
	fetched_at: string;
};

function mapObservation(row: RawObservation): MarketKeywordObservationRow {
	return {
		status: row.status as MarketKeywordObservationRow["status"],
		periodStart: row.period_start,
		impressions: row.impressions,
		broadImpressions: row.broad_impressions,
		fetchedAt: row.fetched_at,
	};
}

/**
 * The read side of the Phase 3B.1 pipeline: every observation ever
 * recorded for one (provider, keyword, market) triple, newest fetch
 * first — `no_data` markers and real weekly observations interleaved
 * exactly as they were persisted, so a caller can see both "what demand
 * did we see" and "when did we last check and find nothing" from one
 * read. Mirrors `planner/queries.ts`'s "no Supabase configured -> empty
 * array, never throw" contract, since this is a read helper, not an
 * editor-triggered action.
 *
 * Returns an empty array when the keyword has never been fetched for
 * this provider/market — this is NOT the same as a `no_data` observation
 * (which means "we asked, and Bing had nothing"); an empty array here
 * can also mean "we have never asked".
 */
export async function listMarketKeywordObservations(
	providerId: MarketIntelligenceProviderId,
	keyword: string,
	market: MarketCode,
): Promise<MarketKeywordObservationRow[]> {
	const supabase = await createSupabaseServerClient();
	if (!supabase) return [];

	const { data: keywordRow } = await supabase
		.from("market_keywords")
		.select("id")
		.eq("provider", providerId)
		.eq("keyword", keyword)
		.eq("country", market.country)
		.eq("language", market.language)
		.maybeSingle();

	if (!keywordRow) return [];

	const { data: observations } = await supabase
		.from("market_keyword_observations")
		.select("status, period_start, impressions, broad_impressions, fetched_at")
		.eq("market_keyword_id", (keywordRow as { id: string }).id)
		.order("fetched_at", { ascending: false });

	return (observations ?? []).map(mapObservation);
}
