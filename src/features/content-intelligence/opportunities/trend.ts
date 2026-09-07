/**
 * Trend Intelligence — pure functions that turn an opportunity's
 * `opportunity_score_history` snapshots into a strongly-typed trend
 * verdict, with enough retained evidence for a future Recommendation
 * Engine to act on without recomputing any of this math itself.
 *
 * This module does NOT touch Supabase (Phase 3 design decision: "Trend
 * remains derived from opportunity_score_history", no new migration).
 * It is handed already-fetched history rows for one opportunity and
 * returns a result — same separation as `score.ts` (pure scoring
 * function, no I/O) vs. `recompute.ts` (the only place that talks to
 * the database).
 *
 * -- Lifecycle vs. direction ------------------------------------------
 * `isNew` (has this opportunity ever had a prior snapshot to compare
 * against?) is tracked completely separately from `direction` (a
 * `TrendDirection`, which does NOT include "new" as a value). A
 * brand-new opportunity with nothing to compare against is
 * `direction: "insufficient_data"` + `isNew: true` — it is never
 * reported as "rising" just because it showed up for the first time.
 *
 * -- Comparison model ---------------------------------------------------
 * Given an opportunity's snapshots ordered oldest -> newest:
 *   - 0 prior snapshots (only the latest exists)  -> insufficient_data.
 *   - 1 prior snapshot                              -> compare against it directly.
 *   - 2+ prior snapshots                            -> compare against the
 *     average of the most recent 5 priors (a "rolling baseline").
 * These two non-empty cases are not actually separate code paths: the
 * average of a single-element window is that element, so "compare
 * against the one prior" and "compare against the average of the
 * available priors, capped at 5" are the same computation. One
 * `rollingBaseline()` helper covers both tiers.
 *
 * Snapshots are not guaranteed to be evenly spaced (a recompute only
 * writes a history row when something actually changed — see
 * `recompute.ts`'s `hasMeaningfulChange()`), so this module does not
 * pretend otherwise: it never claims N snapshots represent N equal time
 * periods. `computedAt` is retained on every result (`latestComputedAt`,
 * `baselineWindow.{earliestComputedAt,latestComputedAt}`) so a future
 * time-aware version (e.g. decaying older snapshots, or requiring a
 * minimum elapsed time before trusting a trend) has what it needs
 * without a data-model change. No time-decay logic is implemented yet —
 * every snapshot in the baseline window is weighted equally.
 *
 * -- Volatility -----------------------------------------------------------
 * "Volatile" requires two *materially significant* movements in
 * opposite directions — not a bare sign flip. 100 -> 102 -> 101 must stay
 * "stable" (neither +2 nor -1 crosses any metric's materiality
 * threshold); 100 -> 125 -> 95 is "volatile" (+25% then -24%, both well
 * past the 15% opportunity-score threshold, in opposite directions).
 * This is checked with the same per-metric materiality rule used for
 * the ordinary rising/declining call, applied to each consecutive pair
 * of snapshots in the baseline window (oldest -> ... -> latest). It only
 * runs when there are at least 2 prior snapshots in play (you need at
 * least two consecutive deltas to see a direction reversal at all) —
 * with exactly 1 prior there is only one delta, so volatility can never
 * be detected there; that single delta is classified normally instead.
 *
 * -- Position direction ---------------------------------------------------
 * `avg_position` is the one metric where a *smaller* number is
 * "better" (rank 7 beats rank 12). That inversion is centralised in one
 * place — `METRIC_CONFIG.avgPosition.higherIsBetter = false` — and
 * applied inside `evaluateMetric()`. Callers only ever see the already
 * -correct `direction` ("rising" for 12 -> 7, "declining" for 7 -> 12);
 * nobody needs to manually flip a sign. `current`/`baseline`/
 * `absoluteDelta`/`relativeDelta` are still the literal, un-inverted
 * numbers (so "position moved from 12 to 7, a delta of -5" reads
 * correctly as a number) — only `direction` accounts for the
 * lower-is-better orientation.
 *
 * -- Thresholds -------------------------------------------------------
 * `TREND_THRESHOLDS` below are v1 engineering defaults chosen to be
 * directionally sensible, NOT empirically calibrated constants. They
 * live in exactly one place so they can be tuned later without hunting
 * through this file's logic.
 */

// ============================================================
// Types
// ============================================================

/**
 * Exactly 5 values. Deliberately does NOT include "new" — see the
 * module doc comment above. `insufficient_data` covers both "no prior
 * snapshot exists at all" and "the available data is too thin/absent to
 * trust a comparison" (e.g. a null `avgPosition`, or volume below a
 * metric's minimum — see `evaluateMetric()`).
 */
export type TrendDirection = "rising" | "stable" | "declining" | "volatile" | "insufficient_data";

/**
 * Qualitative history depth, not a statistical confidence score — no
 * percentage is invented here. Named around "how much history informed
 * this" rather than "confidence" specifically so it can't be misread as
 * a stats term.
 */
export type TrendHistoryDepth = "none" | "single_snapshot" | "limited" | "established";

export type TrendMetricKey = "opportunityScore" | "impressions" | "clicks" | "ctr" | "avgPosition";

/**
 * One opportunity_score_history row's worth of data, in the shape this
 * module needs. Deliberately excludes the per-source (google/bing)
 * columns — this v1 trend model works on the aggregate metrics only;
 * source-level trend ("Google impressions rising, Bing declining") is a
 * documented future direction, not in scope here.
 */
export type TrendSnapshot = {
	opportunityScore: number;
	totalImpressions: number;
	totalClicks: number;
	avgPosition: number | null;
	/** ISO 8601 timestamp (Supabase's `computed_at`). Used to order
	 * snapshots and retained on the result — see the module doc comment
	 * on why spacing is not assumed to be even. */
	computedAt: string;
};

/**
 * Full evidence for one metric's trend, not just its label. `current`/
 * `baseline` are the literal values compared (baseline is an average
 * when 2+ priors are used — see `rollingBaseline()`); `absoluteDelta`/
 * `relativeDelta` are the literal, un-inverted numeric changes
 * (`current - baseline`, and that divided by `|baseline|`). A future
 * Recommendation Engine can read `direction` for the already-correct
 * verdict, or the raw numbers if it needs to reason about magnitude
 * itself.
 */
export type MetricTrendEvidence = {
	direction: TrendDirection;
	current: number | null;
	baseline: number | null;
	absoluteDelta: number | null;
	/** Fraction, e.g. `0.12` = +12%. `null` when not computable (a null
	 * value on either side, or a zero baseline). */
	relativeDelta: number | null;
};

export type TrendResult = {
	/** True iff this opportunity has no prior snapshot at all (only the
	 * latest one exists). Tracked independently of `direction`. */
	isNew: boolean;
	/** The opportunity's overall trend — currently just an alias for
	 * `metrics.opportunityScore.direction`, since opportunity_score
	 * already synthesises impressions/position/CTR into one ranking
	 * number (see `score.ts`). The per-metric breakdown below is what
	 * lets a caller see *why* (e.g. "score stable, but CTR declining"). */
	direction: TrendDirection;
	historyDepth: TrendHistoryDepth;
	/** How many prior snapshots were actually used for the baseline (0
	 * when `isNew`, otherwise 1-5). */
	snapshotsUsed: number;
	/** Human-readable reason, set whenever `direction` (the overall,
	 * opportunity-score-driven one) is "insufficient_data"; `null`
	 * otherwise. */
	insufficientDataReason: string | null;
	/** `computed_at` of the most recent snapshot, or `null` if there is
	 * no history at all. */
	latestComputedAt: string | null;
	/** The prior snapshots actually used as the baseline (oldest ->
	 * latest of that window), or `null` when `isNew`. Retained so a
	 * caller can see the real time span the baseline covers instead of
	 * assuming evenly-spaced snapshots. */
	baselineWindow: {
		snapshotCount: number;
		earliestComputedAt: string;
		latestComputedAt: string;
	} | null;
	metrics: Record<TrendMetricKey, MetricTrendEvidence>;
};

// ============================================================
// Thresholds — v1 engineering defaults, not empirically calibrated.
// Centralised here so they can be recalibrated without touching the
// comparison logic below.
// ============================================================

export const TREND_THRESHOLDS = {
	impressions: {
		/** Below this many impressions on either side of a comparison,
		 * a relative change isn't trusted (a 1 -> 3 impression jump is a
		 * "200% increase" that means nothing). */
		minVolume: 10,
		materialRelativeChange: 0.1,
	},
	clicks: {
		minVolume: 5,
		materialRelativeChange: 0.2,
	},
	ctr: {
		/** Required on BOTH sides of the comparison (the impressions
		 * denominator, not the CTR value itself). */
		minVolumeBothSides: 20,
		/** Both this AND the absolute threshold below must be crossed —
		 * CTR moving from 1% to 1.3% is "+30% relative" but only +0.3
		 * points, and shouldn't read as a material CTR trend on its own. */
		materialRelativeChange: 0.15,
		/** Percentage points, expressed as a fraction (0.01 = 1pp). */
		materialAbsoluteChangePoints: 0.01,
	},
	avgPosition: {
		minVolume: 10,
		/** Positions, not a percentage — relative change in a ranking
		 * position is not a meaningful quantity (see module doc comment). */
		materialAbsoluteMovement: 1.5,
	},
	opportunityScore: {
		minVolume: 10,
		materialRelativeChange: 0.15,
	},
} as const;

/** How many of the most recent prior snapshots feed the rolling
 * baseline, at most. */
export const MAX_BASELINE_SNAPSHOTS = 5;

// ============================================================
// Per-metric configuration
// ============================================================

type MetricConfig = {
	higherIsBetter: boolean;
	minVolume: number;
	materialRelativeChange?: number;
	materialAbsoluteChange?: number;
	/** CTR only: both the relative AND absolute thresholds must be
	 * crossed. When unset, crossing either configured threshold is
	 * enough (in practice every other metric configures exactly one of
	 * the two, so this is simply "the one that's configured"). */
	requireBothRelativeAndAbsolute?: boolean;
	getValue: (snapshot: TrendSnapshot) => number | null;
	getVolume: (snapshot: TrendSnapshot) => number;
};

function ctrOf(snapshot: TrendSnapshot): number | null {
	return snapshot.totalImpressions > 0 ? snapshot.totalClicks / snapshot.totalImpressions : null;
}

const METRIC_CONFIG: Record<TrendMetricKey, MetricConfig> = {
	opportunityScore: {
		higherIsBetter: true,
		minVolume: TREND_THRESHOLDS.opportunityScore.minVolume,
		materialRelativeChange: TREND_THRESHOLDS.opportunityScore.materialRelativeChange,
		getValue: (s) => s.opportunityScore,
		// Gated on impression volume, not the score value itself — a
		// score swing computed from almost no search volume shouldn't
		// be trusted as a real trend (mirrors how scoreOpportunity()
		// itself is impression-driven).
		getVolume: (s) => s.totalImpressions,
	},
	impressions: {
		higherIsBetter: true,
		minVolume: TREND_THRESHOLDS.impressions.minVolume,
		materialRelativeChange: TREND_THRESHOLDS.impressions.materialRelativeChange,
		getValue: (s) => s.totalImpressions,
		getVolume: (s) => s.totalImpressions,
	},
	clicks: {
		higherIsBetter: true,
		minVolume: TREND_THRESHOLDS.clicks.minVolume,
		materialRelativeChange: TREND_THRESHOLDS.clicks.materialRelativeChange,
		getValue: (s) => s.totalClicks,
		getVolume: (s) => s.totalClicks,
	},
	ctr: {
		higherIsBetter: true,
		minVolume: TREND_THRESHOLDS.ctr.minVolumeBothSides,
		materialRelativeChange: TREND_THRESHOLDS.ctr.materialRelativeChange,
		materialAbsoluteChange: TREND_THRESHOLDS.ctr.materialAbsoluteChangePoints,
		requireBothRelativeAndAbsolute: true,
		getValue: ctrOf,
		getVolume: (s) => s.totalImpressions,
	},
	avgPosition: {
		higherIsBetter: false,
		minVolume: TREND_THRESHOLDS.avgPosition.minVolume,
		materialAbsoluteChange: TREND_THRESHOLDS.avgPosition.materialAbsoluteMovement,
		getValue: (s) => s.avgPosition,
		getVolume: (s) => s.totalImpressions,
	},
};

// ============================================================
// Comparison primitives
// ============================================================

function average(values: number[]): number {
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function relativeDeltaOf(current: number | null, baseline: number | null): number | null {
	if (current === null || baseline === null || baseline === 0) return null;
	return (current - baseline) / Math.abs(baseline);
}

/**
 * Compares one value/volume pair against another using `config`'s
 * volume gate and materiality threshold(s). Used both for the
 * baseline-vs-latest call and, pairwise, for volatility detection — the
 * same materiality rule decides both.
 *
 * `volumeSufficient` is reported separately from `material` on purpose:
 * below a metric's minimum volume there isn't enough evidence to say
 * *anything* about its temporal behaviour, which is a different claim
 * from "there was enough evidence, and it didn't move materially".
 * `evaluateMetric()` maps the former to "insufficient_data" and the
 * latter to "stable" — see its own comment. A volume-insufficient
 * comparison always reports `direction: "none"`, so it can never
 * contribute an "up" or "down" toward volatility detection either.
 */
function comparePoints(
	config: MetricConfig,
	currentValue: number | null,
	currentVolume: number,
	baselineValue: number | null,
	baselineVolume: number,
): { volumeSufficient: boolean; material: boolean; direction: "up" | "down" | "none" } {
	if (currentValue === null || baselineValue === null) return { volumeSufficient: false, material: false, direction: "none" };

	const volumeSufficient = currentVolume >= config.minVolume && baselineVolume >= config.minVolume;
	if (!volumeSufficient) return { volumeSufficient: false, material: false, direction: "none" };

	const absoluteDelta = currentValue - baselineValue;
	if (absoluteDelta === 0) return { volumeSufficient: true, material: false, direction: "none" };

	const relativeDelta = relativeDeltaOf(currentValue, baselineValue);

	const relativeMaterial =
		config.materialRelativeChange !== undefined && relativeDelta !== null && Math.abs(relativeDelta) >= config.materialRelativeChange;
	const absoluteMaterial = config.materialAbsoluteChange !== undefined && Math.abs(absoluteDelta) >= config.materialAbsoluteChange;

	const material = config.requireBothRelativeAndAbsolute ? relativeMaterial && absoluteMaterial : relativeMaterial || absoluteMaterial;

	if (!material) return { volumeSufficient: true, material: false, direction: "none" };
	return { volumeSufficient: true, material: true, direction: absoluteDelta > 0 ? "up" : "down" };
}

/** Rolling baseline: the average value/volume across `window` (oldest ->
 * newest priors, already capped to `MAX_BASELINE_SNAPSHOTS` by the
 * caller). A single-element window's average is just that element,
 * which is what makes the "1 prior" and "2+ priors" tiers the same
 * computation — see the module doc comment. */
function rollingBaseline(config: MetricConfig, window: TrendSnapshot[]): { baselineValue: number | null; baselineVolume: number } {
	const values = window.map(config.getValue).filter((value): value is number => value !== null);
	const volumes = window.map(config.getVolume);
	return {
		baselineValue: values.length > 0 ? average(values) : null,
		baselineVolume: volumes.length > 0 ? average(volumes) : 0,
	};
}

/**
 * Evaluates one metric across a full, ascending (oldest -> newest)
 * snapshot history. `sorted` must have at least 1 element (the caller,
 * `evaluateOpportunityTrend()`, handles the 0-snapshot case itself).
 */
function evaluateMetric(config: MetricConfig, sorted: TrendSnapshot[]): MetricTrendEvidence {
	// `sorted` is guaranteed non-empty by evaluateOpportunityTrend() (the
	// 0-snapshot case returns before this is ever called) — the `!` below
	// documents that guarantee rather than working around a real gap.
	const latest = sorted[sorted.length - 1]!;
	const priors = sorted.slice(0, -1);
	const currentValue = config.getValue(latest);
	const currentVolume = config.getVolume(latest);

	if (priors.length === 0) {
		return { direction: "insufficient_data", current: currentValue, baseline: null, absoluteDelta: null, relativeDelta: null };
	}

	const baselineWindow = priors.slice(-MAX_BASELINE_SNAPSHOTS);

	// Volatility: needs at least 2 consecutive deltas (oldest->...->latest)
	// to see a reversal, i.e. at least 2 prior snapshots in the window.
	// A single prior gives exactly one delta, which can't "reverse" —
	// see the module doc comment.
	if (baselineWindow.length >= 2) {
		const points = [...baselineWindow, latest];
		let sawMaterialUp = false;
		let sawMaterialDown = false;
		for (let i = 1; i < points.length; i++) {
			// Both indices are within [0, points.length) by loop construction.
			const curr = points[i]!;
			const prev = points[i - 1]!;
			const cmp = comparePoints(config, config.getValue(curr), config.getVolume(curr), config.getValue(prev), config.getVolume(prev));
			if (cmp.direction === "up") sawMaterialUp = true;
			if (cmp.direction === "down") sawMaterialDown = true;
		}
		if (sawMaterialUp && sawMaterialDown) {
			const { baselineValue } = rollingBaseline(config, baselineWindow);
			return {
				direction: "volatile",
				current: currentValue,
				baseline: baselineValue,
				absoluteDelta: currentValue !== null && baselineValue !== null ? currentValue - baselineValue : null,
				relativeDelta: relativeDeltaOf(currentValue, baselineValue),
			};
		}
	}

	const { baselineValue, baselineVolume } = rollingBaseline(config, baselineWindow);
	const cmp = comparePoints(config, currentValue, currentVolume, baselineValue, baselineVolume);
	const absoluteDelta = currentValue !== null && baselineValue !== null ? currentValue - baselineValue : null;
	const relativeDelta = relativeDeltaOf(currentValue, baselineValue);

	let direction: TrendDirection;
	if (currentValue === null || baselineValue === null || !cmp.volumeSufficient) {
		// Null data (e.g. avg_position with no ranking on one side) and
		// below-minimum volume (e.g. 2 impressions -> 3 impressions) are
		// both "not enough evidence to say anything about this metric's
		// temporal behaviour" — including whether it's stable. Neither
		// is the same claim as "there was enough evidence, and it didn't
		// move materially" (that's "stable", below).
		direction = "insufficient_data";
	} else if (!cmp.material) {
		direction = "stable";
	} else {
		const improved = config.higherIsBetter ? cmp.direction === "up" : cmp.direction === "down";
		direction = improved ? "rising" : "declining";
	}

	return { direction, current: currentValue, baseline: baselineValue, absoluteDelta, relativeDelta };
}

function emptyMetrics(): Record<TrendMetricKey, MetricTrendEvidence> {
	const empty: MetricTrendEvidence = { direction: "insufficient_data", current: null, baseline: null, absoluteDelta: null, relativeDelta: null };
	return {
		opportunityScore: { ...empty },
		impressions: { ...empty },
		clicks: { ...empty },
		ctr: { ...empty },
		avgPosition: { ...empty },
	};
}

// ============================================================
// Public API
// ============================================================

/**
 * Evaluates an opportunity's trend from its full `opportunity_score_history`
 * (any order — sorted internally by `computedAt`). Pure and synchronous:
 * no Supabase access happens here, so this is trivially unit-testable
 * with hand-built snapshot arrays.
 */
export function evaluateOpportunityTrend(history: TrendSnapshot[]): TrendResult {
	if (history.length === 0) {
		return {
			isNew: true,
			direction: "insufficient_data",
			historyDepth: "none",
			snapshotsUsed: 0,
			insufficientDataReason: "No score history has been recorded for this opportunity yet.",
			latestComputedAt: null,
			baselineWindow: null,
			metrics: emptyMetrics(),
		};
	}

	const sorted = [...history].sort((a, b) => Date.parse(a.computedAt) - Date.parse(b.computedAt));
	// Guaranteed non-empty by the `history.length === 0` return above.
	const latest = sorted[sorted.length - 1]!;
	const priors = sorted.slice(0, -1);
	const baselineWindow = priors.slice(-MAX_BASELINE_SNAPSHOTS);
	const isNew = priors.length === 0;

	const metrics: Record<TrendMetricKey, MetricTrendEvidence> = {
		opportunityScore: evaluateMetric(METRIC_CONFIG.opportunityScore, sorted),
		impressions: evaluateMetric(METRIC_CONFIG.impressions, sorted),
		clicks: evaluateMetric(METRIC_CONFIG.clicks, sorted),
		ctr: evaluateMetric(METRIC_CONFIG.ctr, sorted),
		avgPosition: evaluateMetric(METRIC_CONFIG.avgPosition, sorted),
	};

	const snapshotsUsed = baselineWindow.length;
	const historyDepth: TrendHistoryDepth = isNew ? "none" : snapshotsUsed === 1 ? "single_snapshot" : snapshotsUsed <= 3 ? "limited" : "established";

	const direction = metrics.opportunityScore.direction;
	const insufficientDataReason = isNew
		? "This opportunity has only one recorded snapshot; there is no prior snapshot to compare it against yet."
		: direction === "insufficient_data"
			? "Opportunity score or its underlying impression volume is too low to classify a trend."
			: null;

	return {
		isNew,
		direction,
		historyDepth,
		snapshotsUsed,
		insufficientDataReason,
		latestComputedAt: latest.computedAt,
		baselineWindow:
			baselineWindow.length > 0
				? {
						snapshotCount: baselineWindow.length,
						// Both indices are safe here — this branch only runs when
						// `baselineWindow.length > 0`.
						earliestComputedAt: baselineWindow[0]!.computedAt,
						latestComputedAt: baselineWindow[baselineWindow.length - 1]!.computedAt,
					}
				: null,
		metrics,
	};
}
