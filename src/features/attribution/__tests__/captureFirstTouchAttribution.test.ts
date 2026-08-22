import { describe, it, expect, beforeEach } from "vitest";
import { captureFirstTouchAttribution, getStoredAttribution } from "../storage";

/**
 * `jsdom` (the Vitest environment for this project - see vitest.config.ts)
 * provides a real, working `window.localStorage`, so these tests exercise
 * the actual storage read/write path rather than a mock.
 */
describe("captureFirstTouchAttribution", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("on a fresh visit with no UTM params and no referrer, records direct/none", () => {
    const data = captureFirstTouchAttribution({ search: "", pathname: "/" }, "");
    expect(data.source).toBe("direct");
    expect(data.medium).toBe("none");
    expect(data.campaign).toBeNull();
    expect(data.landingPage).toBe("/");
    expect(getStoredAttribution()).toEqual(data);
  });

  it("on a fresh visit with a referrer but no UTM params, records the referrer's hostname as source", () => {
    const data = captureFirstTouchAttribution({ search: "", pathname: "/services" }, "https://www.google.com/search?q=ccs");
    expect(data.source).toBe("www.google.com");
    expect(data.medium).toBe("referral");
    expect(data.referrer).toBe("https://www.google.com/search?q=ccs");
  });

  it("on a fresh visit with UTM params, records them as the first touch", () => {
    const data = captureFirstTouchAttribution(
      { search: "?utm_source=newsletter&utm_medium=email&utm_campaign=q3", pathname: "/growth" },
      ""
    );
    expect(data.source).toBe("newsletter");
    expect(data.medium).toBe("email");
    expect(data.campaign).toBe("q3");
    expect(data.landingPage).toBe("/growth");
  });

  it("does NOT overwrite an existing first touch on a plain repeat visit (no UTM params)", () => {
    const first = captureFirstTouchAttribution(
      { search: "?utm_source=newsletter&utm_medium=email", pathname: "/growth" },
      ""
    );
    const second = captureFirstTouchAttribution({ search: "", pathname: "/contact" }, "");
    expect(second).toEqual(first);
    expect(second.landingPage).toBe("/growth"); // unchanged - still the original landing page
  });

  it("re-attributes when a later visit carries fresh UTM params, but keeps the original landingPage/capturedAt/referrer", () => {
    const first = captureFirstTouchAttribution(
      { search: "?utm_source=newsletter&utm_medium=email", pathname: "/growth" },
      "https://oldreferrer.example/"
    );
    const second = captureFirstTouchAttribution(
      { search: "?utm_source=twitter&utm_medium=social&utm_campaign=relaunch", pathname: "/contact" },
      "https://twitter.com/"
    );

    expect(second.source).toBe("twitter");
    expect(second.medium).toBe("social");
    expect(second.campaign).toBe("relaunch");
    // Landing page, original referrer and capture timestamp describe the
    // FIRST visit and must not change on a later re-attribution.
    expect(second.landingPage).toBe(first.landingPage);
    expect(second.referrer).toBe(first.referrer);
    expect(second.capturedAt).toBe(first.capturedAt);
  });
});
