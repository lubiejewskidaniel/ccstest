"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBriefAction } from "@/lib/actions/contentIntelligence";
import type { BriefResult } from "./service";
import type { Category } from "@/features/insights/types/article";

const idle: BriefResult = { ok: false, kind: "validation", fieldErrors: {} };

/** Mirrors createBriefSchema's own keyPoints.max(4000, ...) limit -- kept
 * as a plain number here rather than imported, since the schema lives in
 * a server-only module tree and this is a client component; the message
 * text is duplicated deliberately so a client-side over-limit and the
 * server's own fieldErrors.keyPoints message read identically to the
 * user (see keyPointsError below, which shows at most one of them). */
const KEY_POINTS_LIMIT = 4000;
const KEY_POINTS_OVER_LIMIT_MESSAGE = "Starting notes must be 4000 characters or fewer.";

export function CreateBriefForm({
	categories,
	defaultTopic,
	defaultOpportunityId,
	defaultLocale,
	defaultKeyPoints,
}: {
	categories: Category[];
	defaultTopic?: string;
	defaultOpportunityId?: string;
	defaultLocale?: "en" | "pl";
	/** Phase 3C.3: an optional prefill for the "Starting notes" textarea
	 * below, e.g. from a Market Opportunity recommendation handoff — the
	 * human can still edit or clear it before submitting; nothing here
	 * submits the form automatically. */
	defaultKeyPoints?: string;
}) {
	const [state, formAction, pending] = useActionState(createBriefAction, idle);
	const router = useRouter();
	const [keyPoints, setKeyPoints] = useState(defaultKeyPoints ?? "");

	useEffect(() => {
		if (state.ok) router.push(`/admin/insights/briefs/${state.id}`);
	}, [state, router]);

	const fieldError = (name: string) => (!state.ok && state.kind === "validation" ? state.fieldErrors[name] : undefined);
	const generalError = !state.ok && state.kind !== "validation" ? state.message : undefined;

	// A prefilled defaultKeyPoints (e.g. a Market Opportunity handoff query
	// param) can already exceed the limit before the user types anything --
	// maxLength on the textarea only stops further typing, it can't clamp
	// an initial value, so the over-limit state has to be tracked here too.
	const keyPointsOverLimit = keyPoints.length > KEY_POINTS_LIMIT;
	// At most one of these is ever shown -- an over-limit textarea can't
	// also have been submitted to the server, and once fieldErrors.keyPoints
	// exists the value is back under the client's own maxLength.
	const keyPointsError = keyPointsOverLimit ? KEY_POINTS_OVER_LIMIT_MESSAGE : fieldError("keyPoints");

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
				<textarea
					id="keyPoints"
					name="keyPoints"
					rows={4}
					value={keyPoints}
					onChange={(e) => setKeyPoints(e.target.value)}
					maxLength={KEY_POINTS_LIMIT}
					placeholder="Anything the article should definitely cover, an angle to take, etc."
					aria-invalid={keyPointsError ? true : undefined}
					aria-describedby={keyPointsError ? "keyPoints-count keyPoints-error" : "keyPoints-count"}
				/>
				<span id="keyPoints-count" className={`char-count ${keyPointsOverLimit ? "char-count-over" : ""}`}>
					{keyPoints.length} / {KEY_POINTS_LIMIT}
				</span>
				{keyPointsError ? (
					<span id="keyPoints-error" className="field-error">
						{keyPointsError}
					</span>
				) : null}
			</div>

			<button type="submit" className="btn btn-primary form-submit" disabled={pending || keyPointsOverLimit}>
				{pending ? "Creating…" : "Create brief"}
			</button>
		</form>
	);
}
