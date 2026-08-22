import { createSupabaseServerClient } from "./server";

export type AdminSession = {
  userId: string;
  email: string | null;
  roles: string[];
};

/**
 * Resolves the current admin session, or null if there isn't one. "Admin"
 * requires both a role row AND an active profile (doc 08 SEC-006 "role
 * checks SHALL include active-account state") - a deactivated staff
 * account with a lingering role row is still denied.
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
  if (!roles.includes("admin")) return null;

  return { userId: user.id, email: user.email ?? null, roles };
}
