import { createSupabaseServerClient } from "./server";

export type AdminSession = {
  userId: string;
  email: string | null;
  roles: string[];
  /** Full admin — sees everything under /admin, including cross-business
   * lead data. */
  isAdmin: boolean;
  /** Admin OR editor — the minimum bar to sign into /admin at all and
   * reach /admin/insights (Insights Checkpoint 3, master instruction
   * Decision 10: "editor" is a distinct, lesser role from "admin"). */
  isEditor: boolean;
};

/**
 * Resolves the current admin session, or null if there isn't one.
 * Requires an active profile AND at least one of the two staff roles
 * (doc 08 SEC-006 "role checks SHALL include active-account state") - a
 * deactivated staff account with a lingering role row is still denied,
 * and a `mentor`-only role (present in the schema but not a staff-area
 * role) does not grant /admin access.
 *
 * Originally this only recognized `admin` — widened here so an
 * `editor`-only account can reach `/admin/insights` without being
 * treated as a full admin. Callers that need to gate something
 * admin-only (e.g. `/admin/leads`, which spans all three business lines
 * and has nothing to do with content) check `session.isAdmin`
 * explicitly rather than relying on `getAdminSession` returning null.
 *
 * Returns null (rather than throwing) when Supabase isn't configured, so
 * the admin area degrades to "not available" instead of crashing in
 * environments without a real backend yet.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.active !== true) return null;

  const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const roles = (roleRows ?? []).map((r) => r.role as string);

  const isAdmin = roles.includes("admin");
  const isEditor = isAdmin || roles.includes("editor");
  if (!isEditor) return null;

  return { userId: user.id, email: user.email ?? null, roles, isAdmin, isEditor };
}
