import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/supabase/adminAuth";
import { matchArticleUrl } from "../monitoring/matchArticleUrl";
import type { Locale } from "@/lib/routes";

export type ArticleConversionRow = { locale: Locale; slug: string; conversions: number };

export type ConversionResult =
	| { ok: true; rows: ArticleConversionRow[] }
	| { ok: false; kind: "auth"; message: string };

const LEAD_TABLES = ["project_leads", "marketing_enquiries", "mentoring_enquiries"] as const;

/**
 * Operationalizes Decision 12 ("traffic alone does not determine
 * success — conversions matter") for Insights specifically: which
 * articles' `landing_page` (captured at first touch,
 * `002_lead_attribution.sql`, already sent with every lead submission)
 * shows up on an actual lead.
 *
 * Admin-only, not editor — deliberately narrower than every other
 * Checkpoint 9 module. The three lead tables' RLS `select` policies
 * (`001_initial.sql`) only grant `is_active_admin()`, not
 * `is_active_editor_or_admin()`, matching the same boundary
 * `/admin/leads` already enforces (docs/INSIGHTS_ARCHITECTURE.md §9:
 * lead data spans all three business lines and isn't an editor's
 * concern). This function checks that explicitly rather than relying on
 * RLS to silently return zero rows for a non-admin session, so the
 * caller gets a clear reason instead of a table that looks like "no
 * conversions yet".
 */
export async function getArticleConversions(daysBack = 90): Promise<ConversionResult> {
	const session = await getAdminSession();
	if (!session?.isAdmin) return { ok: false, kind: "auth", message: "Conversion data is admin-only." };

	const supabase = await createSupabaseServerClient();
	if (!supabase) return { ok: true, rows: [] };

	const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
	const counts = new Map<string, number>();

	for (const table of LEAD_TABLES) {
		const { data } = await supabase.from(table).select("landing_page, created_at").gte("created_at", cutoff);

		for (const row of data ?? []) {
			const match = matchArticleUrl(row.landing_page as string | null);
			if (!match) continue;
			const key = `${match.locale}:${match.slug}`;
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
	}

	const rows: ArticleConversionRow[] = Array.from(counts.entries())
		.map(([key, conversions]) => {
			const [locale, slug] = key.split(":") as [Locale, string];
			return { locale, slug, conversions };
		})
		.sort((a, b) => b.conversions - a.conversions);

	return { ok: true, rows };
}
