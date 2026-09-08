import type { Metadata } from "next";
import { AdminForgotPasswordForm } from "@/features/admin/AdminForgotPasswordForm";

export const metadata: Metadata = {
	title: "Forgot password",
	robots: { index: false, follow: false },
};

/**
 * The password-recovery request entry point linked from
 * `/admin/login` (`AdminLoginForm`'s "Forgot password?" link). Kept
 * deliberately smaller than the login page itself - one card, no hero
 * copy or benefit rows - since this is a single-purpose support page,
 * not a second front door into the admin area.
 */
export default function AdminForgotPasswordPage() {
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
							<h2>Reset your password</h2>
							<p className="admin-login-lede">Enter your admin email and we&apos;ll send you a password reset link.</p>
						</div>
						<AdminForgotPasswordForm />
					</div>
				</div>
			</section>
		</main>
	);
}
