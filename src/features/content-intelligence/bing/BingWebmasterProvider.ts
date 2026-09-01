import type { SearchPerformanceProvider, RawSearchMetricRow } from "../types/searchProvider";

/**
 * Bing Webmaster Tools `GetQueryStats` endpoint — simple API-key auth (no
 * OAuth flow, unlike Google). Verified against Bing's own documented
 * response shape: an array under `d`, each entry with `Query`,
 * `Clicks`, `Impressions`, `AvgClickPosition`, `AvgImpressionPosition`,
 * and a `Date` field in the WCF `/Date(<epoch-ms>)/` format rather than
 * ISO 8601.
 *
 * Two real constraints this provider works around rather than hides:
 * - `GetQueryStats` has no page dimension (unlike Google's
 *   `searchAnalytics/query` with `dimensions: ["query","page","date"]`),
 *   so `pageUrl` is always null here — see the nullable column comment
 *   in `supabase/migrations/005_search_intelligence.sql`.
 * - It has no date-range parameter — Bing returns whatever weekly-bucket
 *   history it currently has for the site, and the `startDate`/`endDate`
 *   this provider receives are used only to *filter* the response
 *   client-side, not to shape the request.
 *
 * Silent no-op until `BING_WEBMASTER_API_KEY` and
 * `BING_WEBMASTER_SITE_URL` are both set.
 */

type BingQueryStat = {
	Query: string;
	Clicks: number;
	Impressions: number;
	AvgClickPosition: number;
	AvgImpressionPosition: number;
	Date: string; // "/Date(1399100400000)/"
};

function parseBingDate(raw: string): string | null {
	const match = /\/Date\((\d+)/.exec(raw);
	if (!match) return null;
	return new Date(Number(match[1])).toISOString().slice(0, 10);
}

export function createBingWebmasterProvider(): SearchPerformanceProvider {
	const apiKey = process.env.BING_WEBMASTER_API_KEY;
	const siteUrl = process.env.BING_WEBMASTER_SITE_URL;

	function isConfigured() {
		return Boolean(apiKey && siteUrl);
	}

	return {
		id: "bing",
		isConfigured,

		async fetchQueries({ startDate, endDate }): Promise<RawSearchMetricRow[]> {
			if (!apiKey || !siteUrl) return [];

			const url = `https://ssl.bing.com/webmaster/api.svc/json/GetQueryStats?apikey=${encodeURIComponent(apiKey)}&siteUrl=${encodeURIComponent(siteUrl)}`;
			const res = await fetch(url);

			if (!res.ok) {
				const body = await res.text().catch(() => "");
				throw new Error(`Bing Webmaster query failed (${res.status}): ${body.slice(0, 300)}`);
			}

			const data = (await res.json()) as { d?: BingQueryStat[] };
			const rows = data.d ?? [];

			return rows
				.map((row): RawSearchMetricRow | null => {
					const date = parseBingDate(row.Date);
					if (!date || date < startDate || date > endDate) return null;
					const impressions = row.Impressions ?? 0;
					const clicks = row.Clicks ?? 0;
					return {
						source: "bing" as const,
						query: row.Query,
						pageUrl: null,
						date,
						clicks,
						impressions,
						ctr: impressions > 0 ? clicks / impressions : 0,
						position: row.AvgClickPosition || row.AvgImpressionPosition || null,
					};
				})
				.filter((row): row is RawSearchMetricRow => row !== null);
		},
	};
}
