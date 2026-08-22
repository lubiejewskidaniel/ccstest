"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
