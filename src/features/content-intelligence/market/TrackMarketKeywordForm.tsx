"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fetchMarketKeywordStatsAction } from "@/lib/actions/marketIntelligence";

export function TrackMarketKeywordForm() {
	const [keyword, setKeyword] = useState("");
	const [country, setCountry] = useState("gb");
	const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
	const [pending, startTransition] = useTransition();
	const router = useRouter();

	function run() {
		const trimmed = keyword.trim();
		if (!trimmed) return;

		setMessage(null);
		startTransition(async () => {
			const result = await fetchMarketKeywordStatsAction(trimmed, country);

			if (!result.ok) {
				setMessage({ text: result.message, isError: true });
				return;
			}

			const parts: string[] = [];
			if (result.observedCount > 0) parts.push(`${result.observedCount} observation${result.observedCount === 1 ? "" : "s"} stored.`);
			if (result.noDataCount > 0) parts.push("Bing returned no data for this keyword/market.");
			setMessage({ text: parts.length > 0 ? parts.join(" ") : "No data returned.", isError: false });
			router.refresh();
		});
	}

	return (
		<div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 20, marginBottom: 28 }}>
			<div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginBottom: message ? 12 : 0 }}>
				<div>
					<label htmlFor="market-keyword" style={{ display: "block", fontSize: 12, color: "var(--ink-3)", marginBottom: 4 }}>
						Keyword
					</label>
					<input
						id="market-keyword"
						type="text"
						value={keyword}
						onChange={(event) => setKeyword(event.target.value)}
						placeholder="e.g. edge caching"
						style={{
							padding: "9px 12px",
							borderRadius: 9,
							border: "1px solid var(--line-strong)",
							background: "var(--surface-2)",
							color: "var(--ink-1)",
							font: "inherit",
							fontSize: 13.5,
							minWidth: 240,
						}}
					/>
				</div>
				<div>
					<label htmlFor="market-country" style={{ display: "block", fontSize: 12, color: "var(--ink-3)", marginBottom: 4 }}>
						Market
					</label>
					<select
						id="market-country"
						value={country}
						onChange={(event) => setCountry(event.target.value)}
						style={{ padding: "9px 12px", borderRadius: 9, border: "1px solid var(--line-strong)", background: "var(--surface-2)", color: "var(--ink-1)" }}
					>
						<option value="gb">UK — English</option>
						<option value="pl">Poland — Polish</option>
					</select>
				</div>
				<button type="button" className="btn btn-primary" disabled={pending || !keyword.trim()} onClick={run}>
					{pending ? "Fetching…" : "Track keyword"}
				</button>
			</div>
			{pending ? (
				<p role="status" style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
					Fetching from Bing…
				</p>
			) : message ? (
				<p role={message.isError ? "alert" : "status"} style={{ fontSize: 12.5, color: message.isError ? "#ff6b6b" : "var(--ink-3)" }}>
					{message.text}
				</p>
			) : null}
		</div>
	);
}
