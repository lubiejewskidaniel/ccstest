import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHubSpotProvider } from "../HubSpotProvider";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.CRM_API_KEY;
  delete process.env.CRM_PORTAL_ID;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("HubSpotProvider.isConfigured", () => {
  it("is false when CRM_API_KEY/CRM_PORTAL_ID are unset", () => {
    expect(createHubSpotProvider().isConfigured()).toBe(false);
  });

  it("is false when only one of the two env vars is set", () => {
    process.env.CRM_API_KEY = "test-key";
    expect(createHubSpotProvider().isConfigured()).toBe(false);
  });

  it("is true once both CRM_API_KEY and CRM_PORTAL_ID are set", () => {
    process.env.CRM_API_KEY = "test-key";
    process.env.CRM_PORTAL_ID = "12345";
    expect(createHubSpotProvider().isConfigured()).toBe(true);
  });
});

describe("HubSpotProvider.createContact", () => {
  it("never calls fetch when unconfigured", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await createHubSpotProvider().createContact({ email: "a@b.com", name: "A B", locale: "en" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("PATCHes the contact-by-email endpoint with a bearer token once configured", async () => {
    process.env.CRM_API_KEY = "test-key";
    process.env.CRM_PORTAL_ID = "12345";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));

    await createHubSpotProvider().createContact({ email: "jane@example.com", name: "Jane Doe", locale: "en" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toBe("https://api.hubapi.com/crm/v3/objects/contacts/jane%40example.com?idProperty=email");
    expect(init?.method).toBe("PATCH");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    const body = JSON.parse(String(init?.body));
    expect(body.properties.email).toBe("jane@example.com");
    expect(body.properties.firstname).toBe("Jane");
    expect(body.properties.lastname).toBe("Doe");
  });

  it("falls back to POST when the PATCH 404s (contact doesn't exist yet)", async () => {
    process.env.CRM_API_KEY = "test-key";
    process.env.CRM_PORTAL_ID = "12345";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    await createHubSpotProvider().createContact({ email: "new@example.com", name: "New Person", locale: "pl" });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[0]?.[1]?.method).toBe("PATCH");
    expect(fetchSpy.mock.calls[1]?.[1]?.method).toBe("POST");
  });

  it("propagates a non-404 API error instead of silently swallowing it", async () => {
    process.env.CRM_API_KEY = "test-key";
    process.env.CRM_PORTAL_ID = "12345";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("server error", { status: 500 }));

    await expect(
      createHubSpotProvider().createContact({ email: "err@example.com", name: "Err Or", locale: "en" })
    ).rejects.toThrow(/500/);
  });
});

describe("HubSpotProvider.createLead", () => {
  it("PATCHes the CCS custom properties onto the existing contact", async () => {
    process.env.CRM_API_KEY = "test-key";
    process.env.CRM_PORTAL_ID = "12345";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));

    await createHubSpotProvider().createLead({
      type: "project",
      contact: { email: "lead@example.com", name: "Lead Person", locale: "en" },
      summary: "Wants a new SaaS product built.",
      source: "google",
      medium: "cpc",
      campaign: "spring",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0]!;
    const body = JSON.parse(String(init?.body));
    expect(body.properties).toMatchObject({
      ccs_enquiry_type: "project",
      ccs_enquiry_summary: "Wants a new SaaS product built.",
      ccs_utm_source: "google",
      ccs_utm_medium: "cpc",
      ccs_utm_campaign: "spring",
    });
  });

  it("never calls fetch when unconfigured", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await createHubSpotProvider().createLead({
      type: "mentoring",
      contact: { email: "x@y.com", name: "X Y", locale: "pl" },
      summary: "s",
      source: null,
      medium: null,
      campaign: null,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
