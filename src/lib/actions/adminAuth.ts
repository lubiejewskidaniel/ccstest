"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/seo/metadata";

export type AdminAuthState = { status: "idle" | "error"; message?: string };

export async function adminSignIn(
  _prevState: AdminAuthState,
  formData: FormData
): Promise<AdminAuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { status: "error", message: "Enter your email and password." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      status: "error",
      message: "Admin sign-in isn't configured in this environment yet (Supabase env vars are missing).",
    };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { status: "error", message: "Incorrect email or password." };
  }

  redirect("/admin");
}

export async function adminSignOut() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/admin/login");
}

export type AdminRequestPasswordResetState = { status: "idle" | "error" | "success"; message?: string };

/**
 * Sends a Supabase recovery email with an explicit `redirectTo` pointing
 * at `/admin/auth/confirm` (the PKCE code-exchange route - see that
 * route's own comment for why it exists as a separate hop), which then
 * forwards on to `/admin/reset-password`.
 *
 * Always reports success, whether or not the address belongs to a real
 * account - `resetPasswordForEmail`'s own error here would otherwise let
 * an attacker use this form to test which admin emails exist, which is a
 * strictly worse security posture than this app had before this flow
 * existed at all.
 */
export async function adminRequestPasswordReset(
  _prevState: AdminRequestPasswordResetState,
  formData: FormData
): Promise<AdminRequestPasswordResetState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { status: "error", message: "Enter your email address." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      status: "error",
      message: "Password reset isn't configured in this environment yet (Supabase env vars are missing).",
    };
  }

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/admin/auth/confirm`,
  });

  return {
    status: "success",
    message: "If that email is registered, a password reset link has been sent.",
  };
}

export type AdminUpdatePasswordState = { status: "idle" | "error"; message?: string };

/**
 * Completes the recovery flow: `/admin/auth/confirm` has already
 * exchanged the emailed code for a real session, so this just needs the
 * ordinary authenticated-user password update - never
 * `auth.admin.updateUserById`, and never the service-role client, since
 * this route only ever acts on the signed-in user's own session.
 */
export async function adminUpdatePassword(
  _prevState: AdminUpdatePasswordState,
  formData: FormData
): Promise<AdminUpdatePasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!password || !confirmPassword) {
    return { status: "error", message: "Enter and confirm your new password." };
  }

  if (password !== confirmPassword) {
    return { status: "error", message: "Those passwords don't match." };
  }

  if (password.length < 8) {
    return { status: "error", message: "Password must be at least 8 characters." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      status: "error",
      message: "Password reset isn't configured in this environment yet (Supabase env vars are missing).",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { status: "error", message: "Couldn't update your password. Please request a new reset link and try again." };
  }

  // Ends the recovery session deliberately rather than letting it carry
  // the visitor straight into /admin - the requested flow lands back on
  // /admin/login, so this makes that page's session state match what it
  // shows (a signed-out visitor being asked to sign in), not a stale
  // "signed in but on the login screen" mismatch.
  await supabase.auth.signOut();
  redirect("/admin/login?reset=success");
}
