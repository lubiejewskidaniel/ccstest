import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { siteUrl } from "@/lib/seo/metadata";
import { pingIndexNow } from "../indexNow";

/**
 * `pingIndexNow()` unit tests, mirroring the direct-fetch-mocking style
 * already used by `src/lib/crm/__tests__/HubSpotProvider.test.ts`.
 *
 * The `keyLocation` assertions here are the regression guard for the
 * domain-root fix: Bing's real IndexNow verifier rejected the previous
 * `/api/indexnow-key.txt` keyLocation with an HTTP 422
 * ("...URLs are not related to your site verified through the
 * keylocation parameter"), even though that path served the key
 * correctly and validated fine against IndexNow's written spec — in
 * practice the key file has to live at the literal domain root. This
 * file, unlike `cms/__tests__/service.indexnow.test.ts`, only checks
 * `pingIndexNow()`'s own request shape, not the CMS trigger logic that
 * calls it (unchanged by this fix).
 */

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("pingIndexNow", () => {
  it("never calls fetch when INDEXNOW_KEY is unset", async () => {
    delete process.env.INDEXNOW_KEY;
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await pingIndexNow(["https://codeconsultingstudio.com/insights/my-article"]);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never calls fetch when the URL list is empty", async () => {
    process.env.INDEXNOW_KEY = "abc123def456";
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await pingIndexNow([]);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("submits to the IndexNow API with a domain-root keyLocation, not /api/...", async () => {
    process.env.INDEXNOW_KEY = "abc123def456";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));

    await pingIndexNow(["https://codeconsultingstudio.com/insights/my-article"]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://api.indexnow.org/indexnow");

    const call = fetchSpy.mock.calls[0] as [unknown, RequestInit | undefined] | undefined;
    const body = JSON.parse(String(call?.[1]?.body));

    expect(body.key).toBe("abc123def456");
    expect(body.keyLocation).toBe(new URL("/abc123def456.txt", siteUrl).toString());
    expect(body.keyLocation).not.toContain("/api/");
    expect(body.urlList).toEqual(["https://codeconsultingstudio.com/insights/my-article"]);
  });

  it("still submits the article URLs given, unaffected by the keyLocation change", async () => {
    process.env.INDEXNOW_KEY = "abc123def456";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const urls = [
      "https://codeconsultingstudio.com/insights/my-article",
      "https://codeconsultingstudio.com/pl/wiedza/moj-artykul",
    ];

    await pingIndexNow(urls);

    const call = fetchSpy.mock.calls[0] as [unknown, RequestInit | undefined] | undefined;
    const body = JSON.parse(String(call?.[1]?.body));
    expect(body.urlList).toEqual(urls);
  });

  it("logs but does not throw when the IndexNow API rejects the submission (e.g. a 422 keyLocation mismatch)", async () => {
    process.env.INDEXNOW_KEY = "abc123def456";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("InvalidRequestParameters", { status: 422 }));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      pingIndexNow(["https://codeconsultingstudio.com/insights/my-article"])
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("logs but does not throw when the fetch itself fails (network error)", async () => {
    process.env.INDEXNOW_KEY = "abc123def456";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      pingIndexNow(["https://codeconsultingstudio.com/insights/my-article"])
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });
});
