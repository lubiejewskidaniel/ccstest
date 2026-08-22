"use client";

import { useActionState } from "react";
import { adminSignIn, type AdminAuthState } from "@/lib/actions/adminAuth";

const idle: AdminAuthState = { status: "idle" };

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(adminSignIn, idle);

  return (
    <form action={formAction} noValidate>
      {state.status === "error" && (
        <div className="form-status err" role="alert" style={{ marginBottom: 18 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
          <span>{state.message}</span>
        </div>
      )}
      <div className="field">
        <label htmlFor="admin-email">Email</label>
        <input id="admin-email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="field">
        <label htmlFor="admin-password">Password</label>
        <input id="admin-password" name="password" type="password" required autoComplete="current-password" />
      </div>
      <button type="submit" className="btn btn-primary form-submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
