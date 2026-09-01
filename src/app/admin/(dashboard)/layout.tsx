import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSession } from "@/lib/supabase/adminAuth";
import { adminSignOut } from "@/lib/actions/adminAuth";

export const metadata: Metadata = {
	title: { template: "%s · CCS Admin", default: "Dashboard · CCS Admin" },
	robots: { index: false, follow: false },
};

/**
 * Auth gate for every admin route (doc 08 SEC-005 "admin routes SHALL
 * require authenticated authorised users"; SEC-006 "role checks SHALL
 * include active-account state"). `getAdminSession` returns null both when
 * nobody's signed in AND when Supabase isn't configured - either way we
 * bounce to /admin/login, which explains the difference to the visitor.
 *
 * Nav items are filtered by role: "Leads" spans all three business lines
 * and has nothing to do with content, so it's admin-only; "Insights" is
 * the one area an editor-only account is meant to reach (master
 * instruction Decision 10 — see docs/INSIGHTS_ARCHITECTURE.md §9 for the
 * getAdminSession() change this depends on).
 */
export default async function AdminDashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await getAdminSession();
	if (!session) redirect("/admin/login");

	const nav = [
		{ href: "/admin", label: "Overview", show: session.isAdmin },
		{ href: "/admin/leads", label: "Leads", show: session.isAdmin },
		{ href: "/admin/insights", label: "Insights", show: session.isEditor },
	].filter((item) => item.show);

	return (
		<div className="admin-shell">
			<aside className="admin-nav">
				<div style={{ padding: "10px 12px 20px" }}>
					<span className="brand-mark" style={{ display: "inline-flex" }}>
						CC
					</span>
				</div>
				{nav.map((item) => (
					<Link key={item.href} href={item.href}>
						{item.label}
					</Link>
				))}
				<form
					action={adminSignOut}
					style={{ marginTop: "auto", paddingTop: 20 }}
				>
					<button
						type="submit"
						className="btn btn-ghost"
						style={{ width: "100%" }}
					>
						Sign out
					</button>
				</form>
			</aside>
			<main className="admin-main">{children}</main>
		</div>
	);
}
