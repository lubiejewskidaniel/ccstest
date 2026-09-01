"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
	runResearchAction,
	runGenerationAction,
	runLocalisationAction,
	runQualityCheckAction,
	promoteToArticlesAction,
} from "@/lib/actions/contentIntelligence";
import type { StageResult, BriefStatus } from "../types/contentAi";

const STAGE_ORDER: { key: string; label: string; run: (id: string) => Promise<StageResult> }[] = [
	{ key: "research", label: "Run research", run: runResearchAction },
	{ key: "generation", label: "Run generation", run: runGenerationAction },
	{ key: "localisation", label: "Run localisation", run: runLocalisationAction },
	{ key: "quality", label: "Run quality check", run: runQualityCheckAction },
];

/** Which stage buttons make sense to show for the brief's current
 * status — not a hard lock (an editor can re-run an earlier stage after
 * a failure), just a sensible default ordering so the UI doesn't show
 * six buttons at once for a freshly created brief. */
function relevantStageKeys(status: BriefStatus): string[] {
	if (status === "draft" || status === "failed") return ["research", "generation"];
	if (status === "researching" || status === "researched") return ["research", "generation"];
	if (status === "generating" || status === "generated") return ["generation", "localisation", "quality"];
	if (status === "localising" || status === "localised") return ["localisation", "quality"];
	if (status === "quality_check" || status === "quality_failed") return ["generation", "localisation", "quality"];
	return ["research", "generation", "localisation", "quality"];
}

export function PipelineControls({ briefId, status }: { briefId: string; status: BriefStatus }) {
	const [message, setMessage] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	const router = useRouter();

	const visibleStages = STAGE_ORDER.filter((stage) => relevantStageKeys(status).includes(stage.key));
	const canPromote = status === "quality_passed";

	function run(stage: { label: string; run: (id: string) => Promise<StageResult> }) {
		setMessage(null);
		startTransition(async () => {
			const result = await stage.run(briefId);
			if (!result.ok) {
				setMessage(`${stage.label} failed: ${result.message}`);
				return;
			}
			setMessage(`${stage.label} succeeded.`);
			router.refresh();
		});
	}

	function runPromote() {
		setMessage(null);
		startTransition(async () => {
			const result = await promoteToArticlesAction(briefId);
			if (!result.ok) {
				setMessage(`Promotion failed: ${result.message}`);
				return;
			}
			setMessage("Promoted — draft article(s) created, awaiting human review in /admin/insights.");
			router.refresh();
		});
	}

	return (
		<div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 20, marginBottom: 28 }}>
			<div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: message ? 14 : 0 }}>
				{visibleStages.map((stage) => (
					<button key={stage.key} type="button" className="btn btn-ghost" disabled={pending} onClick={() => run(stage)}>
						{pending ? "Working…" : stage.label}
					</button>
				))}
				<button type="button" className="btn btn-primary" disabled={pending || !canPromote} onClick={runPromote}>
					{pending ? "Working…" : "Promote to draft article(s)"}
				</button>
			</div>
			{message ? <p style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{message}</p> : null}
			{!canPromote ? (
				<p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 10 }}>
					Promotion is only available once the brief has passed the quality check.
				</p>
			) : null}
		</div>
	);
}
