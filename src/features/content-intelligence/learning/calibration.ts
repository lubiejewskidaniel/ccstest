import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/supabase/adminAuth";
import { getArticlePerformance } from "../monitoring/performanceAnalysis";

export type CalibrationResult =
	| { ok: true; multiplier: number; sampleSize: number }
	| { ok: false; kind: "auth"; message: string }
	| { ok: false; kind: "persistence"; message: string };

const MIN_DAYS_LIVE = 14;
const DEFAULT_MULTIPLIER = 1;

/**
 * "Scoring adapts" (master instruction Checkpoint 9) implemented as one
 * transparent, auditable number — not a black-box model. For every
 * opportunity that was promoted into a published article at least
 * `MIN_DAYS_LIVE` days ago, compares the `score_at_promotion` snapshot
 * (`briefs/promote.ts` sets this once, at promotion time) against that
 * article's actual outcome since publishing (views + a heavier weight on
 * CTA clicks, per Decision 12 — traffic alone doesn't determine
 * success). The ratio of actual-to-predicted, averaged across every
 * resolved opportunity, becomes the multiplier
 * `opportunities/recompute.ts` applies to every newly scored opportunity
 * going forward.
 *
 * A multiplier close to 1 means the scoring formula's predictions have
 * been roughly right; a multiplier far from 1 is itself useful editorial
 * information (the formula in `opportunities/score.ts` may need
 * revisiting), not just an internal scaling constant.
 */
export async function recomputeScoringCalibration(): Promise<CalibrationResult> {
	const session = await getAdminSession();
	if (!session?.isEditor) return { ok: false, kind: "auth", message: "You must be signed in as an editor to do this." };

	const supabase = await createSupabaseServerClient();
	if (!supabase) return { ok: false, kind: "persistence", message: "Supabase isn't configured in this environment." };

	const { data: resolved } = await supabase
		.from("content_opportunities")
		.select("resulting_article_id, score_at_promotion")
		.not("resulting_article_id", "is", null)
		.not("score_at_promotion", "is", null);

	if (!resolved || resolved.length === 0) {
		return { ok: true, multiplier: DEFAULT_MULTIPLIER, sampleSize: 0 };
	}

	const performance = await getArticlePerformance(365);
	const performanceByArticleId = new Map(performance.map((row) => [row.articleId, row]));

	const cutoff = Date.now() - MIN_DAYS_LIVE * 24 * 60 * 60 * 1000;
	const ratios: number[] = [];

	for (const row of resolved) {
		const article = performanceByArticleId.get(row.resulting_article_id as string);
		if (!article || !article.publishedAt) continue;
		if (new Date(article.publishedAt).getTime() > cutoff) continue; // not enough time live to judge yet

		const predicted = Number(row.score_at_promotion);
		if (!predicted || predicted <= 0) continue;

		// Conversion counts aren't available without an admin session
		// (conversion/conversionIntelligence.ts is deliberately
		// admin-only); views + a heavier weight on CTA clicks are always
		// available and are an honest proxy regardless of who triggers
		// this recompute, rather than silently degrading scope for a
		// non-admin editor.
		const actual = article.views + article.ctaClicks * 5;
		ratios.push(actual / predicted);
	}

	if (ratios.length === 0) {
		return { ok: true, multiplier: DEFAULT_MULTIPLIER, sampleSize: 0 };
	}

	const rawMultiplier = ratios.reduce((a, b) => a + b, 0) / ratios.length;
	// Bounded so one outlier article can't send future scoring wild —
	// same "no single factor can zero out the score" philosophy as
	// score.ts itself.
	const multiplier = Math.min(Math.max(rawMultiplier, 0.25), 4);

	const { error } = await supabase.from("scoring_calibration").insert({ multiplier, sample_size: ratios.length });
	if (error) return { ok: false, kind: "persistence", message: error.message };

	return { ok: true, multiplier, sampleSize: ratios.length };
}

export async function getLatestCalibrationMultiplier(): Promise<number> {
	const supabase = await createSupabaseServerClient();
	if (!supabase) return DEFAULT_MULTIPLIER;

	const { data } = await supabase
		.from("scoring_calibration")
		.select("multiplier")
		.order("computed_at", { ascending: false })
		.limit(1)
		.maybeSingle();

	return data ? Number(data.multiplier) : DEFAULT_MULTIPLIER;
}
