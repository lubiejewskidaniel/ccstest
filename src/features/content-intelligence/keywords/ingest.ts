import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/supabase/adminAuth";
import { createGoogleSearchConsoleProvider } from "../google/GoogleSearchConsoleProvider";
import { createBingWebmasterProvider } from "../bing/BingWebmasterProvider";
import type { SearchPerformanceProvider } from "../types/searchProvider";

export type IngestResult =
	| { ok: true; rowsIngested: number; providersUsed: string[] }
	| { ok: false; kind: "auth"; message: string }
	| { ok: false; kind: "not_configured"; message: string }
	| { ok: false; kind: "provider_error"; message: string };

function providers(): SearchPerformanceProvider[] {
	return [createGoogleSearchConsoleProvider(), createBingWebmasterProvider()];
}

/** Whether at least one provider has its env vars set — read by the
 * admin UI to show a clear "nothing connected yet" message instead of a
 * misleadingly empty table (docs/INSIGHTS_ARCHITECTURE.md pattern: be
 * explicit about "not configured" rather than silently look like "no
 * data exists"). */
export function anyProviderConfigured(): boolean {
	return providers().some((provider) => provider.isConfigured());
}

export function configuredProviderIds(): string[] {
	return providers()
		.filter((provider) => provider.isConfigured())
		.map((provider) => provider.id);
}

/**
 * Pulls the last `daysBack` days of query performance from every
 * configured provider and upserts it into `search_performance_metrics`
 * (the unique `(source, query, page_url, metric_date)` constraint makes
 * a re-run idempotent — re-ingesting the same window just refreshes
 * clicks/impressions/position rather than duplicating rows).
 *
 * Triggered by an explicit editor/admin action in this checkpoint (no
 * scheduler yet — Checkpoint 8's job). Re-checks `getAdminSession()`
 * itself since this can be called directly from a Server Action bound to
 * a button, the same defense-in-depth pattern as
 * `src/features/insights/cms/service.ts`.
 */
export async function ingestSearchPerformance(daysBack = 28): Promise<IngestResult> {
	const session = await getAdminSession();
	if (!session?.isEditor) return { ok: false, kind: "auth", message: "You must be signed in as an editor to do this." };

	const active = providers().filter((provider) => provider.isConfigured());
	if (active.length === 0) {
		return {
			ok: false,
			kind: "not_configured",
			message:
				"No search data provider is configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY / GOOGLE_SEARCH_CONSOLE_SITE_URL and/or BING_WEBMASTER_API_KEY / BING_WEBMASTER_SITE_URL.",
		};
	}

	const supabase = await createSupabaseServerClient();
	if (!supabase) {
		return { ok: false, kind: "not_configured", message: "Supabase isn't configured in this environment." };
	}

	const endDate = new Date();
	const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);
	const range = { startDate: startDate.toISOString().slice(0, 10), endDate: endDate.toISOString().slice(0, 10) };

	let rowsIngested = 0;
	const providersUsed: string[] = [];

	for (const provider of active) {
		let rows;
		try {
			rows = await provider.fetchQueries(range);
		} catch (err) {
			return {
				ok: false,
				kind: "provider_error",
				message: `${provider.id} ingestion failed: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
		if (rows.length === 0) continue;

		providersUsed.push(provider.id);

		const { error } = await supabase.from("search_performance_metrics").upsert(
			rows.map((row) => ({
				source: row.source,
				query: row.query,
				// "" sentinel for "no page dimension" (Bing) — see the
				// column comment in 005_search_intelligence.sql for why
				// this can't just be NULL.
				page_url: row.pageUrl ?? "",
				metric_date: row.date,
				clicks: row.clicks,
				impressions: row.impressions,
				ctr: row.ctr,
				avg_position: row.position,
			})),
			{ onConflict: "source,query,page_url,metric_date" },
		);

		if (error) {
			return { ok: false, kind: "provider_error", message: `Storing ${provider.id} rows failed: ${error.message}` };
		}

		rowsIngested += rows.length;
	}

	return { ok: true, rowsIngested, providersUsed };
}
