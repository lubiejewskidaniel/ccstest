import type { MarketCode } from "../market/types";
import type { RecommendationEvidence } from "./types";
import { CONFIDENCE_LABEL, RECOMMENDATION_KIND_LABEL, RECOMMENDATION_REASON_LABEL } from "./marketOpportunityPresentation";

/**
 * Phase 3C.3 — Human Approval & Recommendation Execution Bridge.
 *
 * Converts a freshly-evaluated `RecommendationEvidence` into, at most,
 * ONE safe navigation target for a human editor — never an executable
 * action. Recommendation != execution (the Phase 3C.3 architecture
 * report's Core Safety Principle): the only thing this module ever
 * returns is a `{ label, href }` pair pointing at an EXISTING route
 * (`/admin/insights/briefs/new` or the existing article editor). Nothing
 * here creates a brief, an article, an image, or a scheduled job — the
 * actual write, if any, only happens when a human explicitly submits the
 * existing Create Brief form or edits an article through the existing
 * editor, both entirely unmodified by this module.
 *
 * -- Purity -----------------------------------------------------------
 * No Supabase, no fetch, no wall-clock read, no randomness, no mutation
 * of `result`/`evidence`. Every function here is pure and total: the
 * same input always produces the same output. This module has no memory
 * of its own — nothing is cached, persisted, or reused across calls, so
 * a caller (the Inspector) that always passes the current page render's
 * freshly-evaluated `RecommendationEvidence` automatically gets a
 * freshly-built handoff every time; there is no stale state in here to
 * accidentally reuse.
 *
 * -- Why only two kinds ever produce a handoff -------------------------
 * `create_content` and `refresh_content` are the only RecommendationKind
 * values this module ever returns a non-null handoff for.
 * `research_further`, `monitor`, and `no_action` are deliberately
 * informational-only (Phase 3C.3 locked decisions 6-8) — this module
 * returns `null` for them, and for any future/unrecognised kind, on
 * purpose: failing CLOSED (no action) is the safe default, never open.
 *
 * -- categoryId is never fabricated --------------------------------
 * The existing Create Brief form requires a real CMS category UUID
 * (`createBriefSchema`'s `categoryId: z.string().uuid()`) that nothing
 * in `MarketOpportunityEvidence` can supply — there is no business-
 * pillar-to-CMS-category mapping in this codebase, and this module does
 * not invent one. `categoryId` is deliberately never a query param this
 * module sets; the human always chooses it on the existing form.
 */

export type RecommendationHandoff = { label: string; href: string };

/** The only country -> locale mapping this codebase's two configured
 * markets need (conceptually mirrors contentCoverage.ts's own
 * `marketToEligibleArticleLocale`, kept as its own explicit switch here
 * rather than importing a private function from another module).
 * Exhaustively switched so a third `MarketCode` member fails to compile
 * here until this mapping is deliberately extended, rather than
 * silently defaulting to the wrong locale. */
function marketToLocale(market: MarketCode): "en" | "pl" {
	switch (market.country) {
		case "gb":
			return "en";
		case "pl":
			return "pl";
		default: {
			const exhaustiveCheck: never = market;
			throw new Error(`buildRecommendationHandoff: unhandled market ${JSON.stringify(exhaustiveCheck)}`);
		}
	}
}

/**
 * Short, deterministic, human-readable text for the existing Create
 * Brief form's `keyPoints` field — keyword, market, confidence, and the
 * recommendation's own supporting reasons, in that fixed order. Never a
 * serialisation of `MarketOpportunityEvidence` (Phase 3C.3 locked
 * decision 16) — every line is built from already-computed,
 * already-labelled facts via the same label maps the Inspector itself
 * uses, so the wording an editor sees on the page matches what lands in
 * the prefilled form exactly. `supportingReasons` is already in fixed,
 * deduplicated order (see recommendation.ts's `canonicalize`), so this
 * function's output is fully deterministic for a given input.
 */
export function buildRecommendationKeyPoints(result: RecommendationEvidence): string {
	const { evidence, confidence, supportingReasons } = result;
	const lines: string[] = [
		`Suggested by the Market Opportunity Recommendation Engine — ${RECOMMENDATION_KIND_LABEL[result.recommendation]}.`,
		`Keyword: ${evidence.subject.keyword} (${evidence.subject.market.country.toUpperCase()})`,
		`Confidence: ${CONFIDENCE_LABEL[confidence]}`,
	];
	if (supportingReasons.length > 0) {
		lines.push(`Why: ${supportingReasons.map((reason) => RECOMMENDATION_REASON_LABEL[reason]).join("; ")}`);
	}
	return lines.join("\n");
}

/**
 * Build, at most, one safe navigation target for the given
 * recommendation. Pure and total — the same `RecommendationEvidence`
 * value always produces the same result. Never throws for any value
 * that is structurally valid at the type level (the only `throw` in
 * this module is `marketToLocale`'s impossible-`MarketCode` guard,
 * unreachable for any of this codebase's real evidence).
 */
export function buildRecommendationHandoff(result: RecommendationEvidence): RecommendationHandoff | null {
	const { evidence } = result;

	switch (result.recommendation) {
		case "create_content": {
			const params = new URLSearchParams();
			params.set("topic", evidence.subject.keyword);
			params.set("locale", marketToLocale(evidence.subject.market));
			// Only ever a REAL content_opportunities.id, never fabricated.
			// ccsVisibility.status and firstPartyMatch.kind are always in
			// lockstep (both derived from the same match in
			// marketOpportunity.ts's buildCcsVisibility/buildCcsTrend), so
			// this single check is sufficient.
			if (evidence.ccsVisibility.status === "matched") {
				params.set("opportunityId", evidence.ccsVisibility.opportunityId);
			}
			// categoryId is deliberately never set — see the module doc
			// comment. The human always chooses it on the existing form.
			params.set("keyPoints", buildRecommendationKeyPoints(result));
			return { label: "Review content brief", href: `/admin/insights/briefs/new?${params.toString()}` };
		}
		case "refresh_content": {
			// refresh_content only ever fires (Phase 3C.2's own gates) when
			// contentCoverage.mapping === "unambiguous", which guarantees
			// exactly one titleMatches entry — but this module never trusts
			// that invariant blindly: an unexpected shape (zero, or two or
			// more matches) fails closed to "no handoff" rather than
			// guessing which article to link to.
			const matches = evidence.contentCoverage.titleMatches;
			if (matches.length !== 1) return null;
			return { label: "Review refresh evidence", href: `/admin/insights/${matches[0]!.articleId}/edit` };
		}
		case "research_further":
		case "monitor":
		case "no_action":
			// Informational only (Phase 3C.3 locked decisions 6-8) — no
			// execution control of any kind.
			return null;
		default: {
			// Fail closed: a recommendation kind this module does not
			// recognise never accidentally produces an action. The `never`
			// assignment below is a COMPILE-TIME-ONLY exhaustiveness guard
			// (TypeScript fails to compile this line if RecommendationKind
			// ever gains a member with no case above) — it must never be
			// returned itself, since type annotations are erased at
			// runtime: returning it would silently hand back whatever raw,
			// unrecognised value was actually passed in instead of failing
			// closed. `null` is returned explicitly and unconditionally.
			const exhaustiveCheck: never = result.recommendation;
			void exhaustiveCheck;
			return null;
		}
	}
}
