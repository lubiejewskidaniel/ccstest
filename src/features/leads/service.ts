import { z } from "zod";
import {
  projectLeadSchema,
  marketingLeadSchema,
  mentoringLeadSchema,
  type AttributionInput,
} from "@/lib/validation/schemas";
import { createSupabasePrivilegedClient } from "@/lib/supabase/privileged";
import { notifyNewLead } from "@/lib/email";
import { syncLeadToCRM } from "@/lib/crm";
import type { LeadResult } from "./types";

/**
 * Business logic + data access for the lead pipeline, deliberately
 * separated from both transport layers that call it (brief §2 "separation
 * of UI, business logic and data access"):
 *
 *   src/lib/actions/leads.ts   - Server Actions, FormData → this module
 *   src/app/api/v1/leads/route.ts - versioned public API, JSON → this module
 *
 * Neither caller duplicates validation, persistence or the
 * notification/CRM side-effects - they only adapt their own input shape
 * (FormData vs. JSON body) into the plain objects these functions expect,
 * and adapt the `LeadResult` back into their own response shape (a
 * `LeadFormState` for `useActionState`, an HTTP response for the API
 * route).
 *
 * This file is server-only (imports the service-role Supabase client) but
 * does NOT itself carry "use server" - it's not a directly-invokable
 * Server Action, just a plain module only ever imported from other
 * server-only code.
 */

function zodToFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export async function createProjectLead(raw: unknown): Promise<LeadResult> {
  const parsed = projectLeadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, kind: "validation", fieldErrors: zodToFieldErrors(parsed.error) };
  }
  const d = parsed.data;

  const supabase = createSupabasePrivilegedClient();
  if (!supabase) {
    console.warn("[leads] Supabase not configured - project lead validated but NOT persisted.");
    return { ok: true };
  }

  const { error } = await supabase.from("project_leads").insert({
    locale: d.locale,
    name: d.name,
    email: d.email,
    company: d.company || null,
    stage: d.stage,
    capability: d.capability,
    budget_range: d.budgetRange ?? null,
    message: d.message,
    ...attributionColumns(d.attribution),
  });

  if (error) {
    console.error("[leads] project_leads insert failed:", error.message);
    return { ok: false, kind: "persistence", message: "We couldn't save your enquiry. Please try again in a moment." };
  }

  await notifyNewLead(`New project enquiry - ${d.name}`, [
    `Name: ${d.name}`,
    `Email: ${d.email}`,
    `Company: ${d.company || "-"}`,
    `Stage: ${d.stage}`,
    `Capability: ${d.capability}`,
    `Budget: ${d.budgetRange ?? "-"}`,
    `Source: ${d.attribution?.source ?? "-"} / ${d.attribution?.medium ?? "-"} / ${d.attribution?.campaign ?? "-"}`,
    "",
    d.message,
  ]);

  await syncLeadToCRM({
    type: "project",
    contact: { email: d.email, name: d.name, company: d.company || null, locale: d.locale },
    summary: `${d.capability} · ${d.stage} · ${d.message.slice(0, 200)}`,
    source: d.attribution?.source ?? null,
    medium: d.attribution?.medium ?? null,
    campaign: d.attribution?.campaign ?? null,
  });

  return { ok: true };
}

export async function createMarketingLead(raw: unknown): Promise<LeadResult> {
  const parsed = marketingLeadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, kind: "validation", fieldErrors: zodToFieldErrors(parsed.error) };
  }
  const d = parsed.data;

  const supabase = createSupabasePrivilegedClient();
  if (!supabase) {
    console.warn("[leads] Supabase not configured - marketing lead validated but NOT persisted.");
    return { ok: true };
  }

  const { error } = await supabase.from("marketing_enquiries").insert({
    locale: d.locale,
    name: d.name,
    email: d.email,
    company: d.company || null,
    services: d.services,
    engagement_type: d.engagementType,
    current_presence: d.currentPresence ?? null,
    message: d.message,
    ...attributionColumns(d.attribution),
  });

  if (error) {
    console.error("[leads] marketing_enquiries insert failed:", error.message);
    return { ok: false, kind: "persistence", message: "We couldn't save your enquiry. Please try again in a moment." };
  }

  await notifyNewLead(`New growth enquiry - ${d.name}`, [
    `Name: ${d.name}`,
    `Email: ${d.email}`,
    `Company: ${d.company || "-"}`,
    `Services: ${d.services.join(", ")}`,
    `Engagement: ${d.engagementType}`,
    `Source: ${d.attribution?.source ?? "-"} / ${d.attribution?.medium ?? "-"} / ${d.attribution?.campaign ?? "-"}`,
    "",
    d.message,
  ]);

  await syncLeadToCRM({
    type: "marketing",
    contact: { email: d.email, name: d.name, company: d.company || null, locale: d.locale },
    summary: `${d.services.join(", ")} · ${d.engagementType} · ${d.message.slice(0, 200)}`,
    source: d.attribution?.source ?? null,
    medium: d.attribution?.medium ?? null,
    campaign: d.attribution?.campaign ?? null,
  });

  return { ok: true };
}

export async function createMentoringLead(raw: unknown): Promise<LeadResult> {
  const parsed = mentoringLeadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, kind: "validation", fieldErrors: zodToFieldErrors(parsed.error) };
  }
  const d = parsed.data;

  const supabase = createSupabasePrivilegedClient();
  if (!supabase) {
    console.warn("[leads] Supabase not configured - mentoring lead validated but NOT persisted.");
    return { ok: true };
  }

  const { error } = await supabase.from("mentoring_enquiries").insert({
    locale: d.locale,
    audience: d.audience,
    name: d.name,
    email: d.email,
    topic: d.topic,
    current_level: d.currentLevel,
    goal: d.goal,
    is_minor: d.isMinor,
    parent_guardian_name: d.parentGuardianName || null,
    parent_guardian_email: d.parentGuardianEmail || null,
    ...attributionColumns(d.attribution),
  });

  if (error) {
    console.error("[leads] mentoring_enquiries insert failed:", error.message);
    return { ok: false, kind: "persistence", message: "We couldn't save your enquiry. Please try again in a moment." };
  }

  await notifyNewLead(`New mentoring enquiry - ${d.name}`, [
    `Name: ${d.name}`,
    `Email: ${d.email}`,
    `Audience: ${d.audience}`,
    `Topic: ${d.topic}`,
    `Level: ${d.currentLevel}`,
    `Minor: ${d.isMinor ? "yes" : "no"}`,
    `Source: ${d.attribution?.source ?? "-"} / ${d.attribution?.medium ?? "-"} / ${d.attribution?.campaign ?? "-"}`,
    "",
    d.goal,
  ]);

  await syncLeadToCRM({
    type: "mentoring",
    contact: { email: d.email, name: d.name, company: null, locale: d.locale },
    summary: `${d.audience} · ${d.currentLevel} · ${d.topic}`,
    source: d.attribution?.source ?? null,
    medium: d.attribution?.medium ?? null,
    campaign: d.attribution?.campaign ?? null,
  });

  return { ok: true };
}

function attributionColumns(attribution: AttributionInput) {
  return {
    utm_source: attribution?.source ?? null,
    utm_medium: attribution?.medium ?? null,
    utm_campaign: attribution?.campaign ?? null,
    utm_content: attribution?.content ?? null,
    utm_term: attribution?.term ?? null,
    referrer: attribution?.referrer ?? null,
    landing_page: attribution?.landingPage ?? null,
  };
}
