"use client";

import { useActionState } from "react";
import { adminSignIn, type AdminAuthState } from "@/lib/actions/adminAuth";

const idle: AdminAuthState = { status: "idle" };

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(adminSignIn, idle);

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
        <label htmlFor="admin-email">Email</label>
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
          <input id="admin-email" name="email" type="email" required autoComplete="email" />
        </div>
      </div>
      <div className="field admin-field">
        <label htmlFor="admin-password">Password</label>
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
            id="admin-password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
      </div>
      <button type="submit" className="btn btn-primary form-submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
