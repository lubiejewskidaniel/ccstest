"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ingestSearchPerformanceAction, recomputeOpportunitiesAction } from "@/lib/actions/searchIntelligence";
import { recomputeCalibrationAction } from "@/lib/actions/optimisation";

export function OpportunitiesToolbar() {
	const [message, setMessage] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	const router = useRouter();

	function runIngest() {
		setMessage(null);
		startTransition(async () => {
			const result = await ingestSearchPerformanceAction();
			if (!result.ok) {
				setMessage(result.message);
				return;
			}
			setMessage(
				result.rowsIngested === 0
					? "No new rows returned by the configured provider(s)."
					: `Ingested ${result.rowsIngested} rows from ${result.providersUsed.join(", ")}.`,
			);
			router.refresh();
		});
	}

	function runRecompute() {
		setMessage(null);
		startTransition(async () => {
			const result = await recomputeOpportunitiesAction();
			if (!result.ok) {
				setMessage(result.message);
				return;
			}
			setMessage(`Recomputed scores for ${result.opportunitiesUpdated} queries.`);
			router.refresh();
		});
	}

	function runCalibration() {
		setMessage(null);
		startTransition(async () => {
			const result = await recomputeCalibrationAction();
			if (!result.ok) {
				setMessage(result.message);
				return;
			}
			setMessage(
				result.sampleSize === 0
					? "No resolved opportunities yet (need a promoted, published article at least 14 days old) — calibration unchanged."
					: `Calibration updated: ×${result.multiplier.toFixed(2)} from ${result.sampleSize} resolved opportunit${result.sampleSize === 1 ? "y" : "ies"}. Run "Recompute scores" to apply it.`,
			);
		});
	}

	return (
		<div style={{ marginBottom: 24 }}>
			<div style={{ display: "flex", gap: 10, marginBottom: message ? 12 : 0 }}>
				<button type="button" className="btn btn-ghost" disabled={pending} onClick={runIngest}>
					{pending ? "Working…" : "Refresh from Google/Bing"}
				</button>
				<button type="button" className="btn btn-ghost" disabled={pending} onClick={runRecompute}>
					{pending ? "Working…" : "Recompute scores"}
				</button>
				<button type="button" className="btn btn-ghost" disabled={pending} onClick={runCalibration}>
					{pending ? "Working…" : "Recalculate adaptive scoring"}
				</button>
			</div>
			{message ? <p style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{message}</p> : null}
		</div>
	);
}
