import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { createSupabasePrivilegedClient } from "@/lib/supabase/privileged";

/**
 * First-party event sink (brief §23 `app/api/v1/analytics/`). GA4 remains
 * the primary provider (`src/lib/analytics/track.ts`'s `ga4Provider`), but
 * GA4-only data isn't directly queryable for the funnel math in brief §7
 * without a BigQuery export. This endpoint is the durable, first-party
 * event log this app actually owns.
 *
 * Checkpoint 5 (Insights Analytics foundation) wired this to a real
 * table (`analytics_events`, `supabase/migrations/004_analytics_events.
 * sql`) via the service-role client — the exact "contained change inside
 * this one file" this comment previously said a real sink would be, no
 * new architecture. Falls back to the same structured console.log as
 * before when Supabase isn't configured, so nothing breaks in local/dev
 * without production credentials (this app's usual "safe development
 * fallback").
 *
 * The client only calls this once analytics consent is granted (see
 * `firstPartyProvider` in `src/lib/analytics/track.ts`) - this route does
 * not itself re-check consent, since it has no session/cookie context to
 * check it against; it trusts the same client-side gate every other
 * provider trusts.
 */

const RATE_LIMIT = { limit: 120, windowMs: 60 * 1000 };

type EventBody = { name?: unknown; properties?: unknown };

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rate = checkRateLimit(`analytics:${ip}`, RATE_LIMIT);
  if (!rate.allowed) {
    return NextResponse.json({ status: "error" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  }

  let body: EventBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.name !== "string" || !body.name) {
    return NextResponse.json({ status: "error", message: 'Field "name" is required.' }, { status: 400 });
  }

  const properties = body.properties && typeof body.properties === "object" ? body.properties : {};

  const supabase = createSupabasePrivilegedClient();
  if (supabase) {
    const { error } = await supabase.from("analytics_events").insert({ name: body.name, properties });
    if (error) {
      // Never fail the request over a persistence hiccup - the client
      // fired this with `keepalive` expecting a fire-and-forget beacon,
      // not something that should retry or surface to the visitor.
      console.error("[analytics] event insert failed:", error.message);
    }
  } else {
    // Structured log line - the pre-Checkpoint-5 fallback, kept for
    // local/dev without production Supabase credentials.
    console.log(
      JSON.stringify({
        kind: "analytics_event",
        name: body.name,
        properties,
        receivedAt: new Date().toISOString(),
      })
    );
  }

  return NextResponse.json({ status: "ok" }, { status: 202 });
}
