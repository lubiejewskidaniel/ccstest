import type { CRMProvider, CRMContact, CRMLead } from "./types";

/**
 * Minimal HubSpot adapter using the CRM v3 API directly (no SDK dependency -
 * consistent with how `src/lib/email.ts` calls Resend). Upserts a contact
 * by email, then patches it with a handful of custom properties describing
 * the enquiry. Those custom properties (`ccs_enquiry_type`,
 * `ccs_enquiry_summary`, `ccs_utm_source`, `ccs_utm_medium`,
 * `ccs_utm_campaign`) are NOT standard HubSpot fields - they need to be
 * created once in the target portal (Settings → Properties → Contact
 * properties) before this is wired up for real. Until `CRM_API_KEY` is set,
 * `isConfigured()` returns false and the lead service falls back to the
 * no-op provider automatically.
 */
export function createHubSpotProvider(): CRMProvider {
  const apiKey = process.env.CRM_API_KEY;
  const portalId = process.env.CRM_PORTAL_ID;

  async function request(path: string, init: RequestInit) {
    const res = await fetch(`https://api.hubapi.com${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HubSpot API ${res.status}: ${body.slice(0, 300)}`);
    }
    return res;
  }

  return {
    id: "hubspot",
    isConfigured: () => Boolean(apiKey && portalId),

    async createContact(contact: CRMContact) {
      if (!apiKey) return;
      const [firstname, ...rest] = contact.name.split(" ");
      await request(`/crm/v3/objects/contacts/${encodeURIComponent(contact.email)}?idProperty=email`, {
        method: "PATCH",
        body: JSON.stringify({
          properties: {
            email: contact.email,
            firstname: firstname ?? contact.name,
            lastname: rest.join(" ") || undefined,
            company: contact.company ?? undefined,
            hs_language: contact.locale,
          },
        }),
      }).catch(async (err) => {
        // PATCH 404s if the contact doesn't exist yet - create it instead.
        if (String(err).includes("404")) {
          await request(`/crm/v3/objects/contacts`, {
            method: "POST",
            body: JSON.stringify({
              properties: {
                email: contact.email,
                firstname: firstname ?? contact.name,
                lastname: rest.join(" ") || undefined,
                company: contact.company ?? undefined,
                hs_language: contact.locale,
              },
            }),
          });
        } else {
          throw err;
        }
      });
    },

    async createLead(lead: CRMLead) {
      if (!apiKey) return;
      await request(`/crm/v3/objects/contacts/${encodeURIComponent(lead.contact.email)}?idProperty=email`, {
        method: "PATCH",
        body: JSON.stringify({
          properties: {
            ccs_enquiry_type: lead.type,
            ccs_enquiry_summary: lead.summary.slice(0, 500),
            ccs_utm_source: lead.source ?? undefined,
            ccs_utm_medium: lead.medium ?? undefined,
            ccs_utm_campaign: lead.campaign ?? undefined,
          },
        }),
      });
    },
  };
}
