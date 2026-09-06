import type { Metadata } from "next";
import Link from "next/link";
import { AdminLoginForm } from "@/features/admin/AdminLoginForm";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Admin sign-in",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <div className="admin-login">
      <div className="card">
        <div className="admin-login-brand">
          <span className="brand-mark">CC</span>
          <span className="eyebrow">CCS Admin</span>
        </div>
        <div className="admin-login-header">
          <h1>Sign in</h1>
          <p className="admin-login-lede">Manage Insights, leads and publishing.</p>
        </div>
        <AdminLoginForm />
        <Link href={routes.home.en} className="admin-login-back">
          ← Back to codeconsultingstudio.com
        </Link>
      </div>
    </div>
  );
}
