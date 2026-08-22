/**
 * In-memory sliding-window rate limiter for public API routes (brief §25
 * "rate limiting for public forms" / §8 lead pipeline).
 *
 * KNOWN LIMITATION: this state lives in the Node process's memory, so it
 * resets on redeploy and is NOT shared across multiple server instances -
 * fine for a single-instance deployment or as a first line of defense, but
 * a multi-instance production deployment (e.g. several Vercel/Node
 * instances behind a load balancer) needs a shared store (Upstash Redis,
 * Vercel KV, etc.) for this to actually hold under distributed traffic.
 * Documented in docs/LEAD_MANAGEMENT.md - swapping the implementation
 * behind `checkRateLimit()` is a contained change; no caller needs to
 * change.
 */

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

// Periodically forget stale buckets so this doesn't grow unbounded over a
// long-running process.
const MAX_TRACKED_KEYS = 5000;

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export function checkRateLimit(key: string, opts: { limit: number; windowMs: number }): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStart >= opts.windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    if (buckets.size > MAX_TRACKED_KEYS) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey) buckets.delete(oldestKey);
    }
    return { allowed: true };
  }

  if (existing.count >= opts.limit) {
    const retryAfterSeconds = Math.ceil((opts.windowMs - (now - existing.windowStart)) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  existing.count += 1;
  return { allowed: true };
}

/** Best-effort client identifier from standard proxy headers. */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}
