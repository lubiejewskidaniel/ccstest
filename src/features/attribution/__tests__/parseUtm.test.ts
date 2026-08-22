import { describe, it, expect } from "vitest";
import { parseUtmParams, hasUtmParams } from "../storage";

describe("parseUtmParams", () => {
  it("extracts all five UTM params from a query string", () => {
    const result = parseUtmParams("?utm_source=google&utm_medium=cpc&utm_campaign=spring&utm_content=ad1&utm_term=react");
    expect(result).toEqual({
      source: "google",
      medium: "cpc",
      campaign: "spring",
      content: "ad1",
      term: "react",
    });
  });

  it("returns null for any UTM param that isn't present", () => {
    const result = parseUtmParams("?utm_source=google");
    expect(result.source).toBe("google");
    expect(result.medium).toBeNull();
    expect(result.campaign).toBeNull();
  });

  it("returns all-null for an empty query string", () => {
    const result = parseUtmParams("");
    expect(result).toEqual({ source: null, medium: null, campaign: null, content: null, term: null });
  });

  it("ignores non-UTM query params", () => {
    const result = parseUtmParams("?ref=newsletter&utm_source=twitter");
    expect(result.source).toBe("twitter");
  });
});

describe("hasUtmParams", () => {
  it("is true when at least one UTM param is present", () => {
    expect(hasUtmParams("?utm_campaign=spring")).toBe(true);
  });

  it("is false when the query string has no UTM params", () => {
    expect(hasUtmParams("?foo=bar")).toBe(false);
  });

  it("is false for an empty query string", () => {
    expect(hasUtmParams("")).toBe(false);
  });
});
