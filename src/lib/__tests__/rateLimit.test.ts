import { describe, it, expect, vi, afterEach } from "vitest";
import { checkRateLimit, getClientIp } from "../rateLimit";

// Each test uses its own random key - `checkRateLimit`'s bucket map is a
// module-level singleton shared across every test in this file (matching
// the real single-instance runtime behaviour documented in rateLimit.ts),
// so distinct keys keep the tests independent of each other.
const uniqueKey = () => `test-${Math.random().toString(36).slice(2)}`;

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("allows requests up to the configured limit within the window", () => {
    const key = uniqueKey();
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, { limit: 3, windowMs: 60_000 }).allowed).toBe(true);
    }
  });

  it("rejects the request once the limit is exceeded, with a positive retry-after", () => {
    const key = uniqueKey();
    for (let i = 0; i < 3; i++) checkRateLimit(key, { limit: 3, windowMs: 60_000 });
    const result = checkRateLimit(key, { limit: 3, windowMs: 60_000 });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks separate keys independently", () => {
    const a = uniqueKey();
    const b = uniqueKey();
    checkRateLimit(a, { limit: 1, windowMs: 60_000 });
    expect(checkRateLimit(a, { limit: 1, windowMs: 60_000 }).allowed).toBe(false);
    expect(checkRateLimit(b, { limit: 1, windowMs: 60_000 }).allowed).toBe(true);
  });

  it("resets the window once windowMs has elapsed", () => {
    vi.useFakeTimers();
    const key = uniqueKey();
    expect(checkRateLimit(key, { limit: 1, windowMs: 1000 }).allowed).toBe(true);
    expect(checkRateLimit(key, { limit: 1, windowMs: 1000 }).allowed).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(checkRateLimit(key, { limit: 1, windowMs: 1000 }).allowed).toBe(true);
  });
});

describe("getClientIp", () => {
  it("prefers x-forwarded-for and takes the first entry in the list", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getClientIp(headers)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const headers = new Headers({ "x-real-ip": "9.9.9.9" });
    expect(getClientIp(headers)).toBe("9.9.9.9");
  });

  it('falls back to "unknown" when neither header is present', () => {
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});
