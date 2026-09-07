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
 * Outcome of resolving a market keyword's natural key
 * (provider, keyword, country, language) to its row id.
 *   - "found": the keyword is tracked; `id` is its market_keywords.id.
 *   - "not_found": no market_keywords row exists for this exact natural
 *     key — this keyword has never been registered for tracking at all.
 *     Distinct from "found, but zero observations" (see
 *     `listMarketKeywordObservationsById`) and from "error" — callers
 *     must not collapse any of these three into one another.
 *   - "error": the lookup itself failed (Supabase not configured, or a
 *     genuine query/storage error) — never silently treated as
 *     "not_found".
 */
export type MarketKeywordLookupResult = { status: "found"; id: string } | { status: "not_found" } | { status: "error"; message: string };

/**
 * Resolves the natural key — provider, keyword (raw, never normalized or
 * inferred), country, language — to a `market_keywords` row id. This is
 * the ONE place that performs this lookup: `listMarketKeywordObservations`
 * below is a thin backward-compatible wrapper built on top of this
 * function plus `listMarketKeywordObservationsById`, so there is exactly
 * one implementation of the natural-key lookup and exactly one
 * implementation of the observations SELECT, never two copies of either.
 *
 * Added in Phase 3C.1E so a caller (the market-opportunity query
 * orchestrator) can distinguish "this keyword was never tracked at all"
 * from "it's tracked but has zero observations yet" — a distinction the
 * original combined lookup-then-observations query couldn't expose.
 */
export async function findMarketKeywordId(
	providerId: MarketIntelligenceProviderId,
	keyword: string,
	market: MarketCode,
): Promise<MarketKeywordLookupResult> {
	const supabase = await createSupabaseServerClient();
	if (!supabase) {
		return { status: "error", message: "Supabase isn't configured in this environment." };
	}

	const { data, error } = await supabase
		.from("market_keywords")
		.select("id")
		.eq("provider", providerId)
		.eq("keyword", keyword)
		.eq("country", market.country)
		.eq("language", market.language)
		.maybeSingle();

	if (error) return { status: "error", message: error.message };
	if (!data) return { status: "not_found" };
	return { status: "found", id: (data as { id: string }).id };
}

/**
 * Outcome of fetching every observation recorded for an already-resolved
 * `market_keywords` id. `"ok"` with an empty `rows` array is a normal,
 * expected state (the keyword is tracked but has no observations yet, or
 * every fetch attempt so far has been `no_data`) — never confused with
 * `"error"` (a genuine Supabase/query failure), which callers must
 * surface distinctly rather than silently treating as "no data".
 */
export type MarketKeywordObservationsResult = { status: "ok"; rows: MarketKeywordObservationRow[] } | { status: "error"; message: string };

/**
 * Every observation ever recorded for one already-resolved market
 * keyword id, newest fetch first — `no_data` markers and real weekly
 * observations interleaved exactly as persisted. This is the ONE place
 * that performs the observations SELECT — both this function and
 * `listMarketKeywordObservations` below rely on it, never a second copy
 * of the query. Added in Phase 3C.1E alongside `findMarketKeywordId` so
 * a caller that has already resolved the id doesn't have to pay for (or
 * risk drifting from) a second natural-key lookup.
 */
export async function listMarketKeywordObservationsById(marketKeywordId: string): Promise<MarketKeywordObservationsResult> {
	const supabase = await createSupabaseServerClient();
	if (!supabase) {
		return { status: "error", message: "Supabase isn't configured in this environment." };
	}

	const { data, error } = await supabase
		.from("market_keyword_observations")
		.select("status, period_start, impressions, broad_impressions, fetched_at")
		.eq("market_keyword_id", marketKeywordId)
		.order("fetched_at", { ascending: false });

	if (error) return { status: "error", message: error.message };
	return { status: "ok", rows: ((data ?? []) as RawObservation[]).map(mapObservation) };
}

/**
 * The original Phase 3B.1 read helper, kept signature- and
 * behavior-compatible: resolves the (provider, keyword, market) natural
 * key and returns every observation for it, or an empty array when the
 * keyword has never been fetched, the lookup or observations query
 * fails, or Supabase isn't configured — mirroring `planner/queries.ts`'s
 * "no Supabase configured -> empty array, never throw" contract, since
 * this is a read helper, not an editor-triggered action.
 *
 * Returns an empty array when the keyword has never been fetched for
 * this provider/market — this is NOT the same as a `no_data` observation
 * (which means "we asked, and Bing had nothing"); an empty array here
 * can also mean "we have never asked". A caller that needs to tell these
 * apart, or needs genuine query failures surfaced rather than silently
 * swallowed, should use `findMarketKeywordId` and
 * `listMarketKeywordObservationsById` directly instead of this wrapper —
 * see Phase 3C.1E's `market-opportunity/queries.ts` for that caller.
 *
 * Implemented (Phase 3C.1E) on top of the two functions above rather than
 * its own inline query, so there is exactly one place that performs the
 * natural-key lookup and exactly one place that performs the
 * observations SELECT. This change is purely internal — the function's
 * exported signature and return type/behavior are unchanged from Phase
 * 3B.1.
 */
export async function listMarketKeywordObservations(
	providerId: MarketIntelligenceProviderId,
	keyword: string,
	market: MarketCode,
): Promise<MarketKeywordObservationRow[]> {
	const lookup = await findMarketKeywordId(providerId, keyword, market);
	if (lookup.status !== "found") return [];

	const observations = await listMarketKeywordObservationsById(lookup.id);
	return observations.status === "ok" ? observations.rows : [];
}
