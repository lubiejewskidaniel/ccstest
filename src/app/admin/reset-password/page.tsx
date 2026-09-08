import type { Metadata } from "next";
import { getAdminSession } from "@/lib/supabase/adminAuth";
import { AdminResetPasswordForm } from "@/features/admin/AdminResetPasswordForm";

export const metadata: Metadata = {
	title: "Reset password",
	robots: { index: false, follow: false },
};

/**
 * Reached only after `/admin/auth/confirm` has already exchanged a
 * Supabase recovery code for a real session cookie. `getAdminSession()`
 * doubles as this page's guard: it's already the source of truth for
 * "is there a valid, active admin/editor session" everywhere else in
 * this app (see the dashboard layout), so a missing, expired or invalid
 * recovery session is refused exactly the same way an expired normal
 * session would be - no new check, no new role logic.
 */
export default async function AdminResetPasswordPage() {
	const session = await getAdminSession();

	return (
		<main className="admin-login-page">
			<section className="page-hero admin-login-hero">
				<div className="wrap" style={{ maxWidth: 420, margin: "0 auto" }}>
					<div className="card admin-login-card">
						<div className="admin-login-brand">
							<span className="brand-mark">CC</span>
							<span className="eyebrow">CCS Admin</span>
						</div>
						<div className="admin-login-header">
							<h2>Set a new password</h2>
							<p className="admin-login-lede">Choose a new password for your admin account.</p>
						</div>
						{session ? (
							<AdminResetPasswordForm />
						) : (
							<div className="form-status err" role="alert">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
									<circle cx="12" cy="12" r="9" />
									<path d="M12 8v5M12 16h.01" />
								</svg>
								<span>This link is invalid or has expired. Request a new password reset.</span>
							</div>
						)}
					</div>
				</div>
			</section>
		</main>
	);
}
