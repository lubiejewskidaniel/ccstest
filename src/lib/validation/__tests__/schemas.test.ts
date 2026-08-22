import { describe, it, expect } from "vitest";
import { projectLeadSchema, marketingLeadSchema, mentoringLeadSchema, attributionSchema } from "../schemas";

const LONG_MESSAGE = "This is a sufficiently detailed message for validation purposes, well past twenty characters.";

describe("projectLeadSchema", () => {
  const valid = {
    locale: "en" as const,
    name: "Jane Doe",
    email: "Jane@Example.com",
    company: "",
    stage: "idea" as const,
    capability: "software-development" as const,
    budgetRange: "5k-15k" as const,
    message: LONG_MESSAGE,
    consentPrivacy: true as const,
  };

  it("accepts a fully valid submission and lowercases the email", () => {
    const result = projectLeadSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("jane@example.com");
  });

  it("rejects a message under 20 characters", () => {
    const result = projectLeadSchema.safeParse({ ...valid, message: "too short" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email address", () => {
    const result = projectLeadSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("requires consentPrivacy to be exactly true (not just truthy)", () => {
    const result = projectLeadSchema.safeParse({ ...valid, consentPrivacy: false });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown capability value", () => {
    // `safeParse` accepts `unknown`, so this isn't a type error - it's
    // exactly the case being tested: untyped external input with a bogus
    // enum value must be rejected at the validation boundary, not the
    // type system.
    const result = projectLeadSchema.safeParse({ ...valid, capability: "not-a-real-capability" });
    expect(result.success).toBe(false);
  });

  it("accepts an omitted attribution object (it's optional)", () => {
    const result = projectLeadSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});

describe("marketingLeadSchema", () => {
  const valid = {
    locale: "pl" as const,
    name: "Jan Kowalski",
    email: "jan@example.com",
    services: ["seo-local-seo", "content-creation"] as const,
    engagementType: "one-off" as const,
    currentPresence: "some" as const,
    message: LONG_MESSAGE,
    consentPrivacy: true as const,
  };

  it("accepts a valid submission with at least one service", () => {
    expect(marketingLeadSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an empty services array", () => {
    const result = marketingLeadSchema.safeParse({ ...valid, services: [] });
    expect(result.success).toBe(false);
  });
});

describe("mentoringLeadSchema", () => {
  const base = {
    locale: "en" as const,
    audience: "starting-out" as const,
    name: "Alex Learner",
    email: "alex@example.com",
    topic: "React hooks",
    currentLevel: "some-experience" as const,
    goal: LONG_MESSAGE,
    academicIntegrityAck: true as const,
    consentPrivacy: true as const,
  };

  it("accepts a non-minor without parent/guardian details", () => {
    const result = mentoringLeadSchema.safeParse({ ...base, isMinor: false });
    expect(result.success).toBe(true);
  });

  it("rejects a minor without parent/guardian name and email", () => {
    const result = mentoringLeadSchema.safeParse({ ...base, isMinor: true });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("parentGuardianEmail");
    }
  });

  it("accepts a minor when parent/guardian name and email are both present", () => {
    const result = mentoringLeadSchema.safeParse({
      ...base,
      isMinor: true,
      parentGuardianName: "Pat Guardian",
      parentGuardianEmail: "pat@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("requires the academic integrity acknowledgement to be true", () => {
    const result = mentoringLeadSchema.safeParse({ ...base, isMinor: false, academicIntegrityAck: false });
    expect(result.success).toBe(false);
  });
});

describe("attributionSchema", () => {
  it("accepts a fully populated attribution object", () => {
    const result = attributionSchema.safeParse({
      source: "google",
      medium: "cpc",
      campaign: "spring-launch",
      content: null,
      term: null,
      referrer: "https://google.com/",
      landingPage: "/services",
    });
    expect(result.success).toBe(true);
  });

  it("accepts undefined (the whole object is optional)", () => {
    expect(attributionSchema.safeParse(undefined).success).toBe(true);
  });

  it("rejects an over-length campaign value", () => {
    const result = attributionSchema.safeParse({ campaign: "x".repeat(201) });
    expect(result.success).toBe(false);
  });
});
