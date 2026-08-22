/**
 * CRM integration boundary (brief §20). The UI never calls a CRM directly -
 * only `src/features/leads/service.ts` talks to a `CRMProvider`, and only
 * after a lead is already safely persisted. A CRM failure must never fail
 * the lead submission itself.
 */

export type CRMContact = {
  email: string;
  name: string;
  company?: string | null;
  locale: "en" | "pl";
};

export type CRMLead = {
  /** Which CCS mode this enquiry is - matches the lead table it came from. */
  type: "project" | "marketing" | "mentoring";
  contact: CRMContact;
  /** Free-form summary safe to store in the CRM - never raw form internals beyond what the lead itself is. */
  summary: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
};

export interface CRMProvider {
  readonly id: string;
  isConfigured(): boolean;
  createContact(contact: CRMContact): Promise<void>;
  createLead(lead: CRMLead): Promise<void>;
}
