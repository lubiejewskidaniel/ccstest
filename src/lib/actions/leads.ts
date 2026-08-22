"use server";

import { createProjectLead, createMarketingLead, createMentoringLead } from "@/features/leads/service";

/**
 * Server Actions - the form-facing transport for the lead pipeline
 * (doc 08 SEC-003 "public lead submission SHALL pass through a trusted
 * server boundary"). All validation, persistence, notification and CRM
 * sync live in `src/features/leads/service.ts`; this file only adapts
 * `FormData` into the shape that service expects and adapts the result
 * back into the `LeadFormState` `useActionState` needs. The same service
 * functions are also reachable at `POST /api/v1/leads`
 * (`src/app/api/v1/leads/route.ts`) for any future non-form caller.
 */

export type LeadFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

function checkboxOn(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function attributionFromFormData(formData: FormData) {
  const source = formData.get("attr_source");
  const medium = formData.get("attr_medium");
  const campaign = formData.get("attr_campaign");
  const content = formData.get("attr_content");
  const term = formData.get("attr_term");
  const referrer = formData.get("attr_referrer");
  const landingPage = formData.get("attr_landing_page");

  // Hidden fields are only populated once `<AttributionCapture />` has run
  // client-side - if none are present, submit without attribution rather
  // than sending an object of empty strings.
  if (!source && !medium && !campaign && !referrer && !landingPage) return undefined;

  return {
    source: source ? String(source) : null,
    medium: medium ? String(medium) : null,
    campaign: campaign ? String(campaign) : null,
    content: content ? String(content) : null,
    term: term ? String(term) : null,
    referrer: referrer ? String(referrer) : null,
    landingPage: landingPage ? String(landingPage) : null,
  };
}

function toFormState(result: Awaited<ReturnType<typeof createProjectLead>>): LeadFormState {
  if (result.ok) return { status: "success" };
  if (result.kind === "validation") return { status: "error", fieldErrors: result.fieldErrors };
  return { status: "error", message: result.message };
}

/** BUILD - project enquiry. */
export async function submitProjectLead(
  _prevState: LeadFormState,
  formData: FormData
): Promise<LeadFormState> {
  const result = await createProjectLead({
    locale: formData.get("locale"),
    name: formData.get("name"),
    email: formData.get("email"),
    company: formData.get("company") ?? "",
    stage: formData.get("stage"),
    capability: formData.get("capability"),
    budgetRange: formData.get("budgetRange") || undefined,
    message: formData.get("message"),
    consentPrivacy: checkboxOn(formData, "consentPrivacy"),
    attribution: attributionFromFormData(formData),
  });
  return toFormState(result);
}

/** GROW - marketing enquiry. */
export async function submitMarketingLead(
  _prevState: LeadFormState,
  formData: FormData
): Promise<LeadFormState> {
  const result = await createMarketingLead({
    locale: formData.get("locale"),
    name: formData.get("name"),
    email: formData.get("email"),
    company: formData.get("company") ?? "",
    services: formData.getAll("services"),
    engagementType: formData.get("engagementType"),
    currentPresence: formData.get("currentPresence") || undefined,
    message: formData.get("message"),
    consentPrivacy: checkboxOn(formData, "consentPrivacy"),
    attribution: attributionFromFormData(formData),
  });
  return toFormState(result);
}

/** TEACH - mentoring enquiry. */
export async function submitMentoringLead(
  _prevState: LeadFormState,
  formData: FormData
): Promise<LeadFormState> {
  const result = await createMentoringLead({
    locale: formData.get("locale"),
    audience: formData.get("audience"),
    name: formData.get("name"),
    email: formData.get("email"),
    topic: formData.get("topic"),
    currentLevel: formData.get("currentLevel"),
    goal: formData.get("goal"),
    isMinor: checkboxOn(formData, "isMinor"),
    parentGuardianName: formData.get("parentGuardianName") ?? "",
    parentGuardianEmail: formData.get("parentGuardianEmail") ?? "",
    academicIntegrityAck: checkboxOn(formData, "academicIntegrityAck"),
    consentPrivacy: checkboxOn(formData, "consentPrivacy"),
    attribution: attributionFromFormData(formData),
  });
  return toFormState(result);
}
