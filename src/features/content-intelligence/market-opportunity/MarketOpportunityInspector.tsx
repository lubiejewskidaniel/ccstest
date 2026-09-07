import type { ReactNode } from "react";
import type { MarketOpportunityEvidence } from "./types";
import type { MarketMetricTrendEvidence } from "../market/trend";
import { EvidenceBadge } from "./EvidenceBadge";
import {
	CLASSIFICATION_EXPLANATION,
	CLASSIFICATION_LABEL,
	COVERAGE_LABEL,
	COVERAGE_TONE,
	CONFIDENCE_LABEL,
	CONFIDENCE_TONE,
	describeContentMappingAmbiguity,
	DIRECTION_EXPLANATION,
	DIRECTION_LABEL,
	DIRECTION_TONE,
	displayPercent,
	displayValue,
	LIMITING_REASON_EXPLANATION,
	MATCH_KIND_LABEL,
	RELEVANCE_LABEL,
	RELEVANCE_TONE,
} from "./marketOpportunityPresentation";

/**
 * Phase 3C.1F — read-only evidence panel for one already-fetched
 * `MarketOpportunityEvidence`. Server/display component only (no
 * "use client", no interactivity): every value here is either shown
 * verbatim or run through `marketOpportunityPresentation.ts`'s pure
 * label/tone maps — no business logic, no re-scoring, no
 * recommendations. See queries.ts's own doc comment on the
 * gather/interpret boundary this UI sits on the far side of.
 *
 * `ccsVisibility.opportunityId` is a `content_opportunities.id`, not an
 * `insights_articles.id` — the Phase 3C.1F route/ID safety check
 * confirmed no admin route accepts that id, so it is rendered as plain
 * read-only text here, never as a link. `contentCoverage`'s
 * `titleMatches`/`excerptOnlyMatches` carry an `articleId` that IS
 * confirmed to be the same `insights_articles.id`
 * `/admin/insights/[id]/edit` expects, so those do link.
 */

function DefinitionGrid({ items }: { items: { term: string; value: ReactNode }[] }) {
	return (
		<dl className="admin-definition-grid">
			{items.map((item) => (
				<div key={item.term}>
					<dt>{item.term}</dt>
					<dd>{item.value}</dd>
				</div>
			))}
		</dl>
	);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: 16, marginBottom: 20 }}>
			<h2 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: 12 }}>{title}</h2>
			{children}
		</section>
	);
}

function metricTrendItems(evidence: MarketMetricTrendEvidence): { term: string; value: ReactNode }[] {
	return [
		{
			term: "Direction",
			value: (
				<>
					<EvidenceBadge label={DIRECTION_LABEL[evidence.direction]} tone={DIRECTION_TONE[evidence.direction]} />{" "}
					<span style={{ color: "var(--ink-3)", fontSize: 12.5 }}>{DIRECTION_EXPLANATION[evidence.direction]}</span>
				</>
			),
		},
		{ term: "History depth", value: displayValue(evidence.historyDepth) },
		{ term: "Periods used", value: displayValue(evidence.periodsUsed) },
		{ term: "First period", value: displayValue(evidence.firstPeriod) },
		{ term: "Latest period", value: displayValue(evidence.latestPeriod) },
		{ term: "Recent mean", value: displayValue(evidence.recentMean) },
		{ term: "Prior mean", value: displayValue(evidence.priorMean) },
		{ term: "Relative change", value: displayPercent(evidence.relativeChange) },
		{ term: "Cadence trusted", value: displayValue(evidence.cadenceTrusted) },
		{ term: "Observed gap count", value: displayValue(evidence.observedGapCount) },
		{ term: "Duplicate period count", value: displayValue(evidence.duplicatePeriodCount) },
	];
}

export function MarketOpportunityInspector({ evidence }: { evidence: MarketOpportunityEvidence }) {
	const { subject, marketDemand, ccsVisibility, ccsTrend, businessRelevance, contentCoverage, evidenceConfidence, classifications } = evidence;

	return (
		<div>
			{/* --- 1. Subject --- */}
			<Section title="Subject">
				<DefinitionGrid
					items={[
						{ term: "Keyword", value: subject.keyword },
						{ term: "Provider", value: subject.provider },
						{ term: "Market country", value: subject.market.country },
						{ term: "Market language", value: subject.market.language },
					]}
				/>
			</Section>

			{/* --- 2. Market demand --- */}
			<Section title="Market demand">
				<p style={{ color: "var(--ink-3)", fontSize: 12.5, marginBottom: 12 }}>
					Provider-observed impressions — an external demand signal, not CCS&apos;s own search performance.
				</p>
				<DefinitionGrid
					items={[
						{ term: "Latest fetch status", value: displayValue(marketDemand.trend.latestFetchStatus) },
						{ term: "Recent no-data count", value: displayValue(marketDemand.trend.recentNoDataCount) },
					]}
				/>
				<h3 style={{ fontSize: "0.9rem", fontWeight: 600, margin: "16px 0 8px" }}>Strict impressions</h3>
				<DefinitionGrid
					items={[
						{ term: "Latest observed impressions", value: displayValue(marketDemand.strict.latestObservedImpressions) },
						{ term: "Latest observed period", value: displayValue(marketDemand.strict.latestObservedPeriod) },
						...metricTrendItems(marketDemand.trend.strict),
					]}
				/>
				<h3 style={{ fontSize: "0.9rem", fontWeight: 600, margin: "16px 0 8px" }}>Broad impressions</h3>
				<DefinitionGrid
					items={[
						{ term: "Latest observed impressions", value: displayValue(marketDemand.broad.latestObservedImpressions) },
						{ term: "Latest observed period", value: displayValue(marketDemand.broad.latestObservedPeriod) },
						...metricTrendItems(marketDemand.trend.broad),
					]}
				/>
			</Section>

			{/* --- 3. CCS visibility --- */}
			<Section title="CCS visibility">
				{ccsVisibility.status === "no_match" && <p>No matching CCS first-party query.</p>}
				{ccsVisibility.status === "ambiguous_match" && (
					<p>
						<EvidenceBadge label="Ambiguous first-party match" tone="attention" /> {ccsVisibility.candidateCount} candidate
						{ccsVisibility.candidateCount === 1 ? "" : "s"}.
					</p>
				)}
				{ccsVisibility.status === "matched" && (
					<DefinitionGrid
						items={[
							{ term: "Matched query", value: ccsVisibility.matchedQuery },
							{ term: "Match kind", value: MATCH_KIND_LABEL[ccsVisibility.matchKind] },
							{ term: "Total impressions", value: displayValue(ccsVisibility.totalImpressions) },
							{ term: "Total clicks", value: displayValue(ccsVisibility.totalClicks) },
							{ term: "Avg position", value: displayValue(ccsVisibility.avgPosition) },
							{ term: "Google impressions", value: displayValue(ccsVisibility.googleImpressions) },
							{ term: "Bing impressions", value: displayValue(ccsVisibility.bingImpressions) },
							{ term: "Opportunity score", value: displayValue(ccsVisibility.opportunityScore) },
							// content_opportunities.id — not an insights_articles id, so
							// plain read-only text, never a link. See the module doc
							// comment and the Phase 3C.1F route/ID safety-check finding.
							{ term: "Opportunity id", value: ccsVisibility.opportunityId },
						]}
					/>
				)}
			</Section>

			{/* --- 4. CCS trend --- */}
			<Section title="CCS trend">
				{ccsTrend.status === "no_match" && <p>No matching CCS first-party query.</p>}
				{ccsTrend.status === "ambiguous_match" && (
					<p>
						<EvidenceBadge label="Ambiguous first-party match" tone="attention" /> {ccsTrend.candidateCount} candidate
						{ccsTrend.candidateCount === 1 ? "" : "s"}.
					</p>
				)}
				{ccsTrend.status === "matched" && (
					<DefinitionGrid
						items={[
							{
								term: "Direction",
								value: <EvidenceBadge label={DIRECTION_LABEL[ccsTrend.trend.direction]} tone={DIRECTION_TONE[ccsTrend.trend.direction]} />,
							},
							{ term: "Is new", value: displayValue(ccsTrend.trend.isNew) },
							{ term: "History depth", value: displayValue(ccsTrend.trend.historyDepth) },
							{ term: "Snapshots used", value: displayValue(ccsTrend.trend.snapshotsUsed) },
							{ term: "Insufficient-data reason", value: displayValue(ccsTrend.trend.insufficientDataReason) },
							{ term: "Latest computed at", value: displayValue(ccsTrend.trend.latestComputedAt) },
						]}
					/>
				)}
			</Section>

			{/* --- 5. Business relevance --- */}
			<Section title="Business relevance">
				<p style={{ marginBottom: 12 }}>
					<EvidenceBadge label={RELEVANCE_LABEL[businessRelevance.level]} tone={RELEVANCE_TONE[businessRelevance.level]} />
				</p>
				{businessRelevance.matches.length === 0 ? (
					<p style={{ color: "var(--ink-3)", fontSize: 12.5 }}>No matched CCS taxonomy terms.</p>
				) : (
					<div style={{ overflowX: "auto" }}>
						<table className="admin-table">
							<thead>
								<tr>
									<th scope="col">Pillar</th>
									<th scope="col">Matched term</th>
									<th scope="col">Tier</th>
									<th scope="col">Language</th>
								</tr>
							</thead>
							<tbody>
								{businessRelevance.matches.map((match, index) => (
									<tr key={`${match.pillarKey}-${match.matchedTerm}-${index}`}>
										<td>{match.pillarKey}</td>
										<td>{match.matchedTerm}</td>
										<td>{match.matchedTermTier}</td>
										<td>{match.matchedLanguage}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</Section>

			{/* --- 6. Content coverage --- */}
			<Section title="Content coverage">
				<p style={{ marginBottom: 12 }}>
					<EvidenceBadge label={COVERAGE_LABEL[contentCoverage.level]} tone={COVERAGE_TONE[contentCoverage.level]} />
					{describeContentMappingAmbiguity(contentCoverage.mapping) && (
						<>
							{" "}
							<EvidenceBadge label="Ambiguous mapping" tone="attention" />{" "}
							<span style={{ color: "var(--ink-3)", fontSize: 12.5 }}>{describeContentMappingAmbiguity(contentCoverage.mapping)}</span>
						</>
					)}
				</p>
				{contentCoverage.titleMatches.length === 0 && contentCoverage.excerptOnlyMatches.length === 0 ? (
					<p style={{ color: "var(--ink-3)", fontSize: 12.5 }}>No matching published articles.</p>
				) : (
					<div style={{ overflowX: "auto" }}>
						<table className="admin-table">
							<thead>
								<tr>
									<th scope="col">Match type</th>
									<th scope="col">Locale</th>
									<th scope="col">Article</th>
								</tr>
							</thead>
							<tbody>
								{contentCoverage.titleMatches.map((match) => (
									<tr key={`title-${match.articleId}`}>
										<td>Title match</td>
										<td>{match.locale.toUpperCase()}</td>
										<td>
											{/* insights_articles.id — confirmed compatible with
											    /admin/insights/[id]/edit; see module doc comment. */}
											<a href={`/admin/insights/${match.articleId}/edit`}>{match.slug}</a>
										</td>
									</tr>
								))}
								{contentCoverage.excerptOnlyMatches.map((match) => (
									<tr key={`excerpt-${match.articleId}`}>
										<td>Mention</td>
										<td>{match.locale.toUpperCase()}</td>
										<td>
											<a href={`/admin/insights/${match.articleId}/edit`}>{match.slug}</a>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</Section>

			{/* --- 7. Evidence confidence --- */}
			<Section title="Evidence confidence">
				<p style={{ marginBottom: 12 }}>
					<EvidenceBadge label={CONFIDENCE_LABEL[evidenceConfidence.level]} tone={CONFIDENCE_TONE[evidenceConfidence.level]} />
				</p>
				<DefinitionGrid
					items={[
						{ term: "Market channels usable", value: displayValue(evidenceConfidence.factors.marketChannelsUsable) },
						{ term: "Market agreement", value: displayValue(evidenceConfidence.factors.marketAgreement) },
						{ term: "Latest market fetch status", value: displayValue(evidenceConfidence.factors.latestMarketFetchStatus) },
						{ term: "Recent market no-data count", value: displayValue(evidenceConfidence.factors.recentMarketNoDataCount) },
						{ term: "Content mapping ambiguous", value: displayValue(evidenceConfidence.factors.contentMappingAmbiguous) },
						{
							term: "CCS first-party history",
							value: evidenceConfidence.factors.ccsFirstPartyHistory.present
								? displayValue(evidenceConfidence.factors.ccsFirstPartyHistory.historyDepth)
								: "None yet",
						},
					]}
				/>
				{evidenceConfidence.limitingReasons.length > 0 && (
					<>
						<h3 style={{ fontSize: "0.9rem", fontWeight: 600, margin: "16px 0 8px" }}>Why confidence is limited</h3>
						<ul style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
							{evidenceConfidence.limitingReasons.map((reason) => (
								<li key={reason} style={{ fontSize: 13 }}>
									{LIMITING_REASON_EXPLANATION[reason]}
								</li>
							))}
						</ul>
					</>
				)}
			</Section>

			{/* --- 8. Classifications --- */}
			<Section title="Classifications">
				{classifications.length === 0 ? (
					<p style={{ color: "var(--ink-3)", fontSize: 12.5 }}>No classifications apply.</p>
				) : (
					<>
						<div className="tag-row" style={{ marginBottom: 12 }}>
							{classifications.map((classification) => (
								<span
									key={classification}
									style={{
										border: "1px solid var(--line-strong)",
										borderRadius: 999,
										padding: "4px 10px",
										fontSize: 11.5,
										fontFamily: "var(--font-mono)",
										color: "var(--ink-2)",
									}}
								>
									{CLASSIFICATION_LABEL[classification]}
								</span>
							))}
						</div>
						{/* Explanation text is always visible here, never a hover-only
						    tooltip — see the accessibility requirement against
						    hover-only information. */}
						<ul style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
							{classifications.map((classification) => (
								<li key={classification} style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
									<b style={{ color: "var(--ink-2)" }}>{CLASSIFICATION_LABEL[classification]}:</b> {CLASSIFICATION_EXPLANATION[classification]}
								</li>
							))}
						</ul>
					</>
				)}
			</Section>
		</div>
	);
}
