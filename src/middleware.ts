import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Two unrelated jobs share this one middleware (Next.js runs a single
 * middleware per matched request, so both live here rather than as
 * separate files):
 *
 * 1. Locale header (every route, per the broad `matcher` below). Stamps
 *    `x-locale` ("en" | "pl", same /pl-prefix rule as src/lib/routes.ts)
 *    onto the request so the root layout - a Server Component - can set
 *    server-rendered `<html lang>` correctly for the actual HTTP response
 *    to /pl/uslugi, /services, etc. Without this the root layout has no
 *    reliable way to know the locale before the request reaches it
 *    (usePathname is client-only, and this app deliberately doesn't use a
 *    [locale] dynamic segment - see app/layout.tsx). Client-side
 *    navigation between locales is still corrected by MotionSystem's
 *    pathname effect, since the root layout doesn't re-run on those.
 *
 * 2. Refreshes the Supabase auth session cookie on every request under
 *    /admin/**, per the @supabase/ssr cookie-refresh pattern - without
 *    this, a signed-in admin's session silently expires client-navigation
 *    to client-navigation. No-ops (passes the request straight through,
 *    locale header still set) when Supabase env vars aren't configured,
 *    matching the rest of the app's "safe without a real backend" fallback.
 */
export async function middleware(request: NextRequest) {
  const locale = request.nextUrl.pathname.startsWith("/pl") ? "pl" : "en";
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-locale", locale);

  if (!request.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next({ request: { headers: requestHeaders } });

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Touching getUser() is what actually triggers the refresh.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on every route except Next.js internals and static files (which
     * don't render <html lang> anyway), so the locale header is available
     * everywhere - this also covers /admin/:path*, handled above.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\..*).*)",
  ],
};
