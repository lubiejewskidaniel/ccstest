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

// ---------------------------------------------------------------------------
// Phase 3C.1F — tracked-keyword listing (admin inspection UI)
// ---------------------------------------------------------------------------

/** One `market_keywords` row, with `country`/`language` already folded
 * into the same `MarketCode` union every other function in this module
 * uses — never a raw `{country, language}` pair that could disagree with
 * it. */
export type TrackedMarketKeyword = {
	id: string;
	provider: MarketIntelligenceProviderId;
	keyword: string;
	market: MarketCode;
};

export type ListTrackedMarketKeywordsResult = { status: "ok"; rows: TrackedMarketKeyword[] } | { status: "error"; message: string };

type RawTrackedMarketKeyword = {
	id: string;
	provider: string;
	keyword: string;
	country: string;
	language: string;
};

/** The only two valid (country, language) pairs `MarketCode` can
 * represent — see that type's own doc comment on why this is a
 * discriminated union rather than two independent fields. Anything else
 * found in the database is a malformed row, not a market this function
 * can honestly report. */
function toMarketCode(country: string, language: string): MarketCode | null {
	if (country === "gb" && language === "en-GB") return { country: "gb", language: "en-GB" };
	if (country === "pl" && language === "pl-PL") return { country: "pl", language: "pl-PL" };
	return null;
}

/**
 * Every tracked `market_keywords` row, for the admin inspection UI's
 * keyword-selection list (Phase 3C.1F) — a listing concern, not an
 * orchestration one, so it stays in this file alongside every other
 * `market_keywords` read rather than in `market-opportunity/queries.ts`
 * (which assembles evidence for one already-chosen subject, never
 * discovers subjects itself).
 *
 * A row whose `country`/`language` don't form one of `MarketCode`'s two
 * valid pairs is skipped rather than fabricating an invalid `MarketCode`
 * or failing the whole listing — the same "never manufacture a
 * misleading value" principle this module already applies elsewhere
 * (e.g. `no_data` vs. a false zero). This should never happen against
 * real data (009_market_intelligence.sql's own check constraint already
 * pins the valid pairs at the database level), so it is not expected to
 * ever actually filter a row in production; it exists purely so a
 * genuinely malformed row is dropped visibly (via a caller inspecting
 * the returned count against what they expect) rather than surfacing an
 * invented market. A genuine query/configuration failure is still
 * reported as `"error"`, never silently downgraded to an empty list —
 * that distinction matters here exactly as much as it does for
 * `findMarketKeywordId`/`listMarketKeywordObservationsById` above.
 *
 * Ordered `keyword asc, country asc, id asc` — a stable, boring listing;
 * `id` is a final tie-break for the (rare) case of the same keyword
 * tracked for both markets under the same provider.
 */
export async function listTrackedMarketKeywords(): Promise<ListTrackedMarketKeywordsResult> {
	const supabase = await createSupabaseServerClient();
	if (!supabase) {
		return { status: "error", message: "Supabase isn't configured in this environment." };
	}

	const { data, error } = await supabase
		.from("market_keywords")
		.select("id, provider, keyword, country, language")
		.order("keyword", { ascending: true })
		.order("country", { ascending: true })
		.order("id", { ascending: true });

	if (error) return { status: "error", message: error.message };

	const rows: TrackedMarketKeyword[] = [];
	for (const row of (data ?? []) as RawTrackedMarketKeyword[]) {
		const market = toMarketCode(row.country, row.language);
		if (!market) continue;
		rows.push({ id: row.id, provider: row.provider as MarketIntelligenceProviderId, keyword: row.keyword, market });
	}

	return { status: "ok", rows };
}
