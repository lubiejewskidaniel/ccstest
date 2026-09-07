import type { MarketCode, MarketIntelligenceProvider, MarketKeywordObservation } from "../market/types";

/**
 * Bing Webmaster Tools `GetKeywordStats` — market-wide keyword demand
 * data, distinct from `BingWebmasterProvider.ts`'s `GetQueryStats` (which
 * is scoped to OUR OWN site's impressions/clicks and feeds
 * `search_performance_metrics`, not this module).
 *
 * Verified empirically against the live API (not from documentation
 * alone): `apikey` / `q` / `country` / `language` query params, no
 * `siteUrl` required (this endpoint is not site-scoped). Response shape
 * is `{"d": [{ "__type": "KeywordStats:#Microsoft.Bing.Webmaster.Api",
 * "BroadImpressions": number, "Date": "/Date(<ms>)/", "Impressions":
 * number, "Query": string }, ...]}`, with `{"d": []}` for a query Bing
 * has no data for. Bing does not document whether an empty result means
 * "no data exists" or "a real but suppressed low-volume query" — so an
 * empty `d` array is surfaced as `no_data`, never as a zero-impression
 * observation (see `market/types.ts`'s `MarketKeywordObservation` doc).
 *
 * Deliberately does NOT reuse `BingWebmasterProvider.ts`'s
 * `parseBingDate`, which silently returns `null` (and the caller drops
 * that row) on an unparseable date — acceptable there because
 * `GetQueryStats`'s dates are only ever used to filter an already-known
 * date range. Here, a malformed date fails the entire fetch instead: a
 * partial market history built from a response we couldn't fully parse
 * is worse than a visible provider_error.
 *
 * Silent no-op (`isConfigured()` false) until `BING_WEBMASTER_API_KEY` is
 * set — reuses the existing credential; no second Bing credential and no
 * `BING_WEBMASTER_SITE_URL` dependency, since this endpoint needs neither.
 */

type BingKeywordStat = {
	Query: string;
	Impressions: number;
	BroadImpressions: number;
	Date: string; // "/Date(1773471600000)/"
};

function parseBingPeriodStart(raw: string): string {
	const match = /^\/Date\((\d+)\)\/$/.exec(raw);
	if (!match) {
		throw new Error(`Bing GetKeywordStats: unrecognised date format ${JSON.stringify(raw)}`);
	}
	const ms = Number(match[1]);
	const date = new Date(ms);
	if (!Number.isFinite(ms) || ms <= 0 || Number.isNaN(date.getTime())) {
		throw new Error(`Bing GetKeywordStats: invalid date value ${JSON.stringify(raw)}`);
	}
	return date.toISOString().slice(0, 10);
}

export function createBingKeywordStatsProvider(): MarketIntelligenceProvider {
	const apiKey = process.env.BING_WEBMASTER_API_KEY;

	function isConfigured() {
		return Boolean(apiKey);
	}

	return {
		id: "bing",
		isConfigured,

		async fetchKeywordStats(keyword: string, market: MarketCode): Promise<MarketKeywordObservation[]> {
			if (!apiKey) return [];

			const params = new URLSearchParams({
				apikey: apiKey,
				q: keyword,
				country: market.country,
				language: market.language,
			});

			const res = await fetch(`https://ssl.bing.com/webmaster/api.svc/json/GetKeywordStats?${params.toString()}`);

			if (!res.ok) {
				const body = await res.text().catch(() => "");
				// Never include the request URL in an error message — it
				// carries the API key in its query string.
				throw new Error(`Bing GetKeywordStats failed (${res.status}): ${body.slice(0, 300)}`);
			}

			const data = (await res.json()) as { d?: BingKeywordStat[] };
			const rows = data.d ?? [];

			if (rows.length === 0) return [{ status: "no_data" }];

			// Parse every date before returning anything — a single
			// malformed entry throws and fails the whole fetch, rather
			// than silently returning a partial, incomplete history.
			return rows.map(
				(row): MarketKeywordObservation => ({
					status: "observed",
					periodStart: parseBingPeriodStart(row.Date),
					impressions: row.Impressions,
					providerDetails: { provider: "bing", broadImpressions: row.BroadImpressions },
				}),
			);
		},
	};
}
