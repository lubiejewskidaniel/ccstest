"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runAiVisibilityCheckAction } from "@/lib/actions/optimisation";
import type { Locale } from "@/lib/routes";

export function AiVisibilityCheckForm() {
	const [query, setQuery] = useState("");
	const [locale, setLocale] = useState<Locale | "">("");
	const [message, setMessage] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	const router = useRouter();

	function run() {
		if (!query.trim()) return;
		setMessage(null);
		startTransition(async () => {
			const result = await runAiVisibilityCheckAction(query.trim(), locale || null);
			if (!result.ok) {
				setMessage(result.message);
				return;
			}
			setMessage(result.mentioned ? "Mentioned in the response." : "Not mentioned in the response.");
			router.refresh();
		});
	}

	return (
		<div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 20, marginBottom: 28 }}>
			<div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: message ? 12 : 0 }}>
				<input
					type="text"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="e.g. best software consulting studio for an MVP"
					style={{
						flex: "1 1 320px",
						padding: "9px 12px",
						borderRadius: 9,
						border: "1px solid var(--line-strong)",
						background: "var(--surface-2)",
						color: "var(--ink-1)",
						font: "inherit",
						fontSize: 13.5,
					}}
				/>
				<select
					value={locale}
					onChange={(event) => setLocale(event.target.value as Locale | "")}
					style={{ padding: "9px 12px", borderRadius: 9, border: "1px solid var(--line-strong)", background: "var(--surface-2)", color: "var(--ink-1)" }}
				>
					<option value="">No locale</option>
					<option value="en">EN</option>
					<option value="pl">PL</option>
				</select>
				<button type="button" className="btn btn-primary" disabled={pending || !query.trim()} onClick={run}>
					{pending ? "Checking…" : "Run check"}
				</button>
			</div>
			{message ? <p style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{message}</p> : null}
		</div>
	);
}
