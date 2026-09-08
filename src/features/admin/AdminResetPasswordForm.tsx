"use client";

import { useActionState } from "react";
import { adminUpdatePassword, type AdminUpdatePasswordState } from "@/lib/actions/adminAuth";

const idle: AdminUpdatePasswordState = { status: "idle" };

export function AdminResetPasswordForm() {
	const [state, formAction, pending] = useActionState(adminUpdatePassword, idle);

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
				<label htmlFor="reset-password">New password</label>
				<div className="admin-field-control">
					<svg
						className="admin-field-icon"
						aria-hidden="true"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.8"
					>
						<rect x="5" y="10" width="14" height="10" rx="2.5" />
						<path d="M8 10V7a4 4 0 0 1 8 0v3" />
					</svg>
					<input
						id="reset-password"
						name="password"
						type="password"
						required
						minLength={8}
						autoComplete="new-password"
					/>
				</div>
			</div>
			<div className="field admin-field">
				<label htmlFor="reset-password-confirm">Confirm new password</label>
				<div className="admin-field-control">
					<svg
						className="admin-field-icon"
						aria-hidden="true"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.8"
					>
						<rect x="5" y="10" width="14" height="10" rx="2.5" />
						<path d="M8 10V7a4 4 0 0 1 8 0v3" />
					</svg>
					<input
						id="reset-password-confirm"
						name="confirmPassword"
						type="password"
						required
						minLength={8}
						autoComplete="new-password"
					/>
				</div>
			</div>
			<button type="submit" className="btn btn-primary form-submit" disabled={pending}>
				{pending ? "Updating…" : "Update password"}
			</button>
		</form>
	);
}
