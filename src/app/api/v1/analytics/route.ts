import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

/**
 * First-party event sink (brief §23 `app/api/v1/analytics/`). GA4 remains
 * the primary provider (`src/lib/analytics/track.ts`'s `ga4Provider`), but
 * GA4-only data isn't directly queryable for the funnel math in brief §7
 * without a BigQuery export. This endpoint is the seam for a durable,
 * first-party event log this app actually owns - currently it validates
 * and logs structurally (`console.log`, visible in server logs / your
 * platform's log drain); wiring a real sink (a Postgres table, a
 * warehouse) is a contained change inside this one file, not a new
 * architecture.
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

  // Structured log line - a stand-in for a real warehouse write. Keep this
  // the ONLY place that persists events so a future sink swap stays
  // contained here.
  console.log(
    JSON.stringify({
      kind: "analytics_event",
      name: body.name,
      properties: body.properties ?? {},
      receivedAt: new Date().toISOString(),
    })
  );

  return NextResponse.json({ status: "ok" }, { status: 202 });
}
