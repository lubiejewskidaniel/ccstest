import type { CRMProvider } from "./types";

/** Default provider when no CRM is configured - every call is a silent no-op. */
export const noopProvider: CRMProvider = {
  id: "noop",
  isConfigured: () => true,
  async createContact() {
    return;
  },
  async createLead() {
    return;
  },
};
