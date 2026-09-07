import { describe, it, expect } from "vitest";
import {
	evaluateMarketTrend,
	WINDOW_SIZE,
	MIN_GAP_SAMPLES,
	GAP_MULTIPLIER,
	MATERIAL_RELATIVE_CHANGE,
	MIN_BASELINE_MEAN,
	VOLATILITY_MIN_WINDOWS,
	VOLATILITY_MAX_WINDOWS,
} from "../trend";
import type { MarketKeywordObservationRow } from "../queries";

// ------------------------------------------------------------------
// Test helpers
// ------------------------------------------------------------------

/** Week N (from an arbitrary fixed Monday epoch) as an ISO date string,
 * so tests can express "N weeks apart" without hand-computing dates. */
function week(n: number): string {
	return new Date(Date.UTC(2026, 0, 5 + n * 7)).toISOString().slice(0, 10);
}

/** One `observed` row with sensible defaults; override only what a test
 * actually cares about. `fetchedAt` defaults to `periodStart` (a single
 * fetch per period) unless a test needs to construct duplicate-period
 * or fetch-attempt scenarios explicitly. */
function obs(
	periodStart: string,
	impressions: number,
	broadImpressions: number | null = null,
	fetchedAt?: string,
): MarketKeywordObservationRow {
	return { status: "observed", periodStart, impressions, broadImpressions, fetchedAt: fetchedAt ?? periodStart };
}

/** One `no_data` row — always period-less, value-less, per migration 009. */
function noData(fetchedAt: string): MarketKeywordObservationRow {
	return { status: "no_data", periodStart: null, impressions: null, broadImpressions: null, fetchedAt };
}

/** Builds `n` weekly `observed` rows starting at `week(startIndex)`, all
 * with the same strict value and no broad value, for tests that only
 * care about period count / spacing, not specific values. */
function weeklyRows(startIndex: number, n: number, value = 10): MarketKeywordObservationRow[] {
	return Array.from({ length: n }, (_, i) => obs(week(startIndex + i), value));
}

/** Builds exactly 2 * WINDOW_SIZE (8) weekly rows: the first WINDOW_SIZE at
 * `priorValue`, the next WINDOW_SIZE at `recentValue`. This is the minimum
 * shape that can ever produce a real directional comparison under the
 * "two full windows" rule, so most directional tests build on this instead
 * of a bare 4-period fixture (which is always `insufficient_data` now). */
function twoWindowRows(priorValue: number, recentValue: number, startIndex = 0): MarketKeywordObservationRow[] {
	return [...weeklyRows(startIndex, WINDOW_SIZE, priorValue), ...weeklyRows(startIndex + WINDOW_SIZE, WINDOW_SIZE, recentValue)];
}

describe("evaluateMarketTrend", () => {
	// ----------------------------------------------------------------
	// No observations / thin history / minimum-history gate
	// ----------------------------------------------------------------

	describe("no or thin history — a directional comparison requires 2 * WINDOW_SIZE (8) usable periods", () => {
		it("returns insufficient_data for both metrics and latestFetchStatus 'none' with zero rows", () => {
			const result = evaluateMarketTrend([]);
			expect(result.latestFetchStatus).toBe("none");
			expect(result.recentNoDataCount).toBe(0);
			expect(result.strict.direction).toBe("insufficient_data");
			expect(result.strict.historyDepth).toBe("none");
			expect(result.broad.direction).toBe("insufficient_data");
			expect(result.broad.historyDepth).toBe("none");
		});

		it.each([1, 2, 3])("with %d usable period(s), reports insufficient_data and historyDepth 'minimal'", (n) => {
			const result = evaluateMarketTrend(weeklyRows(0, n));
			expect(result.strict.direction).toBe("insufficient_data");
			expect(result.strict.historyDepth).toBe("minimal");
			expect(result.strict.periodsUsed).toBe(n);
			expect(result.strict.relativeChange).toBeNull();
			expect(result.strict.priorMean).toBeNull();
			expect(result.strict.recentMean).toBeNull();
		});

		// WINDOW_SIZE (4) usable periods is NOT enough for a directional
		// comparison: WINDOW_SIZE means an actual 4-period window on BOTH
		// sides, so a comparison needs 2 * WINDOW_SIZE (8) periods total.
		// n=4 and n=7 both land in historyDepth "limited" -- "some useful
		// history exists, but not enough for the full 4-vs-4 comparison" --
		// and must both be insufficient_data. n=8 is the first point where a
		// directional verdict becomes possible.
		it.each([4, 5, 6, 7])("with %d usable periods (below 2 * WINDOW_SIZE), reports historyDepth 'limited' and insufficient_data", (n) => {
			// Values are deliberately shaped so that IF a comparison were
			// attempted, it would clearly fire (large, well-above-floor
			// jump) -- proving insufficient_data comes from the period-count
			// gate itself, not from these values happening to be non-material.
			const rows = Array.from({ length: n }, (_, i) => obs(week(i), i < Math.ceil(n / 2) ? 10 : 100));
			const result = evaluateMarketTrend(rows);
			expect(result.strict.periodsUsed).toBe(n);
			expect(result.strict.historyDepth).toBe("limited");
			expect(result.strict.direction).toBe("insufficient_data");
			expect(result.strict.relativeChange).toBeNull();
			expect(result.strict.priorMean).toBeNull();
			expect(result.strict.recentMean).toBeNull();
		});

		it("with exactly 2 * WINDOW_SIZE (8) usable periods, reports historyDepth 'established' and allows a real directional comparison", () => {
			const result = evaluateMarketTrend(twoWindowRows(10, 20));
			expect(result.strict.periodsUsed).toBe(8);
			expect(result.strict.historyDepth).toBe("established");
			expect(result.strict.direction).not.toBe("insufficient_data");
			expect(result.strict.direction).toBe("rising");
			expect(result.strict.priorMean).toBe(10);
			expect(result.strict.recentMean).toBe(20);
		});

		it("with 9+ periods, still compares exactly the latest 4 against the preceding 4 (older periods don't dilute the windows)", () => {
			// 9 periods: 1 old period (value 1000, would dominate any
			// wider average) + the same 8-period rising shape as above.
			const rows = [obs(week(-1), 1000), ...twoWindowRows(10, 20)];
			const result = evaluateMarketTrend(rows);
			expect(result.strict.periodsUsed).toBe(9);
			expect(result.strict.historyDepth).toBe("established");
			expect(result.strict.priorMean).toBe(10);
			expect(result.strict.recentMean).toBe(20);
			expect(result.strict.direction).toBe("rising");
		});
	});

	// ----------------------------------------------------------------
	// Directional comparison
	// ----------------------------------------------------------------

	describe("directional comparison (exactly WINDOW_SIZE recent periods vs exactly WINDOW_SIZE prior periods)", () => {
		it("classifies a material increase as rising", () => {
			const result = evaluateMarketTrend(twoWindowRows(10, 20));
			expect(result.strict.direction).toBe("rising");
			expect(result.strict.priorMean).toBe(10);
			expect(result.strict.recentMean).toBe(20);
		});

		it("classifies a material decrease as declining", () => {
			const result = evaluateMarketTrend(twoWindowRows(20, 10));
			expect(result.strict.direction).toBe("declining");
		});

		it("classifies a small change as stable", () => {
			const result = evaluateMarketTrend(twoWindowRows(10, 11));
			expect(result.strict.direction).toBe("stable");
		});

		it("classifies noisy-but-not-materially-moving data as stable, not volatile", () => {
			// Same shape of noise as the real Bing sample: alternates up/down
			// on raw points, but recent vs prior windows stay within threshold.
			const result = evaluateMarketTrend([
				obs(week(0), 15),
				obs(week(1), 9),
				obs(week(2), 14),
				obs(week(3), 11),
				obs(week(4), 13),
				obs(week(5), 10),
				obs(week(6), 12),
				obs(week(7), 11),
			]);
			expect(result.strict.direction).not.toBe("volatile");
		});

		it("treats exactly MATERIAL_RELATIVE_CHANGE (30%) as material (rising)", () => {
			expect(MATERIAL_RELATIVE_CHANGE).toBe(0.3);
			const result = evaluateMarketTrend(twoWindowRows(10, 13));
			expect(result.strict.relativeChange).toBeCloseTo(0.3, 10);
			expect(result.strict.direction).toBe("rising");
		});

		it("treats just under 30% (29.99%) as stable", () => {
			const result = evaluateMarketTrend(twoWindowRows(10, 12.999));
			expect(result.strict.relativeChange).toBeLessThan(0.3);
			expect(result.strict.direction).toBe("stable");
		});

		it("does not depend on input row order (sorts internally by periodStart)", () => {
			const rows = twoWindowRows(10, 20);
			const inOrder = evaluateMarketTrend(rows);
			const shuffled = evaluateMarketTrend([...rows].reverse());
			expect(shuffled.strict).toEqual(inOrder.strict);
			expect(shuffled.broad).toEqual(inOrder.broad);
		});
	});

	// ----------------------------------------------------------------
	// Volatility — smoothed windows only, never raw weekly reversals.
	// Unchanged by this correction pass: still requires
	// VOLATILITY_MIN_WINDOWS * WINDOW_SIZE = 3 * 4 = 12 usable periods.
	// ----------------------------------------------------------------

	describe("volatility (smoothed non-overlapping windows) — requires VOLATILITY_MIN_WINDOWS * WINDOW_SIZE (12) usable periods", () => {
		it("8 periods (established, enough for a directional verdict) can never be volatile — below the 12-period volatility minimum", () => {
			expect(VOLATILITY_MIN_WINDOWS).toBe(3);
			expect(WINDOW_SIZE).toBe(4);
			// Alternating shape that WOULD trigger volatility if there were
			// enough buckets to evaluate it (bucketCount = floor(8/4) = 2 < 3).
			const result = evaluateMarketTrend([
				obs(week(0), 10),
				obs(week(1), 25),
				obs(week(2), 10),
				obs(week(3), 25),
				obs(week(4), 10),
				obs(week(5), 25),
				obs(week(6), 10),
				obs(week(7), 25),
			]);
			expect(result.strict.historyDepth).toBe("established");
			expect(result.strict.direction).not.toBe("volatile");
		});

		it("11 periods still cannot be volatile (bucketCount = floor(11/4) = 2 < VOLATILITY_MIN_WINDOWS)", () => {
			const rows = Array.from({ length: 11 }, (_, i) => obs(week(i), i % 2 === 0 ? 25 : 10));
			const result = evaluateMarketTrend(rows);
			expect(result.strict.direction).not.toBe("volatile");
		});

		it("12 periods is the minimum where volatility can fire, given a genuine fully-alternating zigzag", () => {
			expect(VOLATILITY_MIN_WINDOWS * WINDOW_SIZE).toBe(12);
			const values = [10, 10, 10, 10, 25, 25, 25, 25, 10, 10, 10, 10];
			const rows = values.map((v, i) => obs(week(i), v));
			const result = evaluateMarketTrend(rows);
			expect(result.strict.periodsUsed).toBe(12);
			expect(result.strict.direction).toBe("volatile");
		});

		it("classifies a genuine, fully-alternating zigzag across the recent smoothed buckets as volatile", () => {
			expect(VOLATILITY_MAX_WINDOWS).toBe(4);
			const values = [10, 10, 10, 10, 25, 25, 25, 25, 10, 10, 10, 10, 25, 25, 25, 25];
			const rows = values.map((v, i) => obs(week(i), v));
			const result = evaluateMarketTrend(rows);
			expect(result.strict.direction).toBe("volatile");
		});

		it("does not classify tiny raw weekly reversals as volatile once smoothed", () => {
			const values = [100, 102, 101, 103, 101, 104, 102, 105, 103, 106, 104, 107, 105, 108, 106, 109];
			const rows = values.map((v, i) => obs(week(i), v));
			const result = evaluateMarketTrend(rows);
			expect(result.strict.direction).not.toBe("volatile");
		});

		it("does not classify a single flip (one material up, one material down, not a full alternation) as volatile", () => {
			// Bucket means 12.5, 18.5, 12.25, 9.75 -> up, down, non-material.
			// A single reversal amid an otherwise-non-material tail is not a
			// "persistent oscillation" and must not be reported as volatile.
			const values = [11, 15, 11, 13, 18, 25, 14, 17, 9, 17, 6, 17, 9, 8, 7, 15];
			const rows = values.map((v, i) => obs(week(i), v));
			const result = evaluateMarketTrend(rows);
			expect(result.strict.direction).not.toBe("volatile");
		});

		it("regression: the real Bing 'web development' sample (strict and broad) is not volatile", () => {
			const result = evaluateMarketTrend(realBingWebDevelopmentRows());
			expect(result.strict.direction).not.toBe("volatile");
			expect(result.broad.direction).not.toBe("volatile");
		});
	});

	// ----------------------------------------------------------------
	// Cadence inference and gap detection
	// ----------------------------------------------------------------

	describe("cadence inference and gap detection", () => {
		it("does not trust cadence with fewer than MIN_GAP_SAMPLES + 1 periods", () => {
			expect(MIN_GAP_SAMPLES).toBe(4);
			const result = evaluateMarketTrend(weeklyRows(0, 4));
			expect(result.strict.cadenceTrusted).toBe(false);
			expect(result.strict.observedGapCount).toBe(0);
		});

		it("trusts cadence once at least MIN_GAP_SAMPLES + 1 periods are usable, even below the 8-period comparison minimum", () => {
			const result = evaluateMarketTrend(weeklyRows(0, 5));
			expect(result.strict.cadenceTrusted).toBe(true);
			// Still insufficient_data for volume reasons (5 < 8), independent
			// of cadence trust -- the two gates are orthogonal.
			expect(result.strict.direction).toBe("insufficient_data");
		});

		it("never forces insufficient_data from a gap when cadence is untrusted (degrades conservatively)", () => {
			// 4 weekly periods, but with the 2nd period doubled-gapped -- still
			// only 4 usable periods, so cadence cannot be trusted yet.
			const rows = [obs(week(0), 10), obs(week(2), 10), obs(week(3), 10), obs(week(4), 10)];
			const result = evaluateMarketTrend(rows);
			expect(result.strict.cadenceTrusted).toBe(false);
			expect(result.strict.observedGapCount).toBe(0);
		});

		it("counts a gap of GAP_MULTIPLIER times the median cadence as large, when it falls away from the comparison boundary", () => {
			expect(GAP_MULTIPLIER).toBe(2);
			// 8 periods (the minimum for a real comparison): a 14-day gap
			// between the 1st and 2nd periods, then weekly. Boundary for n=8
			// is period[3] -> period[4] (prior = indices 0-3, recent =
			// indices 4-7); this gap sits inside the prior window, not at
			// the boundary.
			const rows = [
				obs("2026-01-05", 10),
				obs("2026-01-19", 10), // 14-day gap here (skips 2026-01-12)
				obs("2026-01-26", 10),
				obs("2026-02-02", 10),
				obs("2026-02-09", 10),
				obs("2026-02-16", 10),
				obs("2026-02-23", 10),
				obs("2026-03-02", 10),
			];
			const result = evaluateMarketTrend(rows);
			expect(result.strict.cadenceTrusted).toBe(true);
			expect(result.strict.observedGapCount).toBe(1);
			expect(result.strict.direction).not.toBe("insufficient_data");
		});

		it("counts multiple large gaps across the history", () => {
			// 9 periods so the comparison boundary (period[4] -> period[5])
			// falls well after both gaps, which sit at the very start.
			const rows = [
				obs("2026-01-05", 10),
				obs("2026-01-19", 10), // gap 1 (skips 2026-01-12)
				obs("2026-02-02", 10), // gap 2 (skips 2026-01-26)
				obs("2026-02-09", 10),
				obs("2026-02-16", 10),
				obs("2026-02-23", 10),
				obs("2026-03-02", 10),
				obs("2026-03-09", 10),
				obs("2026-03-16", 10),
			];
			const result = evaluateMarketTrend(rows);
			expect(result.strict.periodsUsed).toBe(9);
			expect(result.strict.observedGapCount).toBe(2);
			expect(result.strict.direction).not.toBe("insufficient_data");
		});

		// ------------------------------------------------------------
		// Gap boundary index proof. With chronological usable periods and
		// n >= 8, the comparison boundary is exactly between period[n-5]
		// (the prior window's last period) and period[n-4] (the recent
		// window's first period) -- proven here with a synthetic (non-Bing)
		// 9-period fixture, per the review's explicit request not to rely
		// only on the real sample (whose gap does not sit at the boundary).
		// ------------------------------------------------------------

		it("boundary proof: a trusted large gap exactly at period[n-5] -> period[n-4] forces insufficient_data", () => {
			// n = 9: prior = indices[1..4], recent = indices[5..8].
			// period[4] (2026-02-02) -> period[5] (2026-02-23) is the n-5 -> n-4 boundary.
			const rows = [
				obs("2026-01-05", 10), // index 0 (outside both windows)
				obs("2026-01-12", 10), // index 1 (prior)
				obs("2026-01-19", 10), // index 2 (prior)
				obs("2026-01-26", 10), // index 3 (prior)
				obs("2026-02-02", 10), // index 4 (prior, last) -- period[n-5]
				obs("2026-02-23", 10), // index 5 (recent, first) -- period[n-4]; 21-day gap from index 4
				obs("2026-03-02", 10), // index 6 (recent)
				obs("2026-03-09", 10), // index 7 (recent)
				obs("2026-03-16", 10), // index 8 (recent)
			];
			const result = evaluateMarketTrend(rows);
			expect(result.strict.periodsUsed).toBe(9);
			expect(result.strict.cadenceTrusted).toBe(true);
			expect(result.strict.observedGapCount).toBe(1);
			expect(result.strict.direction).toBe("insufficient_data");
			expect(result.strict.relativeChange).toBeNull();
		});

		it("boundary proof (control): the identical gap shifted one period earlier — inside the prior window, not at the boundary — does not block the comparison", () => {
			const rows = [
				obs("2026-01-05", 10), // index 0
				obs("2026-01-12", 10), // index 1 (prior)
				obs("2026-01-19", 10), // index 2 (prior)
				obs("2026-02-09", 10), // index 3 (prior) -- 21-day gap from index 2, but still inside the prior window
				obs("2026-02-16", 10), // index 4 (prior, last) -- period[n-5]
				obs("2026-02-23", 10), // index 5 (recent, first) -- period[n-4]; normal 7-day gap
				obs("2026-03-02", 10), // index 6 (recent)
				obs("2026-03-09", 10), // index 7 (recent)
				obs("2026-03-16", 10), // index 8 (recent)
			];
			const result = evaluateMarketTrend(rows);
			expect(result.strict.periodsUsed).toBe(9);
			expect(result.strict.cadenceTrusted).toBe(true);
			expect(result.strict.observedGapCount).toBe(1);
			expect(result.strict.direction).not.toBe("insufficient_data");
			expect(result.strict.direction).toBe("stable");
		});

		it("regression: the real Bing sample's known gap (2026-08-15 -> 2026-08-29, skipping 2026-08-22) is detected but does not block the comparison (it falls well before the comparison boundary)", () => {
			const result = evaluateMarketTrend(realBingWebDevelopmentRows());
			expect(result.strict.cadenceTrusted).toBe(true);
			expect(result.strict.observedGapCount).toBe(1);
			expect(result.strict.direction).not.toBe("insufficient_data");
		});

		it("strict and broad can have independently different cadence trust when their usable period sets differ", () => {
			const rows = [
				obs(week(0), 10, 20),
				obs(week(1), 10, null),
				obs(week(2), 10, null),
				obs(week(3), 10, null),
				obs(week(4), 10, null), // strict has 5 usable periods; broad has only 1
			];
			const result = evaluateMarketTrend(rows);
			expect(result.strict.cadenceTrusted).toBe(true);
			expect(result.broad.cadenceTrusted).toBe(false);
		});
	});

	// ----------------------------------------------------------------
	// no_data semantics
	// ----------------------------------------------------------------

	describe("no_data semantics", () => {
		it("reports latestFetchStatus 'no_data' when the most recent fetch attempt found nothing, without affecting the metric comparison", () => {
			const rows = [...twoWindowRows(10, 10), noData("2026-04-01")];
			const result = evaluateMarketTrend(rows);
			expect(result.latestFetchStatus).toBe("no_data");
			expect(result.strict.direction).not.toBe("declining");
			expect(result.strict.direction).not.toBe("insufficient_data");
		});

		it("counts repeated no_data fetch attempts in recentNoDataCount without ever feeding them into a mean", () => {
			const rows = [...weeklyRows(0, 4), noData("2026-02-02"), noData("2026-02-09"), noData("2026-02-16")];
			const result = evaluateMarketTrend(rows);
			expect(result.recentNoDataCount).toBeGreaterThanOrEqual(2);
			expect(result.strict.periodsUsed).toBe(4);
		});

		it("never converts no_data into a declining trend by itself", () => {
			const rows = [...twoWindowRows(10, 10), noData("2026-04-01"), noData("2026-04-08"), noData("2026-04-15"), noData("2026-04-22")];
			const result = evaluateMarketTrend(rows);
			expect(result.strict.direction).not.toBe("declining");
		});

		it("keeps an observed value of exactly 0 as a real data point, distinct from no_data", () => {
			const rows = twoWindowRows(0, 0);
			const result = evaluateMarketTrend(rows);
			expect(result.strict.periodsUsed).toBe(8);
			// Correctly routed to insufficient_data via the low-volume floor
			// (priorMean/recentMean = 0), not silently dropped as if it were
			// no_data -- the means are still computed and reported as 0, not null.
			expect(result.strict.direction).toBe("insufficient_data");
			expect(result.strict.priorMean).toBe(0);
			expect(result.strict.recentMean).toBe(0);
		});
	});

	// ----------------------------------------------------------------
	// Fetch-attempt grouping for latestFetchStatus / recentNoDataCount
	// ----------------------------------------------------------------

	describe("fetch-attempt grouping (recentNoDataCount / latestFetchStatus group by exact fetchedAt, not by raw row)", () => {
		it("reproduces the real persistence shape: one fetch attempt's many observed rows share one fetchedAt, and is counted as ONE attempt", () => {
			// Fetch attempt A: 25 observed weekly rows, all sharing the exact
			// same fetchedAt -- exactly how fetchMarketKeywordStats() persists
			// one real Bing fetch (one .upsert() statement, one `now()`).
			// An earlier version of this test fixture incorrectly gave each
			// observed period its own distinct fetchedAt, which does not
			// reflect real persistence behavior and hid this exact bug.
			const attemptA = Array.from({ length: 25 }, (_, i) => obs(week(i), 10 + i, null, "2026-01-05T12:00:00.000Z"));

			// Fetch attempt B: one later, separate fetch that found nothing.
			const attemptB = [noData("2026-02-01T09:00:00.000Z")];

			const afterB = evaluateMarketTrend([...attemptA, ...attemptB]);
			expect(afterB.latestFetchStatus).toBe("no_data");
			// Only 2 distinct fetch attempts exist (A, B) -- both fit inside
			// the most recent WINDOW_SIZE (4) attempts, so exactly 1 of them
			// (B) is no_data, regardless of A containing 25 rows.
			expect(afterB.recentNoDataCount).toBe(1);

			// Fetch attempt C: a later fetch that found data again -- 25 more
			// observed rows, all sharing another single, later fetchedAt.
			const attemptC = Array.from({ length: 25 }, (_, i) => obs(week(30 + i), 20 + i, null, "2026-03-01T12:00:00.000Z"));

			const afterC = evaluateMarketTrend([...attemptA, ...attemptB, ...attemptC]);
			expect(afterC.latestFetchStatus).toBe("observed");
			// Only 3 distinct fetch attempts exist in total (A, B, C), all
			// within the most recent WINDOW_SIZE (4) -- so attempt B's
			// no_data outcome must still be visible, undiluted by C's 25 rows.
			expect(afterC.recentNoDataCount).toBe(1);
		});

		it("a no_data attempt older than the most recent WINDOW_SIZE distinct attempts drops out of recentNoDataCount", () => {
			const oldNoData = [noData("2026-01-01T00:00:00.000Z")];
			// 4 more distinct later attempts, all observed -- pushes the
			// no_data attempt outside the most recent WINDOW_SIZE (4) window.
			const laterAttempts = [
				obs(week(0), 10, null, "2026-02-01T00:00:00.000Z"),
				obs(week(1), 10, null, "2026-02-08T00:00:00.000Z"),
				obs(week(2), 10, null, "2026-02-15T00:00:00.000Z"),
				obs(week(3), 10, null, "2026-02-22T00:00:00.000Z"),
			];
			const result = evaluateMarketTrend([...oldNoData, ...laterAttempts]);
			expect(result.latestFetchStatus).toBe("observed");
			expect(result.recentNoDataCount).toBe(0);
		});
	});

	// ----------------------------------------------------------------
	// Low-volume / zero-baseline safety floor
	// ----------------------------------------------------------------

	describe("low-volume / zero-baseline safety floor (MIN_BASELINE_MEAN)", () => {
		it("routes prior=0, recent=0 to insufficient_data without NaN", () => {
			expect(MIN_BASELINE_MEAN).toBe(5);
			const result = evaluateMarketTrend(twoWindowRows(0, 0));
			expect(result.strict.direction).toBe("insufficient_data");
			expect(result.strict.relativeChange).toBeNull();
			expect(Number.isNaN(result.strict.relativeChange as unknown as number)).toBe(false);
		});

		it("routes prior=0, recent>0 (even a large jump) to insufficient_data without Infinity", () => {
			const result = evaluateMarketTrend(twoWindowRows(0, 500));
			expect(result.strict.direction).toBe("insufficient_data");
			expect(result.strict.relativeChange).toBeNull();
			expect(result.strict.recentMean).toBe(500);
		});

		it("routes a prior mean between 0 and MIN_BASELINE_MEAN with a materially higher recent mean to insufficient_data (not 'strong growth')", () => {
			const result = evaluateMarketTrend(twoWindowRows(2, 8));
			expect(result.strict.priorMean).toBe(2);
			expect(result.strict.direction).toBe("insufficient_data");
			expect(result.strict.relativeChange).toBeNull();
		});

		it("computes a normal comparison once both windows clear the floor", () => {
			const result = evaluateMarketTrend(twoWindowRows(5, 5));
			expect(result.strict.direction).toBe("stable");
			expect(result.strict.relativeChange).toBe(0);
		});
	});

	// ----------------------------------------------------------------
	// Duplicate periods (unaffected by the window-size correction: the
	// duplicate check runs before, and independently of, the 2 * WINDOW_SIZE
	// comparison gate)
	// ----------------------------------------------------------------

	describe("duplicate periods (upstream invariant violation)", () => {
		it("forces insufficient_data and reports duplicatePeriodCount when one period has 2 usable rows", () => {
			const rows = [
				obs("2026-01-05", 10, 20, "2026-01-05T00:00:00Z"),
				obs("2026-01-05", 11, null, "2026-01-05T01:00:00Z"),
				obs("2026-01-12", 10, 22),
				obs("2026-01-19", 10, 23),
				obs("2026-01-26", 10, 24),
			];
			const result = evaluateMarketTrend(rows);
			expect(result.strict.direction).toBe("insufficient_data");
			expect(result.strict.duplicatePeriodCount).toBe(1);
		});

		it("does not force broad to insufficient_data when strict has a duplicate but broad's usable rows do not (the duplicate row has broadImpressions: null)", () => {
			const rows = [
				obs("2026-01-05", 10, 20, "2026-01-05T00:00:00Z"),
				obs("2026-01-05", 11, null, "2026-01-05T01:00:00Z"), // duplicate for strict only
				obs("2026-01-12", 10, 22),
				obs("2026-01-19", 10, 23),
				obs("2026-01-26", 10, 24),
			];
			const result = evaluateMarketTrend(rows);
			expect(result.strict.duplicatePeriodCount).toBe(1);
			expect(result.broad.duplicatePeriodCount).toBe(0);
			// broad only has 4 usable periods here (below the 8-period
			// comparison minimum), so it is insufficient_data too -- but for
			// volume reasons, not duplication.
			expect(result.broad.historyDepth).toBe("limited");
		});

		it("exposes the exact excess-row duplicatePeriodCount for multiple duplicated periods (row counts 2,2,1 -> 2)", () => {
			const rows = [
				obs("2026-01-05", 10, null, "2026-01-05T00:00:00Z"),
				obs("2026-01-05", 11, null, "2026-01-05T01:00:00Z"),
				obs("2026-01-12", 10, null, "2026-01-12T00:00:00Z"),
				obs("2026-01-12", 12, null, "2026-01-12T01:00:00Z"),
				obs("2026-01-19", 10, null),
			];
			const result = evaluateMarketTrend(rows);
			expect(result.strict.duplicatePeriodCount).toBe(2);
		});

		it("exposes the exact excess-row duplicatePeriodCount for a period appearing 3 times (row counts 3,1,1 -> 2)", () => {
			const rows = [
				obs("2026-01-05", 10, null, "2026-01-05T00:00:00Z"),
				obs("2026-01-05", 11, null, "2026-01-05T01:00:00Z"),
				obs("2026-01-05", 12, null, "2026-01-05T02:00:00Z"),
				obs("2026-01-12", 10, null),
				obs("2026-01-19", 10, null),
			];
			const result = evaluateMarketTrend(rows);
			expect(result.strict.duplicatePeriodCount).toBe(2);
		});

		it.each([
			{ counts: [1, 1, 1], expected: 0 },
			{ counts: [2, 1, 1], expected: 1 },
			{ counts: [2, 2, 1], expected: 2 },
			{ counts: [3, 1, 1], expected: 2 },
			{ counts: [2, 1, 3], expected: 3 },
		])("locks the excess-row formula: row counts $counts -> duplicatePeriodCount $expected", ({ counts, expected }) => {
			const rows: MarketKeywordObservationRow[] = [];
			counts.forEach((count, periodIndex) => {
				for (let i = 0; i < count; i++) {
					rows.push(obs(week(periodIndex), 10, null, `${week(periodIndex)}T0${i}:00:00Z`));
				}
			});
			const result = evaluateMarketTrend(rows);
			expect(result.strict.duplicatePeriodCount).toBe(expected);
		});
	});

	// ----------------------------------------------------------------
	// Strict vs. broad independence
	// ----------------------------------------------------------------

	describe("strict/broad independence", () => {
		it("allows broad to be null on some rows without affecting strict's period count", () => {
			const rows = [obs(week(0), 10, 20), obs(week(1), 10, null), obs(week(2), 13, 25), obs(week(3), 13, 30)];
			const result = evaluateMarketTrend(rows);
			expect(result.strict.periodsUsed).toBe(4);
			expect(result.broad.periodsUsed).toBe(3);
		});

		it("classifies strict rising and broad rising independently when both move materially", () => {
			const rows = [
				obs(week(0), 10, 10),
				obs(week(1), 10, 10),
				obs(week(2), 10, 10),
				obs(week(3), 10, 10),
				obs(week(4), 20, 20),
				obs(week(5), 20, 20),
				obs(week(6), 20, 20),
				obs(week(7), 20, 20),
			];
			const result = evaluateMarketTrend(rows);
			expect(result.strict.direction).toBe("rising");
			expect(result.broad.direction).toBe("rising");
		});

		it("classifies strict stable while broad rises", () => {
			const rows = [
				obs(week(0), 10, 10),
				obs(week(1), 10, 10),
				obs(week(2), 10, 10),
				obs(week(3), 10, 10),
				obs(week(4), 11, 20),
				obs(week(5), 11, 20),
				obs(week(6), 11, 20),
				obs(week(7), 11, 20),
			];
			const result = evaluateMarketTrend(rows);
			expect(result.strict.direction).toBe("stable");
			expect(result.broad.direction).toBe("rising");
		});

		it("classifies strict declining while broad rises", () => {
			const rows = [
				obs(week(0), 20, 10),
				obs(week(1), 20, 10),
				obs(week(2), 20, 10),
				obs(week(3), 20, 10),
				obs(week(4), 10, 20),
				obs(week(5), 10, 20),
				obs(week(6), 10, 20),
				obs(week(7), 10, 20),
			];
			const result = evaluateMarketTrend(rows);
			expect(result.strict.direction).toBe("declining");
			expect(result.broad.direction).toBe("rising");
		});

		it("keeps every metric-specific evidence field (historyDepth, gaps, duplicates, period bounds) inside strict/broad, not at the top level", () => {
			const result = evaluateMarketTrend(twoWindowRows(10, 10));
			expect(result).not.toHaveProperty("historyDepth");
			expect(result).not.toHaveProperty("periodsUsed");
			expect(result).not.toHaveProperty("observedGapCount");
			expect(result).not.toHaveProperty("duplicatePeriodCount");
			expect(result).not.toHaveProperty("firstPeriod");
			expect(result).not.toHaveProperty("latestPeriod");
			expect(Object.keys(result).sort()).toEqual(["broad", "latestFetchStatus", "recentNoDataCount", "strict"]);
		});
	});

	// ----------------------------------------------------------------
	// Regression: real Bing "web development" sample (gb/en-GB), collected
	// during Phase 3B.1. These are the ACTUAL persisted period/value pairs
	// from the live dataset -- not a synthetically generated timeline.
	// ----------------------------------------------------------------

	describe("regression: real Bing 'web development' sample", () => {
		it("uses all 25 real observed periods, spanning the real first/last period, for both metrics", () => {
			const result = evaluateMarketTrend(realBingWebDevelopmentRows());
			expect(result.strict.periodsUsed).toBe(25);
			expect(result.strict.firstPeriod).toBe("2026-03-14");
			expect(result.strict.latestPeriod).toBe("2026-09-05");
			expect(result.broad.periodsUsed).toBe(25);
			expect(result.broad.firstPeriod).toBe("2026-03-14");
			expect(result.broad.latestPeriod).toBe("2026-09-05");
		});

		it("is established history for both metrics, with cadence trusted, the one real gap detected, and no duplicates", () => {
			const result = evaluateMarketTrend(realBingWebDevelopmentRows());
			expect(result.strict.historyDepth).toBe("established");
			expect(result.strict.cadenceTrusted).toBe(true);
			expect(result.strict.observedGapCount).toBe(1);
			expect(result.strict.duplicatePeriodCount).toBe(0);
			expect(result.broad.historyDepth).toBe("established");
			expect(result.broad.cadenceTrusted).toBe(true);
			expect(result.broad.observedGapCount).toBe(1);
			expect(result.broad.duplicatePeriodCount).toBe(0);
		});

		it("classifies both strict and broad as stable, using the exact latest-4-vs-preceding-4 usable observations (the missing 2026-08-22 week is never filled with zero)", () => {
			const result = evaluateMarketTrend(realBingWebDevelopmentRows());

			// Only 3 real observations exist after 2026-08-08 (2026-08-15,
			// 2026-08-29, 2026-09-05) because 2026-08-22 was never observed --
			// so the "latest 4" strict/broad windows are the 4 usable
			// observations ending at 2026-09-05, not 4 calendar weeks:
			//   strict: 2026-08-08=9, 2026-08-15=8, 2026-08-29=7, 2026-09-05=15 -> mean 9.75
			//   broad:  2026-08-08=49, 2026-08-15=26, 2026-08-29=13, 2026-09-05=38 -> mean 31.5
			// and the preceding 4 usable observations:
			//   strict: 2026-07-11=9, 2026-07-18=17, 2026-07-25=6, 2026-08-01=17 -> mean 12.25
			//   broad:  2026-07-11=30, 2026-07-18=28, 2026-07-25=20, 2026-08-01=36 -> mean 28.5
			expect(result.strict.priorMean).toBeCloseTo(12.25, 10);
			expect(result.strict.recentMean).toBeCloseTo(9.75, 10);
			expect(result.strict.direction).toBe("stable");

			expect(result.broad.priorMean).toBeCloseTo(28.5, 10);
			expect(result.broad.recentMean).toBeCloseTo(31.5, 10);
			expect(result.broad.direction).toBe("stable");
		});

		it("does NOT misclassify ordinary weekly noise as volatile for either metric", () => {
			const result = evaluateMarketTrend(realBingWebDevelopmentRows());
			expect(result.strict.direction).not.toBe("volatile");
			expect(result.broad.direction).not.toBe("volatile");
		});
	});
});

/**
 * The REAL persisted "web development" (gb/en-GB) Bing Keyword Stats
 * observations collected during Phase 3B.1 -- the actual period/value
 * triples from the live dataset, not a synthetically generated calendar.
 * 2026-08-22 was never observed (2026-08-15 -> 2026-08-29 is a genuine
 * 14-day gap against an otherwise ~7-day cadence); it is represented here
 * by its ABSENCE, never as a zero-filled row.
 */
const REAL_BING_WEB_DEVELOPMENT_PERIODS = [
	"2026-03-14",
	"2026-03-21",
	"2026-03-28",
	"2026-04-04",
	"2026-04-11",
	"2026-04-18",
	"2026-04-25",
	"2026-05-02",
	"2026-05-09",
	"2026-05-16",
	"2026-05-23",
	"2026-05-30",
	"2026-06-06",
	"2026-06-13",
	"2026-06-20",
	"2026-06-27",
	"2026-07-04",
	"2026-07-11",
	"2026-07-18",
	"2026-07-25",
	"2026-08-01",
	"2026-08-08",
	"2026-08-15",
	"2026-08-29",
	"2026-09-05",
];
const REAL_BING_WEB_DEVELOPMENT_STRICT = [34, 36, 13, 13, 7, 22, 26, 18, 18, 11, 15, 11, 13, 18, 25, 14, 17, 9, 17, 6, 17, 9, 8, 7, 15];
const REAL_BING_WEB_DEVELOPMENT_BROAD = [51, 77, 40, 21, 19, 44, 68, 45, 42, 41, 33, 27, 44, 34, 42, 25, 31, 30, 28, 20, 36, 49, 26, 13, 38];

function realBingWebDevelopmentRows(): MarketKeywordObservationRow[] {
	return REAL_BING_WEB_DEVELOPMENT_PERIODS.map((periodStart, i) =>
		obs(periodStart, REAL_BING_WEB_DEVELOPMENT_STRICT[i]!, REAL_BING_WEB_DEVELOPMENT_BROAD[i]!),
	);
}
