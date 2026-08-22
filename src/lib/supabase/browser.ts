import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client. Only ever uses the public URL + publishable key -
 * never the service role key. Used for things like reading public, non-sensitive
 * data client-side (currently unused by lead forms, which go through the
 * server action, but kept for future client-side reads).
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createBrowserClient(url, key);
}
