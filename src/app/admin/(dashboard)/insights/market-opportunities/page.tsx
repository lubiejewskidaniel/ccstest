import type { Metadata } from "next";
import Link from "next/link";
import { listTrackedMarketKeywords } from "@/features/content-intelligence/market/queries";
import type { TrackedMarketKeyword } from "@/features/content-intelligence/market/queries";
import type { MarketCode, MarketIntelligenceProviderId } from "@/features/content-intelligence/market/types";
import { getMarketOpportunityEvidence } from "@/features/content-intelligence/market-opportunity/queries";
import type { MarketOpportunitySubject } from "@/features/content-intelligence/market-opportunity/types";
import { MarketOpportunityInspector } from "@/features/content-intelligence/market-opportunity/MarketOpportunityInspector";
import { ERROR_MESSAGE } from "@/features/content-intelligence/market-opportunity/marketOpportunityPresentation";

export const metadata: Metadata = { title: "Market opportunities" };

/**
 * Phase 3C.1F — read-only admin inspection UI. Server Component only, no
 * "use client", no Server Actions: selection lives entirely in the URL
 * (`?provider=&country=&keyword=`), and the only I/O this page performs
 * is `listTrackedMarketKeywords()` (which subjects even exist) and
 * `getMarketOpportunityEvidence()` (the existing Phase 3C.1E
 * orchestrator, called unchanged — this page never queries Supabase
 * directly for evidence, and never re-derives anything
 * `getMarketOpportunityEvidence()` already computes).
 *
 * `language` is deliberately never a query param — only `country` is,
 * and `toMarketCode` below is the one place that turns it into a full
 * `MarketCode`, so a hand-edited URL can never encode a mismatched
 * {country, language} pair (see `MarketCode`'s own doc comment on why
 * that combination is meant to be unrepresentable).
 */

type SearchParams = { provider?: string; country?: string; keyword?: string };

const KNOWN_PROVIDERS: readonly MarketIntelligenceProviderId[] = ["bing"];

function isKnownProvider(value: string): value is MarketIntelligenceProviderId {
	return (KNOWN_PROVIDERS as readonly string[]).includes(value);
}

/** The only place a `country` query param becomes a `MarketCode` — an
 * unsupported value is rejected (returns `null`) rather than guessed at
 * or inferred from the keyword text. */
function toMarketCode(country: string): MarketCode | null {
	if (country === "gb") return { country: "gb", language: "en-GB" };
	if (country === "pl") return { country: "pl", language: "pl-PL" };
	return null;
}

/** Parses `searchParams` into a subject only when every part is present
 * and valid — a partial or malformed selection is treated the same as
 * "nothing selected" (renders just the tracked-keyword list), never a
 * half-built/undefined-filled subject passed on to the evidence
 * orchestrator. */
function parseSelectedSubject(searchParams: SearchParams): MarketOpportunitySubject | null {
	const { provider, country, keyword } = searchParams;
	if (!provider || !country || !keyword) return null;
	if (!isKnownProvider(provider)) return null;
	const market = toMarketCode(country);
	if (!market) return null;
	return { provider, market, keyword };
}

function isSelected(row: TrackedMarketKeyword, selected: MarketOpportunitySubject | null): boolean {
	if (!selected) return false;
	return row.provider === selected.provider && row.market.country === selected.market.country && row.keyword === selected.keyword;
}

function rowHref(row: TrackedMarketKeyword): string {
	const params = new URLSearchParams({ provider: row.provider, country: row.market.country, keyword: row.keyword });
	return `?${params.toString()}`;
}

export default async function MarketOpportunitiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
	const resolvedSearchParams = await searchParams;
	const selectedSubject = parseSelectedSubject(resolvedSearchParams);

	const [trackedResult, evidenceResult] = await Promise.all([
		listTrackedMarketKeywords(),
		selectedSubject ? getMarketOpportunityEvidence(selectedSubject) : Promise.resolve(null),
	]);

	return (
		<div>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
				<h1 style={{ fontSize: "1.6rem", fontWeight: 600 }}>Market opportunities</h1>
				<Link href="/admin/insights" className="btn btn-ghost">
					Back to articles
				</Link>
			</div>
			<p style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 24, maxWidth: 720 }}>
				Read-only evidence assembled from external market data, CCS search visibility, content coverage and business
				relevance. This page describes the evidence only and does not make publishing or content recommendations.
			</p>

			{trackedResult.status === "error" ? (
				<div className="admin-empty">{ERROR_MESSAGE.storage_error}</div>
			) : trackedResult.rows.length === 0 ? (
				<div className="admin-empty">No market keywords are tracked yet.</div>
			) : (
				<div style={{ overflowX: "auto", marginBottom: 28 }}>
					<table className="admin-table">
						<thead>
							<tr>
								<th scope="col">Keyword</th>
								<th scope="col">Provider</th>
								<th scope="col">Market</th>
							</tr>
						</thead>
						<tbody>
							{trackedResult.rows.map((row) => {
								const selected = isSelected(row, selectedSubject);
								return (
									<tr key={row.id} style={selected ? { background: "var(--surface-2)" } : undefined}>
										<td>
											<Link href={rowHref(row)} aria-current={selected ? "true" : undefined}>
												{row.keyword}
											</Link>
										</td>
										<td>{row.provider}</td>
										<td>{row.market.country.toUpperCase()}</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}

			{selectedSubject && evidenceResult && (
				<>
					{evidenceResult.ok ? (
						<MarketOpportunityInspector evidence={evidenceResult.evidence} />
					) : (
						<div className="admin-empty">{ERROR_MESSAGE[evidenceResult.kind]}</div>
					)}
				</>
			)}
		</div>
	);
}
