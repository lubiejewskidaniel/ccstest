"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createBriefAction } from "@/lib/actions/contentIntelligence";
import type { BriefResult } from "./service";
import type { Category } from "@/features/insights/types/article";

const idle: BriefResult = { ok: false, kind: "validation", fieldErrors: {} };

export function CreateBriefForm({
	categories,
	defaultTopic,
	defaultOpportunityId,
	defaultLocale,
}: {
	categories: Category[];
	defaultTopic?: string;
	defaultOpportunityId?: string;
	defaultLocale?: "en" | "pl";
}) {
	const [state, formAction, pending] = useActionState(createBriefAction, idle);
	const router = useRouter();

	useEffect(() => {
		if (state.ok) router.push(`/admin/insights/briefs/${state.id}`);
	}, [state, router]);

	const fieldError = (name: string) => (!state.ok && state.kind === "validation" ? state.fieldErrors[name] : undefined);
	const generalError = !state.ok && state.kind !== "validation" ? state.message : undefined;

	return (
		<form action={formAction} className="field-row" style={{ display: "block", maxWidth: 640 }} noValidate>
			{generalError ? (
				<div style={{ marginBottom: 18, fontSize: 13, color: "#ff6b6b" }} role="alert">
					{generalError}
				</div>
			) : null}

			<input type="hidden" name="opportunityId" defaultValue={defaultOpportunityId ?? ""} />

			<div className="field-row">
				<div className="field">
					<label htmlFor="primaryLocale">Primary language</label>
					<select id="primaryLocale" name="primaryLocale" defaultValue={defaultLocale ?? "en"} required>
						<option value="en">English</option>
						<option value="pl">Polish</option>
					</select>
				</div>
				<div className="field">
					<label htmlFor="categoryId">Category</label>
					<select id="categoryId" name="categoryId" required>
						{categories.map((category) => (
							<option key={category.id} value={category.id}>
								{category.name}
							</option>
						))}
					</select>
				</div>
			</div>

			<div className="field">
				<label htmlFor="topic">Topic</label>
				<input id="topic" name="topic" type="text" defaultValue={defaultTopic} required />
				{fieldError("topic") ? <span className="field-error">{fieldError("topic")}</span> : null}
			</div>

			<div className="field">
				<label htmlFor="keyPoints">
					Starting notes <span className="opt">optional</span>
				</label>
				<textarea id="keyPoints" name="keyPoints" rows={4} placeholder="Anything the article should definitely cover, an angle to take, etc." />
			</div>

			<button type="submit" className="btn btn-primary form-submit" disabled={pending}>
				{pending ? "Creating…" : "Create brief"}
			</button>
		</form>
	);
}
