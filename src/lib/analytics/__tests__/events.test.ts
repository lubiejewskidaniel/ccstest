import { describe, it, expect, vi, beforeEach } from "vitest";

// `events.ts` only ever calls `dispatchEvent` from `./track` - mocking that
// one seam lets these tests assert the taxonomy's name/property shape
// without touching `window.gtag` or making a real `fetch` call.
//
// The mock variable MUST be prefixed with `mock` - Vitest hoists `vi.mock`
// factories above imports, and only allows a factory to close over an
// outer variable whose name starts with `mock` (anything else throws a
// "cannot access before initialization" hoisting error at run time).
const mockDispatchEvent = vi.fn();
vi.mock("../track", () => ({ dispatchEvent: (payload: unknown) => mockDispatchEvent(payload) }));

const { events } = await import("../events");
const ctx = { page: "/services", locale: "en" as const, campaign: null, source: null, medium: null, referrer: null };

beforeEach(() => {
  mockDispatchEvent.mockClear();
});

describe("events taxonomy", () => {
  it("pageView sends only the base context, under the name page_view", () => {
    events.pageView(ctx);
    expect(mockDispatchEvent).toHaveBeenCalledWith({ name: "page_view", properties: { ...ctx } });
  });

  it("serviceView attaches the service slug", () => {
    events.serviceView("mentoring", ctx);
    expect(mockDispatchEvent).toHaveBeenCalledWith({
      name: "service_view",
      properties: { ...ctx, service: "mentoring" },
    });
  });

  it("serviceCtaClick attaches both service and cta_location", () => {
    events.serviceCtaClick("growth-marketing", "homepage-capabilities", ctx);
    expect(mockDispatchEvent).toHaveBeenCalledWith({
      name: "service_cta_click",
      properties: { ...ctx, service: "growth-marketing", cta_location: "homepage-capabilities" },
    });
  });

  it("contactFormError attaches form_type and error_count", () => {
    events.contactFormError("project", 3, ctx);
    expect(mockDispatchEvent).toHaveBeenCalledWith({
      name: "contact_form_error",
      properties: { ...ctx, form_type: "project", error_count: 3 },
    });
  });

  it("mentoringEnquirySubmit uses the mentoring_enquiry_submit name (the tutoring_enquiry equivalent)", () => {
    events.mentoringEnquirySubmit(ctx);
    expect(mockDispatchEvent).toHaveBeenCalledWith({ name: "mentoring_enquiry_submit", properties: { ...ctx } });
  });

  it("insightsCtaClick uses the insights_cta_click name (the blog_cta_click equivalent)", () => {
    events.insightsCtaClick("homepage-insights-viewall", ctx);
    expect(mockDispatchEvent).toHaveBeenCalledWith({
      name: "insights_cta_click",
      properties: { ...ctx, cta_location: "homepage-insights-viewall" },
    });
  });

  it("externalLinkClick attaches the outbound href", () => {
    events.externalLinkClick("https://github.com/example", ctx);
    expect(mockDispatchEvent).toHaveBeenCalledWith({
      name: "external_link_click",
      properties: { ...ctx, href: "https://github.com/example" },
    });
  });

  it("languageSwitch attaches from_locale and to_locale", () => {
    events.languageSwitch("en", "pl", ctx);
    expect(mockDispatchEvent).toHaveBeenCalledWith({
      name: "language_switch",
      properties: { ...ctx, from_locale: "en", to_locale: "pl" },
    });
  });

  it("experimentView attaches experiment_id and variant", () => {
    events.experimentView("hero-cta-copy", "variant_b", ctx);
    expect(mockDispatchEvent).toHaveBeenCalledWith({
      name: "experiment_view",
      properties: { ...ctx, experiment_id: "hero-cta-copy", variant: "variant_b" },
    });
  });

  it("experimentConversion attaches a conversion:true flag alongside the assignment", () => {
    events.experimentConversion("hero-cta-copy", "variant_b", ctx);
    expect(mockDispatchEvent).toHaveBeenCalledWith({
      name: "experiment_conversion",
      properties: { ...ctx, experiment_id: "hero-cta-copy", variant: "variant_b", conversion: true },
    });
  });

  it("never mutates the caller's context object", () => {
    const original = { ...ctx };
    events.serviceCtaClick("mentoring", "hero", ctx);
    expect(ctx).toEqual(original);
  });
});
