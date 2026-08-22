export type LeadResult =
  | { ok: true }
  | { ok: false; kind: "validation"; fieldErrors: Record<string, string> }
  | { ok: false; kind: "persistence"; message: string };
