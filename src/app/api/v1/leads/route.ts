import { NextResponse, type NextRequest } from "next/server";
import { createProjectLead, createMarketingLead, createMentoringLead } from "@/features/leads/service";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

/**
 * Versioned public lead API (brief §8, §23 `app/api/v1/leads/`). This is a
 * second entry point into the same `src/features/leads/service.ts` the
 * form Server Actions already use - nothing here duplicates validation or
 * persistence logic. It exists for any future caller that isn't this
 * app's own React forms (a separate marketing microsite, a native app, a
 * partner integration) without them needing to reimplement the pipeline.
 *
 * Request body: `{ type: "project" | "marketing" | "mentoring", ...fields }`
 * - the field shape for each `type` matches the corresponding Zod schema
 * in `src/lib/validation/schemas.ts` (camelCase, same names the forms use).
 *
 * Rate limited at 5 requests / 10 minutes per client IP (see
 * `src/lib/rateLimit.ts` for the known single-instance limitation).
 */

const RATE_LIMIT = { limit: 5, windowMs: 10 * 60 * 1000 };

type LeadRequestBody = { type?: unknown; [key: string]: unknown };

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rate = checkRateLimit(`leads:${ip}`, RATE_LIMIT);
  if (!rate.allowed) {
    return NextResponse.json(
      { status: "error", message: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  let body: LeadRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid JSON body." }, { status: 400 });
  }

  const { type, ...fields } = body;

  const handler =
    type === "project" ? createProjectLead : type === "marketing" ? createMarketingLead : type === "mentoring" ? createMentoringLead : null;

  if (!handler) {
    return NextResponse.json(
      { status: "error", message: 'Field "type" must be one of: "project", "marketing", "mentoring".' },
      { status: 400 }
    );
  }

  const result = await handler(fields);

  if (result.ok) {
    return NextResponse.json({ status: "ok" }, { status: 201 });
  }
  if (result.kind === "validation") {
    return NextResponse.json({ status: "error", fieldErrors: result.fieldErrors }, { status: 400 });
  }
  return NextResponse.json({ status: "error", message: result.message }, { status: 500 });
}
