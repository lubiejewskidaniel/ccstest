"use client";

import { useActionState } from "react";
import { adminRequestPasswordReset, type AdminRequestPasswordResetState } from "@/lib/actions/adminAuth";

const idle: AdminRequestPasswordResetState = { status: "idle" };

export function AdminForgotPasswordForm() {
	const [state, formAction, pending] = useActionState(adminRequestPasswordReset, idle);

	if (state.status === "success") {
		return (
			<div className="form-status ok" role="status">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
					<circle cx="12" cy="12" r="9" />
					<path d="m8 12 3 3 5-6" />
				</svg>
				<span>{state.message}</span>
			</div>
		);
	}

	return (
		<form action={formAction} noValidate>
			{state.status === "error" && (
				<div className="form-status err" role="alert">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
						<circle cx="12" cy="12" r="9" />
						<path d="M12 8v5M12 16h.01" />
					</svg>
					<span>{state.message}</span>
				</div>
			)}
			<div className="field admin-field">
				<label htmlFor="forgot-password-email">Email</label>
				<div className="admin-field-control">
					<svg
						className="admin-field-icon"
						aria-hidden="true"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.8"
					>
						<rect x="3" y="5" width="18" height="14" rx="3" />
						<path d="m4 7 8 6 8-6" />
					</svg>
					<input id="forgot-password-email" name="email" type="email" required autoComplete="email" />
				</div>
			</div>
			<button type="submit" className="btn btn-primary form-submit" disabled={pending}>
				{pending ? "Sending…" : "Send reset link"}
			</button>
		</form>
	);
}
