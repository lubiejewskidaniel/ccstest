import { describe, it, expect } from "vitest";
import { buildPageMetadata, siteName } from "../metadata";
import type { Metadata } from "next";

// Next's `Metadata` type has broad union shapes for `openGraph`/`twitter`;
// tests read through them structurally rather than fighting the type, since
// `buildPageMetadata` always produces the same concrete literal shape.
function ogTitle(meta: Metadata): unknown {
  return (meta.openGraph as { title?: unknown } | undefined)?.title;
}
function twitterTitle(meta: Metadata): unknown {
  return (meta.twitter as { title?: unknown } | undefined)?.title;
}

describe("buildPageMetadata", () => {
  it("uses the route's own path as the canonical for the given locale", () => {
    const en = buildPageMetadata({ routeKey: "services", locale: "en", title: "Services", description: "d" });
    const pl = buildPageMetadata({ routeKey: "services", locale: "pl", title: "Usługi", description: "d" });
    expect(en.alternates?.canonical).toBe("/services");
    expect(pl.alternates?.canonical).toBe("/pl/uslugi");
  });

  it("includes both locales plus x-default (pointing at English) in hreflang", () => {
    const meta = buildPageMetadata({ routeKey: "growth", locale: "en", title: "Growth", description: "d" });
    expect(meta.alternates?.languages).toEqual({
      en: "/growth",
      pl: "/pl/marketing",
      "x-default": "/growth",
    });
  });

  it("leaves robots unset (indexable) by default", () => {
    const meta = buildPageMetadata({ routeKey: "contact", locale: "en", title: "Contact", description: "d" });
    expect(meta.robots).toBeUndefined();
  });

  it("sets robots to noindex,nofollow when noindex is requested", () => {
    const meta = buildPageMetadata({ routeKey: "contact", locale: "en", title: "Contact", description: "d", noindex: true });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("keeps the plain <title> short but appends the site name to OG/Twitter titles", () => {
    const meta = buildPageMetadata({ routeKey: "about", locale: "en", title: "About", description: "d" });
    expect(meta.title).toBe("About");
    expect(ogTitle(meta)).toBe(`About · ${siteName}`);
    expect(twitterTitle(meta)).toBe(`About · ${siteName}`);
  });

  it("sets the correct Open Graph locale per language", () => {
    const en = buildPageMetadata({ routeKey: "home", locale: "en", title: "Home", description: "d" });
    const pl = buildPageMetadata({ routeKey: "home", locale: "pl", title: "Home", description: "d" });
    expect((en.openGraph as { locale?: unknown })?.locale).toBe("en_US");
    expect((pl.openGraph as { locale?: unknown })?.locale).toBe("pl_PL");
  });
});
