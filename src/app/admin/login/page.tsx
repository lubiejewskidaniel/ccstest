import type { Metadata } from "next";
import { AdminLoginForm } from "@/features/admin/AdminLoginForm";

export const metadata: Metadata = {
  title: "Admin sign-in",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <div className="admin-login">
      <div className="card">
        <div style={{ marginBottom: 24 }}>
          <span className="eyebrow">CCS Admin</span>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginTop: 10 }}>Sign in</h1>
        </div>
        <AdminLoginForm />
      </div>
    </div>
  );
}
