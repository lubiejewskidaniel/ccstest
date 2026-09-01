/**
 * Opportunity scoring — a pure function, tested independently of any
 * database or provider. Master instruction Decision 12 ("traffic alone
 * does not determine success") is about conversions, not search
 * visibility specifically, but the same spirit applies here: raw
 * impressions alone would just reward big generic queries this business
 * has no real shot at ranking for. The formula below rewards queries
 * that are *close* to working, not just queries that are large.
 *
 * Inputs are the aggregated (summed/averaged) numbers for one query
 * across whatever window was last ingested — aggregation itself happens
 * in `recompute.ts`, not here.
 */

export type AggregatedQueryMetrics = {
	totalImpressions: number;
	totalClicks: number;
	avgPosition: number | null;
};

/**
 * Score components, in order of what they reward:
 *
 * 1. **Impression volume** (log-scaled) — there has to be real search
 *    demand for the query at all. Log-scaled so a query with 10,000
 *    impressions doesn't dominate a query with 500 by 20x just because
 *    it's a bigger, more generic term.
 * 2. **Position proximity to page 1** — a query already sitting at
 *    position 11-20 (bottom of page 2 / top of page 3) is a much better
 *    near-term target than one at position 80, even with identical
 *    impressions. Scored as a bell curve peaking around position 8-15
 *    (already showing up, not yet on page 1) rather than rewarding
 *    position 1 (nothing to gain) or position 95 (a long shot).
 * 3. **CTR gap** — a query with unusually low clicks relative to its
 *    impressions and position suggests the existing result (if any)
 *    isn't compelling, which is exactly what a well-targeted new/refreshed
 *    article can fix.
 *
 * No single factor can zero out the score by itself (e.g. an ungrounded
 * `avgPosition` of null doesn't crash the formula, it just contributes
 * a neutral middle value) — a query with only one or two data points
 * shouldn't be invisible to the planner, just correctly ranked lower
 * than a well-evidenced one.
 */
export function scoreOpportunity(metrics: AggregatedQueryMetrics): number {
	const { totalImpressions, totalClicks, avgPosition } = metrics;

	const impressionScore = Math.log10(Math.max(totalImpressions, 1) + 1) * 10;

	const position = avgPosition ?? 50;
	// Bell curve peaking at position 12, width tuned so positions 5-25
	// still score reasonably well and positions <3 or >60 score low.
	const positionScore = 40 * Math.exp(-Math.pow(position - 12, 2) / (2 * Math.pow(15, 2)));

	const expectedCtrForPosition = position <= 3 ? 0.15 : position <= 10 ? 0.05 : 0.02;
	const actualCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
	const ctrGap = Math.max(expectedCtrForPosition - actualCtr, 0);
	const ctrGapScore = ctrGap * 100; // 0-15ish in practice

	return Math.round((impressionScore + positionScore + ctrGapScore) * 100) / 100;
}
