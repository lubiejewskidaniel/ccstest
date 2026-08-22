import { noopProvider } from "./NoopProvider";
import { createHubSpotProvider } from "./HubSpotProvider";
import type { CRMLead } from "./types";

export type { CRMProvider, CRMContact, CRMLead } from "./types";

function resolveProvider() {
  const hubspot = createHubSpotProvider();
  return hubspot.isConfigured() ? hubspot : noopProvider;
}

/**
 * Fire-and-forget CRM sync, called from `src/features/leads/service.ts`
 * after a lead is already safely persisted in Supabase. Mirrors the
 * resilience contract of `notifyNewLead` in `src/lib/email.ts` - a CRM
 * outage or misconfiguration must never surface as a failed form
 * submission to the visitor.
 */
export async function syncLeadToCRM(lead: CRMLead) {
  const provider = resolveProvider();
  try {
    await provider.createContact(lead.contact);
    await provider.createLead(lead);
  } catch (err) {
    console.error(`[crm] provider "${provider.id}" sync failed:`, err);
  }
}
