import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Refreshes the Supabase auth session cookie on every request under
 * /admin/**, per the @supabase/ssr cookie-refresh pattern - without this,
 * a signed-in admin's session silently expires client-navigation to
 * client-navigation. No-ops (passes the request straight through) when
 * Supabase env vars aren't configured, matching the rest of the app's
 * "safe without a real backend" fallback.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Touching getUser() is what actually triggers the refresh.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
