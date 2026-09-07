import { getAdminSession } from "@/lib/supabase/adminAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createBingKeywordStatsProvider } from "../bing/BingKeywordStatsProvider";
import type { MarketCode, MarketIntelligenceProvider, MarketKeywordObservation } from "./types";

export type FetchMarketKeywordStatsResult =
	| { ok: true; observedCount: number; noDataCount: number }
	| { ok: false; kind: "auth"; message: string }
	| { ok: false; kind: "not_configured"; message: string }
	| { ok: false; kind: "provider_error"; message: string }
	| { ok: false; kind: "storage_error"; message: string };

function providers(): MarketIntelligenceProvider[] {
	return [createBingKeywordStatsProvider()];
}

/**
 * Fetches market-wide keyword-demand data for ONE explicit keyword in
 * ONE explicit market from every configured market-intelligence
 * provider, and persists it.
 *
 * Deliberately takes a single keyword + market as parameters rather than
 * discovering keywords itself, looping over a stored list, or running on
 * a schedule — keyword discovery and scheduling are later-phase work
 * (see the Phase 3B.1 architecture report's explicit scope boundary).
 * This is the smallest pipeline that proves provider -> canonical model
 * -> storage -> read layer end to end; something else (a script, or a
 * future admin action — out of scope for this phase) is what calls this
 * with a keyword.
 *
 * `market_keywords` is upserted by its natural key (provider, keyword,
 * country, language) so this function is safe to call repeatedly for
 * the same keyword. `observed` rows upsert on
 * (market_keyword_id, period_start) so re-fetching an already-seen
 * period refreshes it instead of duplicating. `no_data` rows always
 * insert new rows — deliberately not deduplicated in this phase (see
 * the architecture report: "keep the current simple append-only design
 * for Phase 3B.1"), so repeatedly fetching a keyword that stays empty
 * appends one no_data row per attempt. That is legitimate history (it
 * answers "did we check, and when"), not noise to be collapsed.
 *
 * provider_error is never persisted: a thrown fetchKeywordStats() error
 * short-circuits this function before anything is written for that
 * provider — mirrors `ingestSearchPerformance()`'s "a real API failure
 * should surface clearly, not silently look like no data" contract.
 * A storage failure (the Bing call succeeded but writing to Supabase
 * failed) is reported as its own `storage_error` kind rather than folded
 * into `provider_error` — the two are different failures with different
 * remedies, and this whole phase's design principle is to never collapse
 * distinct states into one.
 */
export async function fetchMarketKeywordStats(keyword: string, market: MarketCode): Promise<FetchMarketKeywordStatsResult> {
	const session = await getAdminSession();
	if (!session?.isEditor) return { ok: false, kind: "auth", message: "You must be signed in as an editor to do this." };

	const active = providers().filter((provider) => provider.isConfigured());
	if (active.length === 0) {
		return {
			ok: false,
			kind: "not_configured",
			message: "No market intelligence provider is configured. Set BING_WEBMASTER_API_KEY.",
		};
	}

	const supabase = await createSupabaseServerClient();
	if (!supabase) {
		return { ok: false, kind: "not_configured", message: "Supabase isn't configured in this environment." };
	}

	let observedCount = 0;
	let noDataCount = 0;

	for (const provider of active) {
		let observations: MarketKeywordObservation[];
		try {
			observations = await provider.fetchKeywordStats(keyword, market);
		} catch (err) {
			return {
				ok: false,
				kind: "provider_error",
				message: `${provider.id} market keyword fetch failed: ${err instanceof Error ? err.message : String(err)}`,
			};
		}

		const { data: keywordRow, error: keywordError } = await supabase
			.from("market_keywords")
			.upsert(
				{ provider: provider.id, keyword, country: market.country, language: market.language },
				{ onConflict: "provider,keyword,country,language" },
			)
			.select("id")
			.single();

		if (keywordError || !keywordRow) {
			return {
				ok: false,
				kind: "storage_error",
				message: `Storing market_keywords row failed: ${keywordError?.message ?? "no row returned"}`,
			};
		}

		const keywordId = (keywordRow as { id: string }).id;

		const observedRows = observations.filter(
			(o): o is Extract<MarketKeywordObservation, { status: "observed" }> => o.status === "observed",
		);
		const noDataRows = observations.filter((o) => o.status === "no_data");

		if (observedRows.length > 0) {
			const { error } = await supabase.from("market_keyword_observations").upsert(
				observedRows.map((o) => ({
					market_keyword_id: keywordId,
					status: "observed" as const,
					period_start: o.periodStart,
					impressions: o.impressions,
					// providerDetails is a discriminated union (currently
					// just Bing) -- narrow on its own `provider` tag rather
					// than assuming every observation carries Bing-shaped
					// details, so a future non-Bing provider's rows simply
					// store null here instead of needing a code change.
					broad_impressions: o.providerDetails?.provider === "bing" ? o.providerDetails.broadImpressions : null,
				})),
				{ onConflict: "market_keyword_id,period_start" },
			);
			if (error) return { ok: false, kind: "storage_error", message: `Storing observed rows failed: ${error.message}` };
			observedCount += observedRows.length;
		}

		if (noDataRows.length > 0) {
			const { error } = await supabase.from("market_keyword_observations").insert(
				noDataRows.map(() => ({
					market_keyword_id: keywordId,
					status: "no_data" as const,
					period_start: null,
					impressions: null,
					broad_impressions: null,
				})),
			);
			if (error) return { ok: false, kind: "storage_error", message: `Storing no_data rows failed: ${error.message}` };
			noDataCount += noDataRows.length;
		}
	}

	return { ok: true, observedCount, noDataCount };
}
