import { createSupabaseServerClient } from "@/lib/supabase/server";

async function countRows(table: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

export default async function AdminOverviewPage() {
  const [projectCount, marketingCount, mentoringCount] = await Promise.all([
    countRows("project_leads"),
    countRows("marketing_enquiries"),
    countRows("mentoring_enquiries"),
  ]);

  const cards = [
    { label: "Project enquiries (BUILD)", count: projectCount },
    { label: "Growth enquiries (GROW)", count: marketingCount },
    { label: "Mentoring enquiries (TEACH)", count: mentoringCount },
  ];

  return (
    <div>
      <h1 style={{ fontSize: "1.6rem", fontWeight: 600, marginBottom: 24 }}>Overview</h1>
      <div className="cap-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        {cards.map((c) => (
          <div className="cap-card card" key={c.label} style={{ minHeight: "auto" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 32, fontWeight: 500, color: "var(--ink-1)" }}>
              {c.count ?? "-"}
            </span>
            <p style={{ marginTop: 4 }}>{c.label}</p>
          </div>
        ))}
      </div>
      {projectCount === null && (
        <p style={{ marginTop: 24, fontSize: 13, color: "var(--ink-3)" }}>
          Supabase isn&apos;t configured in this environment, so counts can&apos;t be loaded. This is expected in
          local/dev without production credentials (doc 11 §3 &quot;safe development fallback&quot;).
        </p>
      )}
    </div>
  );
}
