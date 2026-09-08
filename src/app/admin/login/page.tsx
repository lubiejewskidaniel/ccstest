import type { Metadata } from "next";
import { AdminLoginForm } from "@/features/admin/AdminLoginForm";

export const metadata: Metadata = {
  title: "Admin sign-in",
  robots: { index: false, follow: false },
};

/**
 * Public, unauthenticated entry point into the admin area — rendered
 * inside the normal CCS site chrome (Header/Footer, see SiteChrome.tsx),
 * not the header-less dashboard shell those routes get once signed in.
 *
 * Layout reuses the same "wrap form-shell" hero pattern already shipped
 * on ContactPage/MentoringEnquiryPage (copy column + form column) instead
 * of inventing a parallel layout system, extended to three top-level
 * grid items -- hero copy ("intro"), the sign-in card ("card"), and the
 * three benefit rows ("facts") -- so admin.css can place all three
 * independently per breakpoint via `grid-template-areas` rather than
 * duplicating markup for mobile vs. desktop.
 *
 * DOM order is intro / card / facts. Desktop (>=901px) uses
 * `"intro card" / "facts card"`, keeping the original two-column look
 * (card spans both rows, vertically centered against the stacked intro
 * + facts on the left). At <=900px it becomes `"intro" / "card" /
 * "facts"` -- hero context, then the form, then the benefit rows -- so
 * DOM order and visual order are identical on mobile. The benefit rows
 * have no focusable elements, so this ordering has no effect on
 * keyboard tab order at any width; it only changes screen-reader
 * reading order on desktop (context, then form, then supporting detail
 * instead of context, then supporting detail, then form), which reads
 * naturally for a sign-in page. See .form-shell.admin-login-shell in
 * admin.css for the area definitions.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; error?: string }>;
}) {
  const { reset, error } = await searchParams;
  const resetSuccess = reset === "success";
  const resetError = error === "reset_link_invalid";

  return (
    <main className="admin-login-page">
      <section className="page-hero admin-login-hero">
        <div className="wrap form-shell admin-login-shell">
          <div className="form-side admin-login-copy">
            <span className="eyebrow">Secure access</span>
            <h1>
              Built with purpose.
              <br />
              Managed with precision.
            </h1>
            <p>
              One place to manage the content, insights and growth behind Code Consulting
              Studio.
            </p>
            <span className="admin-login-rule" aria-hidden="true" />
          </div>
          <div className="admin-login-card-wrap">
            <div className="card admin-login-card">
              <div className="admin-login-brand">
                <span className="brand-mark">CC</span>
                <span className="eyebrow">CCS Admin</span>
              </div>
              <div className="admin-login-header">
                <h2>Admin sign in</h2>
                <p className="admin-login-lede">Sign in to manage Insights, leads and publishing.</p>
              </div>
              <AdminLoginForm resetSuccess={resetSuccess} resetError={resetError} />
            </div>
          </div>
          <div className="form-facts">
            <div className="form-fact">
              <span className="form-fact-ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3l7 4v5c0 4.5-3 8.5-7 9-4-.5-7-4.5-7-9V7l7-4Z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </span>
              <div>
                <b>Protected by design</b>
                <span>Every session is verified through Supabase auth before anything loads.</span>
              </div>
            </div>
            <div className="form-fact">
              <span className="form-fact-ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
                </svg>
              </span>
              <div>
                <b>Built for productivity</b>
                <span>Publish articles, manage leads and review Insights from one place.</span>
              </div>
            </div>
            <div className="form-fact">
              <span className="form-fact-ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m3 17 6-6 4 4 8-8" />
                  <path d="M15 7h6v6" />
                </svg>
              </span>
              <div>
                <b>Power the next chapter</b>
                <span>Updates you make here reach the live site in real time.</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
