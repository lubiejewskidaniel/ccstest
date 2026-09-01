/**
 * Types shared by every search-performance provider
 * (`content-intelligence/google`, `content-intelligence/bing`) and the
 * ingestion/scoring code that consumes them. This is the first module
 * created under `content-intelligence/` — deliberately narrow (just
 * `types/`, `google/`, `bing/`, `keywords/`, `opportunities/`,
 * `planner/`), matching only what Checkpoint 6 needs (docs/INSIGHTS_
 * ARCHITECTURE.md §7 — no folders created merely to match the master
 * instruction's full target diagram).
 */

export type SearchDataSource = "google" | "bing";

export type RawSearchMetricRow = {
	source: SearchDataSource;
	query: string;
	/** Null for providers that only report query-level stats without a
	 * page dimension (Bing's `GetQueryStats`) — see docs/INSIGHTS_
	 * DATABASE.md-equivalent note in the Checkpoint 6 migration. */
	pageUrl: string | null;
	/** ISO date (YYYY-MM-DD), one row per day per query/page. */
	date: string;
	clicks: number;
	impressions: number;
	ctr: number;
	position: number | null;
};

export type SearchPerformanceProvider = {
	id: SearchDataSource;
	/** Whether the env vars this provider needs are present — the same
	 * "silent no-op until configured" contract as `src/lib/crm`'s
	 * `CRMProvider.isConfigured()`. */
	isConfigured: () => boolean;
	/** Fetches raw metric rows for the given date range. Returns an empty
	 * array (never throws) when not configured; a real API failure DOES
	 * throw, since ingestion is an explicit, editor-triggered action that
	 * should surface a clear error rather than silently look like "no
	 * data" (unlike the fire-and-forget CRM sync, which must never fail a
	 * page load). */
	fetchQueries: (range: { startDate: string; endDate: string }) => Promise<RawSearchMetricRow[]>;
};
