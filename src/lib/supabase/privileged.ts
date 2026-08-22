import { createClient } from "@supabase/supabase-js";

/**
 * Server-only, service-role Supabase client. NEVER import this from a
 * Client Component or anything that ships to the browser - it bypasses RLS.
 *
 * This is the only path allowed to write lead tables (doc 05 §3 "public write
 * model" - anonymous direct inserts are not granted; forms submit to the
 * Next.js server boundary, which validates with Zod and then writes here).
 *
 * Returns null when production credentials are not configured, so the app
 * still renders and forms still "succeed" in local/dev UI testing without a
 * real database (doc 11 §3 "safe development fallback") - callers must log
 * a clear warning and must NOT claim the lead was persisted in that case.
 */
export function createSupabasePrivilegedClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
