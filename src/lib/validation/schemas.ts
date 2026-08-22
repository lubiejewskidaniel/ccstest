import { z } from "zod";

/**
 * Shared lead-form validation constraints (doc 07 "Data Model, Auth &
 * Security" §4 / doc 08 "Validation constraints"). These run on the server
 * boundary inside the Server Action - client-side validation is a courtesy,
 * not the security boundary.
 */

const localeField = z.enum(["en", "pl"]);

const nameField = z
  .string()
  .trim()
  .min(2, "Please enter your name (at least 2 characters).")
  .max(100, "That name is too long (100 characters max).");

const emailField = z
  .string()
  .trim()
  .max(254, "That email address is too long.")
  .email("Enter a valid email address.")
  .transform((value) => value.toLowerCase());

const companyField = z
  .string()
  .trim()
  .max(160, "Company name is too long (160 characters max).")
  .optional()
  .or(z.literal(""));

const messageField = z
  .string()
  .trim()
  .min(20, "Please give us a little more detail (at least 20 characters).")
  .max(5000, "That's a lot - please keep it under 5000 characters.");

/**
 * First-touch attribution, attached to a lead at submission time (CRO/
 * Martech brief §9). Every field is optional and bounded - this rides
 * along on a form the visitor is already submitting with their contact
 * details, so it's never collected on its own (see docs/ATTRIBUTION.md).
 */
export const attributionSchema = z
  .object({
    source: z.string().trim().max(200).nullable().optional(),
    medium: z.string().trim().max(200).nullable().optional(),
    campaign: z.string().trim().max(200).nullable().optional(),
    content: z.string().trim().max(200).nullable().optional(),
    term: z.string().trim().max(200).nullable().optional(),
    referrer: z.string().trim().max(500).nullable().optional(),
    landingPage: z.string().trim().max(500).nullable().optional(),
  })
  .optional();
export type AttributionInput = z.infer<typeof attributionSchema>;

/** BUILD / project enquiry - persisted to `project_leads`. */
export const projectLeadSchema = z.object({
  locale: localeField,
  name: nameField,
  email: emailField,
  company: companyField,
  stage: z.enum(["idea", "in-progress", "existing-product", "not-sure"]),
  capability: z.enum([
    "software-development",
    "product-development",
    "technology-consulting",
    "web-digital",
    "not-sure",
  ]),
  budgetRange: z.enum(["under-5k", "5k-15k", "15k-50k", "50k-plus", "not-sure"]).optional(),
  message: messageField,
  consentPrivacy: z.literal(true, {
    message: "Please confirm you've read the privacy notice.",
  }),
  attribution: attributionSchema,
});
export type ProjectLeadInput = z.infer<typeof projectLeadSchema>;

/** GROW / marketing enquiry - persisted to `marketing_enquiries`. */
export const marketingLeadSchema = z.object({
  locale: localeField,
  name: nameField,
  email: emailField,
  company: companyField,
  services: z
    .array(
      z.enum([
        "seo-local-seo",
        "social-media-management",
        "content-creation",
        "growth-strategy",
        "analytics-reporting",
        "ads-management",
      ])
    )
    .min(1, "Choose at least one area you'd like help with."),
  engagementType: z.enum(["one-off", "managed-recurring", "not-sure"]),
  currentPresence: z.enum(["none", "some", "established"]).optional(),
  message: messageField,
  consentPrivacy: z.literal(true, {
    message: "Please confirm you've read the privacy notice.",
  }),
  attribution: attributionSchema,
});
export type MarketingLeadInput = z.infer<typeof marketingLeadSchema>;

/** TEACH / mentoring enquiry - persisted to `mentoring_enquiries`. */
export const mentoringLeadSchema = z
  .object({
    locale: localeField,
    audience: z.enum(["starting-out", "university-technical-study", "career-changer", "other"]),
    name: nameField,
    email: emailField,
    topic: z
      .string()
      .trim()
      .min(2, "Tell us what you'd like help with.")
      .max(200, "Keep the topic under 200 characters."),
    currentLevel: z.enum(["complete-beginner", "some-experience", "intermediate", "advanced"]),
    goal: messageField,
    isMinor: z.boolean(),
    parentGuardianName: z.string().trim().max(100).optional().or(z.literal("")),
    parentGuardianEmail: z.string().trim().email().optional().or(z.literal("")),
    academicIntegrityAck: z.literal(true, {
      message: "Please confirm you understand CCS teaches and guides but does not complete assessed work for you.",
    }),
    consentPrivacy: z.literal(true, {
      message: "Please confirm you've read the privacy notice.",
    }),
    attribution: attributionSchema,
  })
  .refine(
    (data) => !data.isMinor || (data.parentGuardianName && data.parentGuardianEmail),
    {
      message: "A parent/guardian name and email are required for learners under 18.",
      path: ["parentGuardianEmail"],
    }
  );
export type MentoringLeadInput = z.infer<typeof mentoringLeadSchema>;
