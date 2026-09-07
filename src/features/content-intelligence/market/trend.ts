/**
 * Phase 3B.2 — Market Trend Intelligence.
 *
 * Pure, deterministic, explainable trend evaluation over externally observed
 * market-demand data (currently Bing Keyword Stats, via
 * `MarketKeywordObservationRow` from `./queries`). No AI/LLM, no Supabase
 * access, no side effects — this module is handed already-fetched
 * observation rows and returns a result, derived at read time. It performs
 * no I/O and requires no new migration.
 *
 * -- Relationship to first-party Trend Intelligence (`opportunities/trend.ts`) --
 * This module is a deliberately SEPARATE, NOT-shared evaluator. It borrows
 * first-party's general philosophy (pure function; retained evidence, not
 * just a verdict; named v1-engineering-default thresholds; a history-depth
 * classification distinct from the trend verdict; volatility defined as
 * material, opposing movement, not a bare sign flip) but does NOT reuse its
 * code, its thresholds, or its comparison model, because external market
 * data is a fundamentally different dataset:
 *   - First-party evaluates our OWN performance history, fetched on a
 *     schedule we control. This module evaluates EXTERNAL provider data
 *     (Bing), fetched on a cadence we do not control and that can have real
 *     gaps (see the cadence/gap model below).
 *   - A real 25-week Bing sample collected during Phase 3B.1 measures a
 *     coefficient of variation of ~48% (strict impressions) and ~39%
 *     (broad impressions) — far noisier than first-party's own metrics.
 *     First-party's 10-15% materiality thresholds would misfire on nearly
 *     every comparison of this data, which is why this module uses a much
 *     wider 30% threshold (see MATERIAL_RELATIVE_CHANGE below), derived
 *     from that real sample rather than ported from first-party.
 * `opportunities/trend.ts` is not modified by this module and is not
 * imported by it.
 *
 * -- No combined score --------------------------------------------------
 * Unlike first-party (which synthesises multiple metrics into one
 * `direction` via `opportunity_score`), there is no single combined market
 * score yet, so `MarketTrendResult` has no top-level `direction`. Strict
 * keyword-level demand (`impressions`) and broad topic-level demand
 * (`broadImpressions`) are modelled and evaluated FULLY INDEPENDENTLY of
 * each other, because they can genuinely diverge (e.g. broad topic interest
 * rising while a specific keyword phrasing's interest declines) and because
 * they can have different usable period sets: migration 009 does not
 * require `broad_impressions` to be non-null on `observed` rows (only
 * `impressions` is forced non-null), so a period can be a usable strict
 * data point while being unusable for the broad metric, or vice versa.
 * Every per-metric evidence field (`historyDepth`, `firstPeriod`,
 * `latestPeriod`, `periodsUsed`, `cadenceTrusted`, `observedGapCount`,
 * `duplicatePeriodCount`, and the comparison fields) is computed
 * independently for strict and broad. Only genuinely fetch-level/
 * provider-level evidence (`latestFetchStatus`, `recentNoDataCount`) lives
 * at the top level of `MarketTrendResult`.
 *
 * -- no_data semantics ----------------------------------------------------
 * A `no_data` observation (the provider's keyword-stats endpoint returned
 * no rows for the requested period) is NEVER treated as zero demand, and
 * NEVER by itself implies a declining trend. `no_data` rows carry no
 * numeric period/value (see migration 009's compound check constraint) and
 * are therefore structurally excluded from every mean/window/gap
 * computation below — they contribute only to the top-level
 * `recentNoDataCount` evidence, which a caller can use to note "provider
 * has recently reported no measurable demand" without this module ever
 * converting that into a numeric zero or a "declining" verdict.
 *
 * -- Fetch-attempt grouping for top-level evidence (v1 inference) -----------
 * `latestFetchStatus` and `recentNoDataCount` describe FETCH ATTEMPTS, not
 * raw rows — and a single fetch attempt does not correspond to a single row.
 * `fetchMarketKeywordStats()` persists every `observed` row from one fetch
 * in a single `.upsert()` statement (and every `no_data` row from one fetch
 * in a single `.insert()`), and migration 009's `fetched_at` column default
 * (`default now()`) evaluates once per statement — so ALL rows written by
 * one fetch attempt share one exact `fetched_at` value, whether that
 * attempt produced one `no_data` row or dozens of weekly `observed` rows.
 * Counting raw rows (as an earlier version of this module did) is therefore
 * misleading: one `no_data` attempt is always exactly 1 row, while one
 * `observed` attempt can be dozens of rows, so "the most recent N rows"
 * ends up dominated by whichever attempt happened most recently in bulk
 * rather than reflecting the most recent N attempts.
 *
 * This module instead groups ALL input rows (both statuses, ignoring which
 * metric they belong to — this is fetch-level, not per-metric, evidence) by
 * their exact `fetchedAt` value. Each distinct `fetchedAt` is treated as one
 * fetch attempt; an attempt is classified `"observed"` if its group contains
 * any `observed` row, else `"no_data"`. Groups are sorted newest-first by
 * `fetchedAt`; `latestFetchStatus` is the newest group's classification, and
 * `recentNoDataCount` counts how many of the most recent `WINDOW_SIZE`
 * groups are classified `"no_data"`.
 *
 * This is a V1 INFERENCE built on today's persistence code, not a
 * schema-level guarantee — there is no explicit fetch/attempt identifier
 * column (and this phase deliberately does not add one; migration 010 is
 * out of scope). If a future change ever wrote one attempt's rows across
 * multiple statements (and therefore multiple `fetched_at` values), this
 * grouping would see that as multiple attempts rather than one — a
 * degradation, but not a silent one: it would still produce a real
 * timestamp-keyed group for every row, never merge or drop evidence.
 *
 * -- Missing weeks ----------------------------------------------------------
 * Missing periods (weeks the provider never reported at all — no row of
 * either status) are NEVER filled with zero and NEVER interpolated. All
 * windowing and comparisons operate only over periods that were actually
 * observed with a real numeric value for the metric in question. Gaps
 * between observed periods are surfaced as evidence (`observedGapCount`,
 * and — when a gap falls across the comparison boundary — forced
 * `insufficient_data`; see below) rather than papered over.
 *
 * -- Cadence and gap detection (v1 rule) -----------------------------------
 * This engine never hardcodes a provider-specific cadence (e.g. Bing's
 * typical 7-day spacing) — cadence is always inferred from the data, and
 * only trusted once there is enough evidence to estimate it:
 *   1. Compute the gaps (in days) between each pair of consecutive usable,
 *      sorted, deduplicated periods for the metric being evaluated.
 *   2. Cadence is TRUSTED only when there are at least MIN_GAP_SAMPLES such
 *      consecutive-gap observations (i.e. at least MIN_GAP_SAMPLES + 1
 *      usable periods). Below that, `cadenceTrusted` is `false` and gap
 *      detection degrades conservatively: `observedGapCount` is reported as
 *      0 and no gap can force `insufficient_data` — this is a "we don't
 *      know yet" state, never "there is no gap" or an invented cadence.
 *   3. When trusted, `medianGapDays` = the median of those gaps.
 *   4. A "large gap" is any consecutive gap >= `medianGapDays * GAP_MULTIPLIER`.
 *      Every large gap anywhere in the usable history increments the
 *      metric's `observedGapCount`.
 *   5. If a large gap falls specifically at the boundary between the prior
 *      comparison window and the recent comparison window, the two windows
 *      are not being compared over a consistent cadence, so the metric's
 *      direction is forced to `insufficient_data` (a rise or fall spanning
 *      that gap could easily be an artifact of the missing weeks, not real
 *      demand movement). A large gap elsewhere in the history still counts
 *      toward `observedGapCount` but does not by itself force
 *      `insufficient_data`.
 *
 * -- Comparison model (v1 rule) ---------------------------------------------
 * Recent-window mean vs. prior-window mean, using only usable
 * (non-duplicated, non-`no_data`) periods, sorted chronologically
 * (regardless of input order). WINDOW_SIZE means an ACTUAL four-period
 * window on both sides, never a smaller or shrinking one:
 *   - Fewer than 2 * WINDOW_SIZE usable periods total -> `insufficient_data`
 *     for every metric, regardless of how many periods exist below that
 *     (a comparison is only ever attempted once a full window is available
 *     on both sides — there is no partial or shrinking comparison).
 *   - At 2 * WINDOW_SIZE or more usable periods, the "recent" window is
 *     exactly the most recent WINDOW_SIZE periods, and the "prior" window is
 *     exactly the WINDOW_SIZE periods immediately before it (any older
 *     periods beyond those 2 * WINDOW_SIZE are not used by the comparison,
 *     though they still count toward `periodsUsed`/`historyDepth` and gap
 *     detection).
 *   - `relativeChange = (recentMean - priorMean) / priorMean`, computed
 *     ONLY when both means are >= MIN_BASELINE_MEAN (see below).
 *   - `relativeChange >= MATERIAL_RELATIVE_CHANGE` -> "rising";
 *     `relativeChange <= -MATERIAL_RELATIVE_CHANGE` -> "declining";
 *     otherwise -> "stable" (subject to the volatility check below, which
 *     takes priority).
 *
 * -- Low-volume / zero-baseline safety floor (v1 rule) -----------------------
 * `MIN_BASELINE_MEAN` is a V1 SAFETY FLOOR, NOT an empirically calibrated
 * threshold (unlike MATERIAL_RELATIVE_CHANGE, which IS grounded in the real
 * sample's measured noise level). It exists to prevent one precise
 * mathematical failure mode: computing `relativeChange` against a baseline
 * mean of zero or near-zero, which either divides by zero (undefined) or
 * produces an enormous, misleading percentage swing from a trivially small
 * absolute change (2 -> 8 impressions is "+300%" but is really just noise
 * at these volumes).
 *
 * Exact rule: if EITHER the prior-window mean or the recent-window mean is
 * below MIN_BASELINE_MEAN (including exactly 0), the metric's direction is
 * `insufficient_data` and `relativeChange` is `null` — no division is ever
 * attempted. This resolves every zero/near-zero combination without ever
 * producing `NaN` or `Infinity`:
 *   - priorMean = 0, recentMean = 0            -> insufficient_data (0/0 never attempted)
 *   - priorMean = 0, recentMean > 0 (any size)  -> insufficient_data (no prior baseline to compare against, however large the jump)
 *   - priorMean in (0, MIN_BASELINE_MEAN), recentMean materially higher -> insufficient_data (too thin a baseline; this is exactly the "tiny counts read as huge % growth" failure mode the floor prevents)
 * The same floor is reused (see below) inside the volatility check, for the
 * identical reason.
 *
 * -- Volatility (v1 rule) ---------------------------------------------------
 * Never evaluated on raw weekly points — only on SMOOTHED, non-overlapping
 * windows, because raw weekly noise in real Bing data alternates sign on
 * nearly every consecutive pair (verified against the real 25-week sample:
 * a naive raw-point reversal check would misclassify it as "volatile").
 * Rule:
 *   1. Split the metric's full usable, sorted history into non-overlapping
 *      buckets of WINDOW_SIZE periods each (most recent periods first;
 *      any older leading remainder that doesn't fill a full bucket is
 *      dropped).
 *   2. Use up to VOLATILITY_MAX_WINDOWS of the most recent such buckets.
 *      Volatility is only evaluated when at least VOLATILITY_MIN_WINDOWS
 *      buckets are available; below that, this metric simply cannot be
 *      volatile yet (falls through to the ordinary rising/declining/stable
 *      comparison above).
 *   3. Compute each bucket's mean, then each consecutive bucket-to-bucket
 *      relative change. A transition is "material" only when BOTH bucket
 *      means are >= MIN_BASELINE_MEAN (the same floor as above, for the
 *      same reason) AND the relative change's magnitude is >=
 *      MATERIAL_RELATIVE_CHANGE.
 *   4. "Volatile" requires EVERY available transition to be material AND
 *      for their directions to strictly alternate (up, down, up, ... or
 *      down, up, down, ...). This is deliberately stronger than "contains
 *      at least one up and one down somewhere" (first-party's own rule,
 *      applied to raw points) — a single flip amid otherwise quiet or
 *      ambiguous smoothed data is NOT volatile, it is exactly the "bare
 *      sign flip" this design is meant to reject. Only a persistent,
 *      fully-alternating zigzag across the entire recent smoothed window
 *      is reported as "volatile". Verified against the real Bing sample
 *      (whose smoothed transitions are up, down, then a non-material
 *      third move) to correctly classify as NOT volatile.
 *
 * -- Duplicate periods (v1 rule) ---------------------------------------------
 * The unique index on (market_keyword_id, period_start) in migration 009
 * should make duplicate `periodStart` values impossible for canonically
 * persisted, usable rows of a single metric. If they appear anyway, this
 * module treats it as an UPSTREAM INVARIANT VIOLATION, not a normal input
 * shape to silently resolve:
 *   - Duplicate detection happens per metric, AFTER filtering to that
 *     metric's own usable rows (i.e. after excluding rows where this
 *     metric's value is null). Because an `observed` row can legitimately
 *     have `broadImpressions: null`, a period duplicated in the raw input
 *     does not necessarily mean both the strict AND broad metrics see a
 *     duplicate for that period — each metric's duplicate detection is
 *     fully independent (a duplicate affecting strict does not force broad
 *     to `insufficient_data` unless broad's own usable rows also contain
 *     that duplicate).
 *   - `duplicatePeriodCount` is the TOTAL NUMBER OF EXCESS ROWS across
 *     duplicated periods for that metric — NOT the number of affected
 *     periods. Formally, given `rowsForPeriod` = the count of usable rows
 *     sharing one `periodStart` value for this metric:
 *
 *       duplicatePeriodCount = sum over distinct periods of max(0, rowsForPeriod - 1)
 *
 *     Examples (usable-row counts per period):
 *       1,1,1 -> 0        2,1,1 -> 1        2,2,1 -> 2
 *       3,1,1 -> 2        2,1,3 -> 3
 *
 *   - When `duplicatePeriodCount > 0`, that metric's direction is forced to
 *     `insufficient_data` and `duplicatePeriodCount` is exposed as
 *     evidence, rather than silently picking one row (e.g. the newest by
 *     `fetchedAt`) and proceeding as if nothing were wrong. A future
 *     Recommendation Engine that only sees this derived result — not the
 *     raw observations — must be able to see that something is wrong,
 *     rather than receiving a trend verdict computed over corrupted input.
 *     (For `duplicatePeriodCount` itself to be computable at all without
 *     the function crashing, the affected metric's period list IS
 *     defensively deduplicated internally — keeping one row per period,
 *     the one with the latest `fetchedAt` — but that deduplicated data is
 *     never used to produce a direction, since the metric is already
 *     forced to `insufficient_data`.)
 */

import type { MarketKeywordObservationRow } from "./queries";

// ---------------------------------------------------------------------------
// Public constants — v1 engineering defaults.
//
// None of these are empirically "correct" in an absolute sense. Several
// (MATERIAL_RELATIVE_CHANGE, WINDOW_SIZE) were chosen by reasoning about a
// real 25-week Bing sample collected during Phase 3B.1; others
// (MIN_BASELINE_MEAN, MIN_GAP_SAMPLES, GAP_MULTIPLIER,
// VOLATILITY_MIN_WINDOWS, VOLATILITY_MAX_WINDOWS) are safety/evidence
// floors whose mathematical purpose is documented on each constant, not
// empirically calibrated numbers. All are expected to be revisited as more
// real-world market data accumulates across more keywords and providers.
// ---------------------------------------------------------------------------

/**
 * Exact size of BOTH the "recent" and "prior" comparison windows, in
 * periods (not a maximum that shrinks when history is thin), and the
 * bucket size used to smooth history for volatility detection. A
 * directional comparison requires 2 * WINDOW_SIZE usable periods total —
 * a full window on both sides — or the metric is `insufficient_data` (see
 * `evaluateMetric`).
 */
export const WINDOW_SIZE = 4;

/**
 * Minimum number of consecutive-period gap observations required before an
 * inferred cadence (typical spacing between periods) is trusted enough to
 * drive gap detection. Below this, gap detection degrades conservatively
 * (reports zero large gaps, never forces `insufficient_data` from a gap)
 * rather than inventing a cadence from too little evidence. This engine
 * never hardcodes a provider-specific cadence (e.g. Bing's typical 7-day
 * spacing) into the provider-neutral trend model.
 */
export const MIN_GAP_SAMPLES = 4;

/**
 * A gap between two consecutive usable periods is "large" when it is at
 * least this many times the (trusted) inferred median gap.
 */
export const GAP_MULTIPLIER = 2;

/**
 * Minimum relative change between the recent-window mean and the
 * prior-window mean (or, for volatility, between consecutive smoothed
 * bucket means) required to call a comparison "material" rather than
 * "stable"/non-material. Chosen from the real Bing sample's measured noise
 * level (~39-48% coefficient of variation across strict/broad impressions),
 * where first-party Trend Intelligence's 10-15% thresholds would misfire on
 * nearly every comparison of this dataset.
 */
export const MATERIAL_RELATIVE_CHANGE = 0.3;

/**
 * V1 SAFETY FLOOR, not an empirically calibrated threshold. If either side
 * of a comparison (a window mean, or — for volatility — a bucket mean) is
 * below this value, that comparison is not attempted: the metric (or that
 * specific bucket transition) is treated as `insufficient_data` /
 * non-material rather than computing a relative change. This exists to
 * prevent one precise mathematical failure mode: dividing by, or comparing
 * against, a near-zero baseline mean, which either produces an undefined or
 * infinite relative change, or a misleadingly large percentage swing from a
 * trivially small absolute count (e.g. 2 -> 8 impressions is "+300%" but is
 * really just noise at these volumes). See the module doc comment for the
 * exact zero/near-zero semantics this guarantees.
 */
export const MIN_BASELINE_MEAN = 5;

/** Minimum number of smoothed buckets required to evaluate volatility at all. */
export const VOLATILITY_MIN_WINDOWS = 3;

/** Maximum number of most-recent smoothed buckets used to evaluate volatility. */
export const VOLATILITY_MAX_WINDOWS = 4;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type MarketTrendDirection = "rising" | "declining" | "stable" | "volatile" | "insufficient_data";

/**
 * Qualitative history depth, not a statistical confidence score — no
 * percentage is invented here, mirroring first-party's own
 * `TrendHistoryDepth` naming philosophy (though the exact tiers differ,
 * since this module's unit of comparison is a windowed mean, not a
 * baseline-vs-latest snapshot).
 *   - "none": zero usable periods.
 *   - "minimal": 1 to WINDOW_SIZE - 1 usable periods.
 *   - "limited": WINDOW_SIZE to 2 * WINDOW_SIZE - 1 usable periods — some
 *     useful history exists, but not enough for the full 4-vs-4 comparison;
 *     a metric in this tier is ALWAYS `insufficient_data` (a full recent
 *     window and a full prior window both require 2 * WINDOW_SIZE periods
 *     — see `evaluateMetric`).
 *   - "established": 2 * WINDOW_SIZE or more usable periods — a full
 *     4-vs-4 directional comparison is attempted (subject to the gap,
 *     duplicate, and low-volume checks below).
 */
export type MarketTrendHistoryDepth = "none" | "minimal" | "limited" | "established";

/**
 * Full evidence for one metric's (strict or broad) trend — not just its
 * label. Every field here is specific to THIS metric's own usable period
 * set; strict and broad are evaluated fully independently (see module doc
 * comment), so these are never shared or aggregated across the two.
 */
export type MarketMetricTrendEvidence = {
	direction: MarketTrendDirection;
	historyDepth: MarketTrendHistoryDepth;
	/** Count of distinct, usable periods for this metric after defensive
	 * deduplication (see `duplicatePeriodCount`). */
	periodsUsed: number;
	firstPeriod: string | null;
	latestPeriod: string | null;
	/** Mean of the recent-window's usable values, or `null` when not
	 * computed (fewer than 2 * WINDOW_SIZE usable periods, a duplicate/gap
	 * anomaly, or the low-volume floor — see `relativeChange`). */
	recentMean: number | null;
	/** Mean of the prior-window's usable values, or `null` under the same
	 * conditions as `recentMean`. */
	priorMean: number | null;
	/** Fraction, e.g. `0.3` = +30%. `null` whenever `direction` is
	 * `insufficient_data` (never `NaN`/`Infinity`). */
	relativeChange: number | null;
	/** Whether the metric's own period history had enough consecutive-gap
	 * samples (see `MIN_GAP_SAMPLES`) to trust an inferred cadence. When
	 * `false`, `observedGapCount` is always 0 and no gap can force
	 * `insufficient_data` — cadence was never invented from too little
	 * evidence. */
	cadenceTrusted: boolean;
	/** Count of large gaps (see module doc comment) found anywhere across
	 * this metric's usable period history. Always 0 when `cadenceTrusted`
	 * is `false`. */
	observedGapCount: number;
	/** Total excess usable rows across duplicated `periodStart` values for
	 * this metric — see the module doc comment for the exact formula and
	 * examples. `0` in the normal/expected case (the database's unique
	 * index should make this structurally impossible for canonical data).
	 * A non-zero value here always forces `direction: "insufficient_data"`. */
	duplicatePeriodCount: number;
};

export type MarketTrendResult = {
	/** Classification of the most recent FETCH ATTEMPT (rows grouped by
	 * exact `fetchedAt` — see the module doc comment's "Fetch-attempt
	 * grouping" section), across ALL input rows regardless of metric — this
	 * is fetch-level evidence, not specific to strict or broad. `"none"`
	 * when no rows were provided at all. */
	latestFetchStatus: "observed" | "no_data" | "none";
	/** Count of `no_data` FETCH ATTEMPTS (not raw rows) among the most
	 * recent WINDOW_SIZE distinct-`fetchedAt` attempt groups — a fetch-level
	 * signal that the provider has recently reported no measurable demand at
	 * all. Grouping by attempt (rather than counting rows) matters because
	 * one `observed` attempt can persist dozens of weekly rows sharing one
	 * `fetchedAt`, while one `no_data` attempt is always exactly one row —
	 * see the module doc comment. This is never used as, or converted into,
	 * a numeric value in either metric's comparison below. */
	recentNoDataCount: number;
	strict: MarketMetricTrendEvidence;
	broad: MarketMetricTrendEvidence;
};

// ---------------------------------------------------------------------------
// Internal types and primitives
// ---------------------------------------------------------------------------

type UsableRow = { periodStart: string; value: number; fetchedAt: string };
type UsablePeriod = { periodStart: string; value: number };

function mean(values: number[]): number {
	return values.reduce((total, value) => total + value, 0) / values.length;
}

function parseDayMs(periodStart: string): number {
	return new Date(periodStart).getTime();
}

/**
 * Groups usable rows by `periodStart` and computes `duplicatePeriodCount`
 * using the locked excess-row definition (see module doc comment). Also
 * returns a deduplicated, still-unsorted period list (one value per period,
 * keeping the value belonging to the row with the latest `fetchedAt`) so
 * `periodsUsed`/means/etc. can still be computed for evidence purposes —
 * this deduplicated data is never used to produce a `direction` when
 * duplicates are present, since that case is forced to `insufficient_data`
 * by the caller.
 */
function groupByPeriod(rows: UsableRow[]): { duplicatePeriodCount: number; deduped: UsablePeriod[] } {
	const byPeriod = new Map<string, Array<{ value: number; fetchedAt: string }>>();
	for (const row of rows) {
		const existing = byPeriod.get(row.periodStart);
		if (existing) {
			existing.push({ value: row.value, fetchedAt: row.fetchedAt });
		} else {
			byPeriod.set(row.periodStart, [{ value: row.value, fetchedAt: row.fetchedAt }]);
		}
	}

	let duplicatePeriodCount = 0;
	const deduped: UsablePeriod[] = [];
	for (const [periodStart, entries] of byPeriod.entries()) {
		duplicatePeriodCount += Math.max(0, entries.length - 1);
		// entries is guaranteed non-empty: byPeriod only ever gets a key via
		// the push-or-create branch above, which always adds one entry.
		const newest = entries.reduce((latest, entry) => (entry.fetchedAt > latest.fetchedAt ? entry : latest));
		deduped.push({ periodStart, value: newest.value });
	}

	return { duplicatePeriodCount, deduped };
}

/**
 * Infers whether cadence can be trusted from a sorted, deduplicated period
 * list, and if so, the median gap in days between consecutive periods.
 * Requires at least MIN_GAP_SAMPLES consecutive-gap observations (i.e. at
 * least MIN_GAP_SAMPLES + 1 periods) before trusting the result — see the
 * module doc comment.
 */
function inferCadence(sortedPeriods: UsablePeriod[]): { trusted: boolean; medianGapDays: number | null } {
	if (sortedPeriods.length < MIN_GAP_SAMPLES + 1) {
		return { trusted: false, medianGapDays: null };
	}

	const gapsDays: number[] = [];
	for (let i = 0; i < sortedPeriods.length - 1; i++) {
		const current = sortedPeriods[i]!;
		const next = sortedPeriods[i + 1]!;
		gapsDays.push((parseDayMs(next.periodStart) - parseDayMs(current.periodStart)) / 86_400_000);
	}

	const sortedGaps = [...gapsDays].sort((a, b) => a - b);
	const mid = Math.floor(sortedGaps.length / 2);
	const medianGapDays = sortedGaps.length % 2 === 0 ? (sortedGaps[mid - 1]! + sortedGaps[mid]!) / 2 : sortedGaps[mid]!;

	return { trusted: true, medianGapDays };
}

/**
 * Counts large gaps (>= medianGapDays * GAP_MULTIPLIER) across the full
 * sorted period list, and separately reports whether a large gap falls
 * specifically at the boundary between the prior window and the recent
 * window (i.e. the gap immediately precedes the recent window's first
 * period). Only called when cadence is trusted.
 */
function detectGaps(
	sortedPeriods: UsablePeriod[],
	medianGapDays: number,
	recentWindowFirstPeriod: string,
): { observedGapCount: number; boundaryGapIsLarge: boolean } {
	const threshold = medianGapDays * GAP_MULTIPLIER;
	let observedGapCount = 0;
	let boundaryGapIsLarge = false;

	for (let i = 0; i < sortedPeriods.length - 1; i++) {
		const current = sortedPeriods[i]!;
		const next = sortedPeriods[i + 1]!;
		const gapDays = (parseDayMs(next.periodStart) - parseDayMs(current.periodStart)) / 86_400_000;
		if (gapDays >= threshold) {
			observedGapCount += 1;
			if (next.periodStart === recentWindowFirstPeriod) {
				boundaryGapIsLarge = true;
			}
		}
	}

	return { observedGapCount, boundaryGapIsLarge };
}

/**
 * Splits a sorted period list into a prior window and a recent window, each
 * EXACTLY WINDOW_SIZE periods — never smaller, never shrinking. The caller
 * (`evaluateMetric`) has already gated on at least 2 * WINDOW_SIZE total
 * periods before this is called, so both slices are always exactly
 * WINDOW_SIZE long here: `recent` is the most recent WINDOW_SIZE periods,
 * and `prior` is the WINDOW_SIZE periods immediately before it. Any older
 * periods beyond those 2 * WINDOW_SIZE are not part of either window (they
 * still count toward `periodsUsed`/`historyDepth`/gap detection upstream).
 */
function splitWindows(sortedPeriods: UsablePeriod[]): { prior: UsablePeriod[]; recent: UsablePeriod[] } {
	const n = sortedPeriods.length;
	const recent = sortedPeriods.slice(n - WINDOW_SIZE);
	const prior = sortedPeriods.slice(n - WINDOW_SIZE * 2, n - WINDOW_SIZE);

	return { prior, recent };
}

/**
 * Evaluates volatility over a metric's full usable, sorted period list —
 * see the module doc comment for the exact "every transition must be
 * material AND alternate" rule and why it is stronger than a bare
 * "contains an up and a down somewhere" check.
 */
function isVolatile(sortedPeriods: UsablePeriod[]): boolean {
	const bucketCount = Math.floor(sortedPeriods.length / WINDOW_SIZE);
	const usedBucketCount = Math.min(bucketCount, VOLATILITY_MAX_WINDOWS);
	if (usedBucketCount < VOLATILITY_MIN_WINDOWS) {
		return false;
	}

	const startIndex = sortedPeriods.length - usedBucketCount * WINDOW_SIZE;
	const bucketMeans: number[] = [];
	for (let b = 0; b < usedBucketCount; b++) {
		const bucket = sortedPeriods.slice(startIndex + b * WINDOW_SIZE, startIndex + (b + 1) * WINDOW_SIZE);
		bucketMeans.push(mean(bucket.map((period) => period.value)));
	}

	const directions: Array<"up" | "down" | "none"> = [];
	for (let i = 0; i < bucketMeans.length - 1; i++) {
		const from = bucketMeans[i]!;
		const to = bucketMeans[i + 1]!;
		if (from < MIN_BASELINE_MEAN || to < MIN_BASELINE_MEAN) {
			directions.push("none");
			continue;
		}
		const relativeChange = (to - from) / from;
		directions.push(Math.abs(relativeChange) >= MATERIAL_RELATIVE_CHANGE ? (relativeChange > 0 ? "up" : "down") : "none");
	}

	if (directions.some((direction) => direction === "none")) {
		return false;
	}
	for (let i = 1; i < directions.length; i++) {
		if (directions[i] === directions[i - 1]) {
			return false;
		}
	}
	return true;
}

function computeHistoryDepth(periodsUsed: number): MarketTrendHistoryDepth {
	if (periodsUsed === 0) return "none";
	if (periodsUsed < WINDOW_SIZE) return "minimal";
	if (periodsUsed < WINDOW_SIZE * 2) return "limited";
	return "established";
}

/**
 * Evaluates one metric (strict or broad) from its own already-filtered
 * usable rows (rows where this specific metric's value is non-null). Pure;
 * sorts internally by `periodStart` so callers may pass rows in any order.
 */
function evaluateMetric(usableRows: UsableRow[]): MarketMetricTrendEvidence {
	if (usableRows.length === 0) {
		return {
			direction: "insufficient_data",
			historyDepth: "none",
			periodsUsed: 0,
			firstPeriod: null,
			latestPeriod: null,
			recentMean: null,
			priorMean: null,
			relativeChange: null,
			cadenceTrusted: false,
			observedGapCount: 0,
			duplicatePeriodCount: 0,
		};
	}

	const { duplicatePeriodCount, deduped } = groupByPeriod(usableRows);
	const sorted = [...deduped].sort((a, b) => parseDayMs(a.periodStart) - parseDayMs(b.periodStart));
	const periodsUsed = sorted.length;
	const firstPeriod = sorted[0]!.periodStart;
	const latestPeriod = sorted[periodsUsed - 1]!.periodStart;
	const historyDepth = computeHistoryDepth(periodsUsed);
	const { trusted: cadenceTrusted, medianGapDays } = inferCadence(sorted);

	if (duplicatePeriodCount > 0) {
		// Data integrity issue: forced insufficient_data regardless of
		// anything else. Cadence/gap evidence is not computed here — the
		// underlying period list is already known to be invalid.
		return {
			direction: "insufficient_data",
			historyDepth,
			periodsUsed,
			firstPeriod,
			latestPeriod,
			recentMean: null,
			priorMean: null,
			relativeChange: null,
			cadenceTrusted,
			observedGapCount: 0,
			duplicatePeriodCount,
		};
	}

	if (periodsUsed < WINDOW_SIZE * 2) {
		// A full recent window AND a full prior window each require
		// WINDOW_SIZE periods -- below 2 * WINDOW_SIZE total there isn't
		// enough usable history for a real 4-vs-4 comparison, regardless of
		// how the periods that DO exist might otherwise be split. This
		// covers the entire "minimal" and "limited" historyDepth range.
		return {
			direction: "insufficient_data",
			historyDepth,
			periodsUsed,
			firstPeriod,
			latestPeriod,
			recentMean: null,
			priorMean: null,
			relativeChange: null,
			cadenceTrusted,
			observedGapCount: 0,
			duplicatePeriodCount,
		};
	}

	const { prior, recent } = splitWindows(sorted);
	// Both prior and recent are exactly WINDOW_SIZE periods long here:
	// periodsUsed >= WINDOW_SIZE * 2 is guaranteed by the gate above.
	const { observedGapCount, boundaryGapIsLarge } = cadenceTrusted
		? detectGaps(sorted, medianGapDays!, recent[0]!.periodStart)
		: { observedGapCount: 0, boundaryGapIsLarge: false };

	if (cadenceTrusted && boundaryGapIsLarge) {
		return {
			direction: "insufficient_data",
			historyDepth,
			periodsUsed,
			firstPeriod,
			latestPeriod,
			recentMean: null,
			priorMean: null,
			relativeChange: null,
			cadenceTrusted,
			observedGapCount,
			duplicatePeriodCount,
		};
	}

	const priorMean = mean(prior.map((period) => period.value));
	const recentMean = mean(recent.map((period) => period.value));

	if (priorMean < MIN_BASELINE_MEAN || recentMean < MIN_BASELINE_MEAN) {
		return {
			direction: "insufficient_data",
			historyDepth,
			periodsUsed,
			firstPeriod,
			latestPeriod,
			recentMean,
			priorMean,
			relativeChange: null,
			cadenceTrusted,
			observedGapCount,
			duplicatePeriodCount,
		};
	}

	const relativeChange = (recentMean - priorMean) / priorMean;

	if (isVolatile(sorted)) {
		return {
			direction: "volatile",
			historyDepth,
			periodsUsed,
			firstPeriod,
			latestPeriod,
			recentMean,
			priorMean,
			relativeChange,
			cadenceTrusted,
			observedGapCount,
			duplicatePeriodCount,
		};
	}

	let direction: MarketTrendDirection;
	if (relativeChange >= MATERIAL_RELATIVE_CHANGE) {
		direction = "rising";
	} else if (relativeChange <= -MATERIAL_RELATIVE_CHANGE) {
		direction = "declining";
	} else {
		direction = "stable";
	}

	return {
		direction,
		historyDepth,
		periodsUsed,
		firstPeriod,
		latestPeriod,
		recentMean,
		priorMean,
		relativeChange,
		cadenceTrusted,
		observedGapCount,
		duplicatePeriodCount,
	};
}

type FetchAttempt = { fetchedAt: string; status: "observed" | "no_data" };

/**
 * Groups all input rows (both statuses, across both metrics -- this is
 * fetch-level evidence) into fetch attempts by exact `fetchedAt` equality,
 * then sorts the resulting attempts newest-first. See the module doc
 * comment's "Fetch-attempt grouping" section for why this is necessary
 * (one `observed` attempt can be dozens of rows; one `no_data` attempt is
 * always one row) and for the v1-inference caveat.
 */
function groupIntoFetchAttempts(rows: MarketKeywordObservationRow[]): FetchAttempt[] {
	const byFetchedAt = new Map<string, MarketKeywordObservationRow[]>();
	for (const row of rows) {
		const existing = byFetchedAt.get(row.fetchedAt);
		if (existing) {
			existing.push(row);
		} else {
			byFetchedAt.set(row.fetchedAt, [row]);
		}
	}

	const attempts: FetchAttempt[] = [];
	for (const [fetchedAt, groupRows] of byFetchedAt.entries()) {
		const status = groupRows.some((row) => row.status === "observed") ? "observed" : "no_data";
		attempts.push({ fetchedAt, status });
	}

	attempts.sort((a, b) => {
		if (a.fetchedAt < b.fetchedAt) return 1;
		if (a.fetchedAt > b.fetchedAt) return -1;
		return 0;
	});

	return attempts;
}

function computeTopLevelFetchEvidence(rows: MarketKeywordObservationRow[]): {
	latestFetchStatus: "observed" | "no_data" | "none";
	recentNoDataCount: number;
} {
	if (rows.length === 0) {
		return { latestFetchStatus: "none", recentNoDataCount: 0 };
	}

	const attemptsDesc = groupIntoFetchAttempts(rows);
	const latestFetchStatus = attemptsDesc[0]!.status;
	const recentAttempts = attemptsDesc.slice(0, WINDOW_SIZE);
	const recentNoDataCount = recentAttempts.filter((attempt) => attempt.status === "no_data").length;

	return { latestFetchStatus, recentNoDataCount };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluates a keyword/market's strict and broad market-demand trends from
 * its full set of `MarketKeywordObservationRow`s (any order — sorted
 * internally per metric). Pure and synchronous: no Supabase access happens
 * here, so this is trivially unit-testable with hand-built row arrays,
 * mirroring `evaluateOpportunityTrend()`'s own contract.
 */
export function evaluateMarketTrend(rows: MarketKeywordObservationRow[]): MarketTrendResult {
	const strictRows: UsableRow[] = rows
		.filter((row): row is MarketKeywordObservationRow & { periodStart: string; impressions: number } =>
			row.status === "observed" && row.periodStart !== null && row.impressions !== null,
		)
		.map((row) => ({ periodStart: row.periodStart, value: row.impressions, fetchedAt: row.fetchedAt }));

	const broadRows: UsableRow[] = rows
		.filter((row): row is MarketKeywordObservationRow & { periodStart: string; broadImpressions: number } =>
			row.status === "observed" && row.periodStart !== null && row.broadImpressions !== null,
		)
		.map((row) => ({ periodStart: row.periodStart, value: row.broadImpressions, fetchedAt: row.fetchedAt }));

	const { latestFetchStatus, recentNoDataCount } = computeTopLevelFetchEvidence(rows);

	return {
		latestFetchStatus,
		recentNoDataCount,
		strict: evaluateMetric(strictRows),
		broad: evaluateMetric(broadRows),
	};
}
