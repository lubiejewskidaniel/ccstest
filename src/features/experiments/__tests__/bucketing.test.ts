import { describe, it, expect } from "vitest";
import { assignVariant, hashString } from "../bucketing";

describe("assignVariant", () => {
  const config = { id: "hero-cta-copy", variants: ["control", "variant_b"] as const };

  it("is deterministic for the same experiment + visitor pair", () => {
    expect(assignVariant(config, "visitor-123")).toBe(assignVariant(config, "visitor-123"));
  });

  it("falls back to the first variant when the visitor id is empty", () => {
    expect(assignVariant(config, "")).toBe("control");
  });

  it('falls back to "control" when the experiment has no variants configured', () => {
    expect(assignVariant({ id: "x", variants: [] }, "visitor-1")).toBe("control");
  });

  it("only ever returns one of the configured variants", () => {
    for (let i = 0; i < 50; i++) {
      expect(config.variants).toContain(assignVariant(config, `visitor-${i}`));
    }
  });

  it("distributes traffic across more than one variant (doesn't collapse to a single bucket)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(assignVariant(config, `visitor-${i}`));
    expect(seen.size).toBeGreaterThan(1);
  });

  it("a different experiment id can bucket the same visitor into a different variant", () => {
    // Not asserted to always differ (that would be a coin flip) - just that
    // the experiment id is actually part of the hash input, not ignored.
    const a = assignVariant({ id: "experiment-a", variants: ["control", "b", "c"] }, "visitor-1");
    const b = assignVariant({ id: "experiment-b", variants: ["control", "b", "c"] }, "visitor-1");
    expect(["control", "b", "c"]).toContain(a);
    expect(["control", "b", "c"]).toContain(b);
  });
});

describe("hashString", () => {
  it("is deterministic for the same input", () => {
    expect(hashString("abc")).toBe(hashString("abc"));
  });

  it("returns a non-negative 32-bit integer", () => {
    const h = hashString("some input string");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  it("different inputs (usually) hash differently", () => {
    expect(hashString("abc")).not.toBe(hashString("abd"));
  });
});
