import { describe, it, expect } from "vitest";
import { evaluateOpportunityTrend, TREND_THRESHOLDS, MAX_BASELINE_SNAPSHOTS, type TrendSnapshot } from "../trend";

// ------------------------------------------------------------------
// Test helpers
// ------------------------------------------------------------------

/** Day N (from an arbitrary fixed epoch) as an ISO timestamp, so tests
 * can express "3 days apart" / "30 days apart" without hand-computing
 * ISO strings. */
function day(n: number): string {
	return new Date(Date.UTC(2026, 0, 1 + n)).toISOString();
}

/** One snapshot with sensible, comfortably-above-every-volume-threshold
 * defaults, so a test only needs to override the fields it actually
 * cares about instead of restating all of them every time. */
function snap(overrides: Partial<TrendSnapshot> = {}): TrendSnapshot {
	return {
		opportunityScore: 100,
		totalImpressions: 100,
		totalClicks: 10,
		avgPosition: 20,
		computedAt: day(0),
		...overrides,
	};
}

/** Builds a chronological (oldest -> newest) history from partial
 * snapshots, auto-assigning one-day-apart `computedAt`s unless a
 * snapshot supplies its own. The LAST element is "latest". */
function history(...partials: Array<Partial<TrendSnapshot>>): TrendSnapshot[] {
	return partials.map((partial, index) => snap({ computedAt: day(index), ...partial }));
}

describe("evaluateOpportunityTrend", () => {
	// ----------------------------------------------------------------
	// Lifecycle vs. direction (isNew must not imply "rising")
	// ----------------------------------------------------------------

	describe("brand-new opportunities (no prior snapshot)", () => {
		it("reports isNew: true and direction: insufficient_data for a single snapshot", () => {
			const result = evaluateOpportunityTrend(history({ opportunityScore: 100 }));
			expect(result.isNew).toBe(true);
			expect(result.direction).toBe("insufficient_data");
			expect(result.snapshotsUsed).toBe(0);
			expect(result.historyDepth).toBe("none");
			expect(result.insufficientDataReason).not.toBeNull();
		});

		it("never classifies a new opportunity as rising just because it's new", () => {
			// Even a very high initial score has nothing to compare against.
			const result = evaluateOpportunityTrend(history({ opportunityScore: 500 }));
			expect(result.direction).not.toBe("rising");
			expect(result.direction).toBe("insufficient_data");
		});

		it("handles an empty history array gracefully (no snapshots at all)", () => {
			const result = evaluateOpportunityTrend([]);
			expect(result.isNew).toBe(true);
			expect(result.direction).toBe("insufficient_data");
			expect(result.latestComputedAt).toBeNull();
			expect(result.baselineWindow).toBeNull();
			expect(result.metrics.opportunityScore.direction).toBe("insufficient_data");
		});

		it("isNew becomes false as soon as one prior snapshot exists", () => {
			const result = evaluateOpportunityTrend(history({ opportunityScore: 100 }, { opportunityScore: 100 }));
			expect(result.isNew).toBe(false);
		});
	});

	// ----------------------------------------------------------------
	// Comparison model: 1 prior (direct) vs 2+ priors (rolling baseline)
	// ----------------------------------------------------------------

	describe("comparison model", () => {
		it("with exactly 1 prior snapshot, compares directly against it", () => {
			const result = evaluateOpportunityTrend(history({ opportunityScore: 100, totalImpressions: 50 }, { opportunityScore: 120, totalImpressions: 50 }));
			expect(result.snapshotsUsed).toBe(1);
			expect(result.historyDepth).toBe("single_snapshot");
			expect(result.metrics.opportunityScore.baseline).toBe(100);
			expect(result.metrics.opportunityScore.direction).toBe("rising");
		});

		it("with 2 priors, the baseline is their average (a rolling baseline, not just the most recent one)", () => {
			const result = evaluateOpportunityTrend(
				history(
					{ opportunityScore: 100, totalImpressions: 50 },
					{ opportunityScore: 120, totalImpressions: 50 },
					{ opportunityScore: 140, totalImpressions: 50 },
				),
			);
			expect(result.snapshotsUsed).toBe(2);
			expect(result.historyDepth).toBe("limited");
			expect(result.metrics.opportunityScore.baseline).toBe(110); // avg(100, 120)
			expect(result.metrics.opportunityScore.direction).toBe("rising"); // (140-110)/110 ≈ 27%
		});

		it("caps the rolling baseline at the 5 most recent priors, ignoring older history", () => {
			// 6 priors: an extreme outlier furthest in the past, then 5
			// steady priors, then a latest snapshot that's a material
			// (+15%) rise over the steady priors but a huge *decline* if
			// the outlier were included. If the cap works, the outlier is
			// dropped and this reads as "rising"; if it leaked in, this
			// would read as "declining" instead.
			const steady = { opportunityScore: 100, totalImpressions: 50 };
			const result = evaluateOpportunityTrend(
				history({ opportunityScore: 10000, totalImpressions: 50 }, steady, steady, steady, steady, steady, { opportunityScore: 115, totalImpressions: 50 }),
			);
			expect(result.snapshotsUsed).toBe(MAX_BASELINE_SNAPSHOTS);
			expect(result.metrics.opportunityScore.baseline).toBe(100);
			expect(result.metrics.opportunityScore.direction).toBe("rising");
		});

		it("historyDepth scales with how many priors actually informed the baseline (capped at 5)", () => {
			const steady = { opportunityScore: 100, totalImpressions: 50 };
			expect(evaluateOpportunityTrend(history(steady, steady)).historyDepth).toBe("single_snapshot"); // 1 prior
			expect(evaluateOpportunityTrend(history(steady, steady, steady)).historyDepth).toBe("limited"); // 2 priors
			expect(evaluateOpportunityTrend(history(steady, steady, steady, steady)).historyDepth).toBe("limited"); // 3 priors
			expect(evaluateOpportunityTrend(history(steady, steady, steady, steady, steady)).historyDepth).toBe("established"); // 4 priors
			expect(evaluateOpportunityTrend(history(steady, steady, steady, steady, steady, steady)).historyDepth).toBe("established"); // 5 priors (cap)
		});
	});

	// ----------------------------------------------------------------
	// Volatility: requires BOTH movements to individually cross the
	// materiality threshold, not just a sign flip.
	// ----------------------------------------------------------------

	describe("volatility", () => {
		it("100 -> 102 -> 101 stays stable (neither move is materially significant)", () => {
			const result = evaluateOpportunityTrend(
				history({ opportunityScore: 100, totalImpressions: 50 }, { opportunityScore: 102, totalImpressions: 50 }, { opportunityScore: 101, totalImpressions: 50 }),
			);
			expect(result.direction).toBe("stable");
		});

		it("100 -> 125 -> 95 is volatile (both +25% and -24% individually cross the 15% threshold)", () => {
			const result = evaluateOpportunityTrend(
				history({ opportunityScore: 100, totalImpressions: 50 }, { opportunityScore: 125, totalImpressions: 50 }, { opportunityScore: 95, totalImpressions: 50 }),
			);
			expect(result.direction).toBe("volatile");
		});

		it("a material move followed by a non-material one is NOT volatile (only one side crosses the threshold)", () => {
			// +16% (material) then -3.4% (not material) - a real reversal
			// never happens, just a big jump and a small give-back.
			const result = evaluateOpportunityTrend(
				history({ opportunityScore: 100, totalImpressions: 50 }, { opportunityScore: 116, totalImpressions: 50 }, { opportunityScore: 112, totalImpressions: 50 }),
			);
			expect(result.direction).not.toBe("volatile");
		});

		it("a bare sign flip with no material movement on either side is not volatility", () => {
			// +0.5% then -0.5% - technically a direction reversal, but
			// nowhere near the 15% opportunity-score threshold.
			const result = evaluateOpportunityTrend(
				history({ opportunityScore: 100, totalImpressions: 50 }, { opportunityScore: 100.5, totalImpressions: 50 }, { opportunityScore: 100, totalImpressions: 50 }),
			);
			expect(result.direction).toBe("stable");
		});

		it("volatility detection also applies to avg_position (lower-is-better) swings", () => {
			// 20 -> 15 (material improvement, -5) -> 22 (material decline, +7)
			const result = evaluateOpportunityTrend(
				history({ avgPosition: 20, totalImpressions: 50 }, { avgPosition: 15, totalImpressions: 50 }, { avgPosition: 22, totalImpressions: 50 }),
			);
			expect(result.metrics.avgPosition.direction).toBe("volatile");
		});

		it("needs at least 2 prior snapshots to ever detect volatility (a single prior has only one delta)", () => {
			const result = evaluateOpportunityTrend(history({ opportunityScore: 100, totalImpressions: 50 }, { opportunityScore: 200, totalImpressions: 50 }));
			expect(result.direction).not.toBe("volatile");
			expect(result.direction).toBe("rising");
		});
	});

	// ----------------------------------------------------------------
	// Position direction: lower is better, centralised, both directions.
	// ----------------------------------------------------------------

	describe("avg_position direction (lower is better)", () => {
		it("12 -> 7 is an improvement (rising) - no caller has to invert the sign", () => {
			const result = evaluateOpportunityTrend(history({ avgPosition: 12, totalImpressions: 50 }, { avgPosition: 7, totalImpressions: 50 }));
			expect(result.metrics.avgPosition.direction).toBe("rising");
			// The raw numbers stay literal (not pre-inverted) - only
			// `direction` accounts for lower-is-better.
			expect(result.metrics.avgPosition.absoluteDelta).toBe(-5);
		});

		it("7 -> 12 is a decline", () => {
			const result = evaluateOpportunityTrend(history({ avgPosition: 7, totalImpressions: 50 }, { avgPosition: 12, totalImpressions: 50 }));
			expect(result.metrics.avgPosition.direction).toBe("declining");
			expect(result.metrics.avgPosition.absoluteDelta).toBe(5);
		});

		it("a position move under the 1.5-position materiality threshold is stable", () => {
			const result = evaluateOpportunityTrend(history({ avgPosition: 20, totalImpressions: 50 }, { avgPosition: 18.6, totalImpressions: 50 }));
			expect(result.metrics.avgPosition.direction).toBe("stable");
		});

		it("a position move of exactly 1.5 positions is material (inclusive boundary)", () => {
			const result = evaluateOpportunityTrend(history({ avgPosition: 20, totalImpressions: 50 }, { avgPosition: 18.5, totalImpressions: 50 }));
			expect(result.metrics.avgPosition.direction).toBe("rising");
		});

		it("null avg_position on either side of the comparison is insufficient_data, not stable", () => {
			const noRankYet = evaluateOpportunityTrend(history({ avgPosition: null, totalImpressions: 50 }, { avgPosition: 8, totalImpressions: 50 }));
			expect(noRankYet.metrics.avgPosition.direction).toBe("insufficient_data");

			const droppedOut = evaluateOpportunityTrend(history({ avgPosition: 8, totalImpressions: 50 }, { avgPosition: null, totalImpressions: 50 }));
			expect(droppedOut.metrics.avgPosition.direction).toBe("insufficient_data");
		});
	});

	// ----------------------------------------------------------------
	// Volume gating / zero-impressions handling
	// ----------------------------------------------------------------

	describe("volume gating", () => {
		it("zero impressions on the latest snapshot: both CTR and impressions read insufficient_data (below their minimum volume)", () => {
			const result = evaluateOpportunityTrend(
				history({ totalImpressions: 100, totalClicks: 10 }, { totalImpressions: 0, totalClicks: 0 }),
			);
			expect(result.metrics.ctr.direction).toBe("insufficient_data");
			expect(result.metrics.ctr.current).toBeNull();
			expect(result.metrics.impressions.direction).toBe("insufficient_data");
		});

		it("a large relative change below the minimum-volume floor is insufficient_data, not stable", () => {
			// 1 -> 3 impressions is "+200%", but both sides are far under
			// the impressions metric's minimum volume of 10 - there isn't
			// enough evidence to call this stable OR moving.
			const result = evaluateOpportunityTrend(history({ totalImpressions: 1 }, { totalImpressions: 3 }));
			expect(result.metrics.impressions.direction).toBe("insufficient_data");
		});
	});

	// ------------------------------------------------------------
	// Three-way distinction: below volume -> insufficient_data;
	// enough volume but sub-threshold movement -> stable; enough
	// volume and material movement -> rising/declining.
	// ------------------------------------------------------------

	describe("insufficient_data vs. stable vs. rising/declining (volume-gated)", () => {
		it("1. below minimum volume -> insufficient_data (impressions 2 -> 3)", () => {
			const result = evaluateOpportunityTrend(history({ totalImpressions: 2 }, { totalImpressions: 3 }));
			expect(result.metrics.impressions.direction).toBe("insufficient_data");
		});

		it("1. below minimum volume -> insufficient_data, even with zero change (clicks 1 -> 1)", () => {
			const result = evaluateOpportunityTrend(history({ totalClicks: 1 }, { totalClicks: 1 }));
			expect(result.metrics.clicks.direction).toBe("insufficient_data");
		});

		it("2. sufficient volume + sub-threshold movement -> stable (impressions 100 -> 104)", () => {
			const result = evaluateOpportunityTrend(history({ totalImpressions: 100 }, { totalImpressions: 104 }));
			expect(result.metrics.impressions.direction).toBe("stable");
		});

		it("3. sufficient volume + material movement -> rising (impressions 100 -> 115)", () => {
			const result = evaluateOpportunityTrend(history({ totalImpressions: 100 }, { totalImpressions: 115 }));
			expect(result.metrics.impressions.direction).toBe("rising");
		});

		it("CTR below the 20-impression floor on either side is insufficient_data, not stable", () => {
			const result = evaluateOpportunityTrend(
				history({ totalImpressions: 10, totalClicks: 1 }, { totalImpressions: 10, totalClicks: 5 }),
			);
			expect(result.metrics.ctr.direction).toBe("insufficient_data");
		});

		it("avg_position below its impression-volume floor is insufficient_data, not stable", () => {
			const result = evaluateOpportunityTrend(history({ avgPosition: 20, totalImpressions: 5 }, { avgPosition: 10, totalImpressions: 5 }));
			expect(result.metrics.avgPosition.direction).toBe("insufficient_data");
		});

		it("opportunity score below its impression-volume floor is insufficient_data, not stable", () => {
			const result = evaluateOpportunityTrend(history({ opportunityScore: 100, totalImpressions: 5 }, { opportunityScore: 200, totalImpressions: 5 }));
			expect(result.metrics.opportunityScore.direction).toBe("insufficient_data");
		});

		it("low-volume pairwise movements cannot contribute to a volatile classification", () => {
			// Same value sequence as the "100 -> 125 -> 95 is volatile" case
			// above, but every snapshot is far under the opportunity-score
			// volume floor (10 impressions) - none of these movements can
			// be counted as material, so this must NOT be volatile.
			const result = evaluateOpportunityTrend(
				history(
					{ opportunityScore: 100, totalImpressions: 5 },
					{ opportunityScore: 125, totalImpressions: 5 },
					{ opportunityScore: 95, totalImpressions: 5 },
				),
			);
			expect(result.direction).not.toBe("volatile");
			expect(result.direction).toBe("insufficient_data");
		});
	});

	// ----------------------------------------------------------------
	// CTR: relative AND absolute must BOTH cross their thresholds.
	// ----------------------------------------------------------------

	describe("CTR combined threshold (relative AND absolute)", () => {
		it("relative change crosses 15% but absolute change is under 1 point -> not material", () => {
			const result = evaluateOpportunityTrend(
				history(
					{ totalImpressions: 1000, totalClicks: 50 }, // ctr 5%
					{ totalImpressions: 1000, totalClicks: 58 }, // ctr 5.8% - +16% relative, +0.8pp absolute
				),
			);
			expect(result.metrics.ctr.direction).toBe("stable");
		});

		it("absolute change crosses 1 point but relative change is under 15% -> not material", () => {
			const result = evaluateOpportunityTrend(
				history(
					{ totalImpressions: 1000, totalClicks: 300 }, // ctr 30%
					{ totalImpressions: 1000, totalClicks: 313 }, // ctr 31.3% - +1.3pp absolute, +4.3% relative
				),
			);
			expect(result.metrics.ctr.direction).toBe("stable");
		});

		it("when both relative and absolute cross their thresholds, the CTR trend is material", () => {
			const result = evaluateOpportunityTrend(
				history(
					{ totalImpressions: 1000, totalClicks: 100 }, // ctr 10%
					{ totalImpressions: 1000, totalClicks: 130 }, // ctr 13% - +3pp absolute, +30% relative
				),
			);
			expect(result.metrics.ctr.direction).toBe("rising");
		});

		it("requires the impressions volume minimum (20) on both sides, independent of the CTR value itself", () => {
			const result = evaluateOpportunityTrend(
				history(
					{ totalImpressions: 10, totalClicks: 1 }, // ctr 10%, below the 20-impression floor
					{ totalImpressions: 10, totalClicks: 5 }, // ctr 50%
				),
			);
			expect(result.metrics.ctr.direction).toBe("insufficient_data");
		});
	});

	// ----------------------------------------------------------------
	// Threshold boundary semantics (inclusive: >= counts as material)
	// ----------------------------------------------------------------

	describe("threshold boundaries are inclusive (>= materialRelativeChange counts as material)", () => {
		it("opportunity score: exactly 15% relative change is material", () => {
			const result = evaluateOpportunityTrend(history({ opportunityScore: 100, totalImpressions: 50 }, { opportunityScore: 115, totalImpressions: 50 }));
			expect(result.direction).toBe("rising");
		});

		it("opportunity score: 14% relative change (just under 15%) is not material", () => {
			const result = evaluateOpportunityTrend(history({ opportunityScore: 100, totalImpressions: 50 }, { opportunityScore: 114, totalImpressions: 50 }));
			expect(result.direction).toBe("stable");
		});

		it("impressions: exactly 10% relative change is material", () => {
			const result = evaluateOpportunityTrend(history({ totalImpressions: 100 }, { totalImpressions: 110 }));
			expect(result.metrics.impressions.direction).toBe("rising");
		});

		it("clicks: exactly 20% relative change is material", () => {
			const result = evaluateOpportunityTrend(history({ totalClicks: 10 }, { totalClicks: 12 }));
			expect(result.metrics.clicks.direction).toBe("rising");
		});
	});

	// ----------------------------------------------------------------
	// Timestamp retention and ordering (snapshots aren't evenly spaced)
	// ----------------------------------------------------------------

	describe("timestamps", () => {
		it("retains the real computed_at span of the baseline window instead of assuming even spacing", () => {
			// Gaps of 1 day, then 29 days - deliberately irregular.
			const result = evaluateOpportunityTrend(
				history(
					{ opportunityScore: 100, totalImpressions: 50, computedAt: day(0) },
					{ opportunityScore: 105, totalImpressions: 50, computedAt: day(1) },
					{ opportunityScore: 110, totalImpressions: 50, computedAt: day(30) },
				),
			);
			expect(result.baselineWindow?.earliestComputedAt).toBe(day(0));
			expect(result.baselineWindow?.latestComputedAt).toBe(day(1));
			expect(result.latestComputedAt).toBe(day(30));
		});

		it("is independent of input array order (sorts by computedAt internally)", () => {
			const chronological = history(
				{ opportunityScore: 100, totalImpressions: 50 },
				{ opportunityScore: 120, totalImpressions: 50 },
				{ opportunityScore: 140, totalImpressions: 50 },
			);
			// All three indices are safe: `history()` always returns an array
			// with exactly as many elements as arguments passed (3, here).
			const shuffled = [chronological[2]!, chronological[0]!, chronological[1]!];

			expect(evaluateOpportunityTrend(shuffled)).toEqual(evaluateOpportunityTrend(chronological));
		});
	});

	// ----------------------------------------------------------------
	// Evidence sufficiency: per-metric detail beyond just a single label
	// ----------------------------------------------------------------

	describe("evidence for a future Recommendation Engine", () => {
		it("the overall direction mirrors the opportunity-score metric's direction", () => {
			const result = evaluateOpportunityTrend(history({ opportunityScore: 100, totalImpressions: 50 }, { opportunityScore: 130, totalImpressions: 50 }));
			expect(result.direction).toBe(result.metrics.opportunityScore.direction);
		});

		it("metrics can disagree - overall score can be stable while another metric moves materially", () => {
			const result = evaluateOpportunityTrend(
				history(
					{ opportunityScore: 100, totalImpressions: 50, totalClicks: 300 },
					{ opportunityScore: 102, totalImpressions: 50, totalClicks: 100 }, // score ~stable, clicks down hard
				),
			);
			expect(result.direction).toBe("stable");
			expect(result.metrics.clicks.direction).toBe("declining");
		});

		it("every metric trend carries current, baseline, and both deltas - not just a label", () => {
			const result = evaluateOpportunityTrend(history({ opportunityScore: 100, totalImpressions: 50 }, { opportunityScore: 130, totalImpressions: 50 }));
			const evidence = result.metrics.opportunityScore;
			expect(evidence.current).toBe(130);
			expect(evidence.baseline).toBe(100);
			expect(evidence.absoluteDelta).toBe(30);
			expect(evidence.relativeDelta).toBeCloseTo(0.3);
		});
	});
});

describe("TREND_THRESHOLDS", () => {
	it("documents v1 defaults for every metric this module evaluates", () => {
		expect(TREND_THRESHOLDS.impressions.minVolume).toBe(10);
		expect(TREND_THRESHOLDS.impressions.materialRelativeChange).toBe(0.1);
		expect(TREND_THRESHOLDS.clicks.minVolume).toBe(5);
		expect(TREND_THRESHOLDS.clicks.materialRelativeChange).toBe(0.2);
		expect(TREND_THRESHOLDS.ctr.minVolumeBothSides).toBe(20);
		expect(TREND_THRESHOLDS.ctr.materialRelativeChange).toBe(0.15);
		expect(TREND_THRESHOLDS.ctr.materialAbsoluteChangePoints).toBe(0.01);
		expect(TREND_THRESHOLDS.avgPosition.minVolume).toBe(10);
		expect(TREND_THRESHOLDS.avgPosition.materialAbsoluteMovement).toBe(1.5);
		expect(TREND_THRESHOLDS.opportunityScore.minVolume).toBe(10);
		expect(TREND_THRESHOLDS.opportunityScore.materialRelativeChange).toBe(0.15);
	});
});
