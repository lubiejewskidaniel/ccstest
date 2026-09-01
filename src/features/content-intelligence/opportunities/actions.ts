import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/supabase/adminAuth";

export type OpportunityStatus = "new" | "reviewing" | "briefed" | "dismissed";

export type OpportunityActionResult =
	| { ok: true }
	| { ok: false; kind: "auth"; message: string }
	| { ok: false; kind: "persistence"; message: string };

/**
 * Marks an opportunity reviewing/dismissed/briefed. "Briefed" here just
 * means "an editor has decided this is worth writing" — it does not
 * create a content brief record (that's Checkpoint 7, which doesn't
 * exist yet), it's a planning-stage bookmark so the same opportunity
 * doesn't keep resurfacing at the top of the list after someone's
 * already claimed it.
 */
export async function setOpportunityStatus(id: string, status: OpportunityStatus): Promise<OpportunityActionResult> {
	const session = await getAdminSession();
	if (!session?.isEditor) return { ok: false, kind: "auth", message: "You must be signed in as an editor to do this." };

	const supabase = await createSupabaseServerClient();
	if (!supabase) return { ok: false, kind: "persistence", message: "Supabase isn't configured in this environment." };

	const { error } = await supabase.from("content_opportunities").update({ status }).eq("id", id);
	if (error) return { ok: false, kind: "persistence", message: error.message };

	return { ok: true };
}
