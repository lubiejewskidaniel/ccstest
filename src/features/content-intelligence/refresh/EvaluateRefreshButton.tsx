"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { evaluateRefreshAction } from "@/lib/actions/refresh";

export function EvaluateRefreshButton({ id }: { id: string }) {
	const [pending, startTransition] = useTransition();
	const [message, setMessage] = useState<string | null>(null);
	const router = useRouter();

	function run() {
		setMessage(null);
		startTransition(async () => {
			const result = await evaluateRefreshAction(id);
			if (!result.ok) {
				setMessage(result.message);
				return;
			}
			router.refresh();
		});
	}

	return (
		<div>
			<button type="button" className="btn btn-ghost" disabled={pending} onClick={run} style={{ fontSize: 12 }}>
				{pending ? "Evaluating…" : "Evaluate"}
			</button>
			{message ? <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 4 }}>{message}</p> : null}
		</div>
	);
}
