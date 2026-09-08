import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The one hop a Supabase PKCE recovery link needs. `createSupabaseServerClient`
 * writes the exchanged session via `next/headers`'s `cookies().set(...)`
 * (see server.ts), which is only actually persisted outside a Server
 * Component render - inside a render it's caught and silently ignored
 * (server.ts's own comment), relying on the middleware refresh instead.
 * `/admin/reset-password/page.tsx` is a Server Component, so the
 * code -> session exchange can't happen there; a Route Handler can set
 * cookies on the response it returns, so it happens here, once, before
 * redirecting on to that page with a real session already in place.
 *
 * No new Supabase client pattern - this reuses `createSupabaseServerClient()`
 * exactly as every other admin auth path does.
 */
export async function GET(request: NextRequest) {
	const code = request.nextUrl.searchParams.get("code");
	const loginUrl = new URL("/admin/login", request.url);
	const resetPasswordUrl = new URL("/admin/reset-password", request.url);

	if (!code) {
		loginUrl.searchParams.set("error", "reset_link_invalid");
		return NextResponse.redirect(loginUrl);
	}

	const supabase = await createSupabaseServerClient();
	if (!supabase) {
		loginUrl.searchParams.set("error", "reset_link_invalid");
		return NextResponse.redirect(loginUrl);
	}

	const { error } = await supabase.auth.exchangeCodeForSession(code);
	if (error) {
		loginUrl.searchParams.set("error", "reset_link_invalid");
		return NextResponse.redirect(loginUrl);
	}

	return NextResponse.redirect(resetPasswordUrl);
}
