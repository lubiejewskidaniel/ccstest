/**
 * Canonical, provider-independent types for external market-keyword
 * demand data (Phase 3B.1) — deliberately separate from
 * `types/searchProvider.ts`, which describes OUR OWN site's search
 * performance (a different concept: "how do we rank" vs. "how much
 * demand exists for this term at all"). Nothing here should be merged
 * into `search_performance_metrics` or `SearchPerformanceProvider`.
 */

/**
 * Explicit market inputs only — never inferred from the keyword text
 * itself (a query like "seo" says nothing about which country/language
 * market it was asked in). A discriminated union rather than two
 * independent fields: `{ country: "gb" | "pl"; language: "en-GB" |
 * "pl-PL" }` would let a caller construct the nonsensical
 * `{ country: "gb", language: "pl-PL" }` and only a runtime check (or
 * the database's own cross-field constraint — see
 * 009_market_intelligence.sql) could catch it. This shape makes that
 * combination unrepresentable at the type level instead. Scoped to
 * exactly the two markets this phase needs; adding a market later means
 * adding a member to this union (and widening the database's matching
 * check constraint), not automatic inference.
 */
export type MarketCode = { country: "gb"; language: "en-GB" } | { country: "pl"; language: "pl-PL" };

/**
 * Bing-specific extra metrics for one observation: BroadImpressions
 * (impressions across broad-matched queries containing the keyword, not
 * just the exact keyword). Tagged with `provider: "bing"` so it's one
 * member of the `MarketObservationDetails` discriminated union below,
 * not a flat optional field living directly on the core observation
 * type.
 */
export type BingObservationDetails = {
	provider: "bing";
	broadImpressions: number;
};

/**
 * Discriminated union of every provider's observation-details shape.
 * Adding a new provider with its own extra metrics (e.g. a future
 * Google Trends "relative interest index") means adding a new member
 * here — `{ provider: "google_trends"; relativeInterest: number }` —
 * not adding another optional field to `MarketKeywordObservation`
 * itself. The core observation contract stays provider-neutral no
 * matter how many providers this grows to.
 */
export type MarketObservationDetails = BingObservationDetails;

/**
 * One market-demand data point, or an explicit absence of one.
 *
 * `status: "no_data"` and `status: "observed"` are kept as distinct
 * variants rather than an `observed` row with `impressions: 0` — see
 * the Phase 3B.1 architecture report for why: Bing's own documentation
 * does not say whether an empty result means "no data exists" or
 * "a real but suppressed low-volume query", so this type must not
 * collapse that uncertainty into a false zero.
 *
 * `impressions` is required (not nullable) for an `observed` row —
 * mirrored exactly by the database's NOT NULL/CHECK invariants in
 * 009_market_intelligence.sql, so there is no way to construct an
 * "observed but we don't actually know the volume" value that would
 * only fail once it reached storage.
 *
 * A third state — the provider request itself failing (bad HTTP status,
 * malformed response, unparseable date) — is deliberately NOT a value of
 * this type at all. `MarketIntelligenceProvider.fetchKeywordStats`
 * throws in that case; nothing is persisted from a failed request. See
 * `fetchMarketKeywordStats.ts`.
 */
export type MarketKeywordObservation =
	| {
			status: "observed";
			/** ISO date (YYYY-MM-DD) — the start of the period this
			 * observation covers. Deliberately not called "week": Bing
			 * happens to report weekly buckets, but this type must not
			 * assume any particular cadence for a future provider. */
			periodStart: string;
			impressions: number;
			/** Provider-specific extras that don't belong in the core
			 * contract. See `MarketObservationDetails`'s doc comment. */
			providerDetails?: MarketObservationDetails;
	  }
	| {
			status: "no_data";
	  };

/** Known provider identifiers. Extend this union (and implement a new
 * `MarketIntelligenceProvider`) to add a provider. This is a
 * TypeScript-only gate — `market_keywords.provider` in the database is
 * an unconstrained `text` column on purpose, so recognising a new
 * provider is never a schema migration (see 009_market_intelligence.sql
 * and the Phase 3B.1 architecture report's provider-constraint
 * correction). */
export type MarketIntelligenceProviderId = "bing";

export type MarketIntelligenceProvider = {
	id: MarketIntelligenceProviderId;
	/** Whether the env vars this provider needs are present — the same
	 * "silent no-op until configured" contract as
	 * `SearchPerformanceProvider.isConfigured()`. */
	isConfigured: () => boolean;
	/**
	 * Fetches demand data for one keyword in one market. Returns an
	 * empty array when not configured (never called in that state by
	 * `fetchMarketKeywordStats`, but kept consistent with the house
	 * "no-op, don't throw" convention for an unconfigured provider).
	 *
	 * Throws for a genuine request failure: non-2xx response, malformed
	 * JSON, or an unparseable observation date. Callers treat a thrown
	 * error as `provider_error` and persist nothing from that call — a
	 * partial market history built from a response that couldn't be
	 * fully parsed is more dangerous than a visible failure.
	 */
	fetchKeywordStats: (keyword: string, market: MarketCode) => Promise<MarketKeywordObservation[]>;
};
