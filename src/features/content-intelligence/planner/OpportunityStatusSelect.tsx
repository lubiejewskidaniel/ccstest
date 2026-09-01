"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOpportunityStatusAction } from "@/lib/actions/searchIntelligence";
import type { OpportunityStatus } from "@/features/content-intelligence/opportunities/actions";

const OPTIONS: { value: OpportunityStatus; label: string }[] = [
	{ value: "new", label: "New" },
	{ value: "reviewing", label: "Reviewing" },
	{ value: "briefed", label: "Briefed" },
	{ value: "dismissed", label: "Dismissed" },
];

export function OpportunityStatusSelect({ id, status }: { id: string; status: OpportunityStatus }) {
	const [pending, startTransition] = useTransition();
	const router = useRouter();

	return (
		<select
			defaultValue={status}
			disabled={pending}
			onChange={(event) => {
				const next = event.target.value as OpportunityStatus;
				startTransition(async () => {
					await setOpportunityStatusAction(id, next);
					router.refresh();
				});
			}}
			style={{
				fontSize: 12.5,
				padding: "6px 10px",
				borderRadius: 8,
				border: "1px solid var(--line-strong)",
				background: "var(--surface-2)",
				color: "var(--ink-1)",
			}}
		>
			{OPTIONS.map((option) => (
				<option key={option.value} value={option.value}>
					{option.label}
				</option>
			))}
		</select>
	);
}
