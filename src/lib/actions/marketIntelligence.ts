"use server";

import { revalidatePath } from "next/cache";
import { fetchMarketKeywordStats, type FetchMarketKeywordStatsResult } from "@/features/content-intelligence/market/fetchMarketKeywordStats";
import type { MarketCode } from "@/features/content-intelligence/market/types";

const MARKET_OPPORTUNITIES_PATH = "/admin/insights/market-opportunities";

// Only "gb"/"pl" are ever accepted from the client -- language is always
// derived here, never taken from the caller, so a tampered request can't
// submit a mismatched country/language pair.
const MARKET_BY_COUNTRY: Record<string, MarketCode> = {
	gb: { country: "gb", language: "en-GB" },
	pl: { country: "pl", language: "pl-PL" },
};

export type MarketKeywordActionResult = FetchMarketKeywordStatsResult | { ok: false; kind: "validation"; message: string };

export async function fetchMarketKeywordStatsAction(keyword: string, country: string): Promise<MarketKeywordActionResult> {
	const trimmed = keyword.trim();
	if (!trimmed) return { ok: false, kind: "validation", message: "Enter a keyword." };

	const market = MARKET_BY_COUNTRY[country];
	if (!market) return { ok: false, kind: "validation", message: "Unsupported market." };

	const result = await fetchMarketKeywordStats(trimmed, market);
	if (result.ok) revalidatePath(MARKET_OPPORTUNITIES_PATH);
	return result;
}
