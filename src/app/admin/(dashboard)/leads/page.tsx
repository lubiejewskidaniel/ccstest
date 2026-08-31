import { createSupabaseServerClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;

async function fetchRecent(table: string, limit = 15): Promise<Row[]> {
	const supabase = await createSupabaseServerClient();
	if (!supabase) return [];
	const { data } = await supabase
		.from(table)
		.select("*")
		.order("created_at", { ascending: false })
		.limit(limit);
	return data ?? [];
}

function fmt(v: unknown) {
	if (v === null || v === undefined) return "-";
	if (Array.isArray(v)) return v.join(", ");
	return String(v);
}

export default async function AdminLeadsPage() {
	const [projectLeads, marketingLeads, mentoringLeads] = await Promise.all([
		fetchRecent("project_leads"),
		fetchRecent("marketing_enquiries"),
		fetchRecent("mentoring_enquiries"),
	]);

	return (
		<div>
			<h1 style={{ fontSize: "1.6rem", fontWeight: 600, marginBottom: 8 }}>
				Leads
			</h1>
			<p style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 28 }}>
				Most recent 15 per table. Full filtering, status and assignment are
				Phase 2 (doc 15 §2).
			</p>

			<Section
				title="Project enquiries (BUILD)"
				rows={projectLeads}
				cols={["name", "email", "stage", "capability", "created_at"]}
			/>
			<Section
				title="Growth enquiries (GROW)"
				rows={marketingLeads}
				cols={["name", "email", "services", "engagement_type", "created_at"]}
			/>
			<Section
				title="Mentoring enquiries (TEACH)"
				rows={mentoringLeads}
				cols={[
					"name",
					"email",
					"audience",
					"current_level",
					"is_minor",
					"created_at",
				]}
			/>
		</div>
	);
}

function Section({
	title,
	rows,
	cols,
}: {
	title: string;
	rows: Row[];
	cols: string[];
}) {
	return (
		<div style={{ marginBottom: 40 }}>
			<b style={{ display: "block", fontSize: 13.5, marginBottom: 12 }}>
				{title}
			</b>
			{rows.length === 0 ? (
				<div className="admin-empty">No entries yet.</div>
			) : (
				<div style={{ overflowX: "auto" }}>
					<table className="admin-table">
						<thead>
							<tr>
								{cols.map((c) => (
									<th key={c}>{c.replace(/_/g, " ")}</th>
								))}
							</tr>
						</thead>
						<tbody>
							{rows.map((row, i) => (
								<tr key={i}>
									{cols.map((c) => (
										<td key={c}>{fmt(row[c])}</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
