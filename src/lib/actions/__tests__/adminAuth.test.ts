import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Password-recovery flow for the existing admin auth system. Same
 * mocking shape as the rest of this repository's Server Action tests:
 * `@/lib/supabase/server` mocked with a hand-built fake client, plus
 * `next/navigation`'s `redirect` mocked to throw a recognisable error
 * (matching real Next.js behaviour closely enough to assert against,
 * without needing a real request/response cycle) since this is the
 * first Server Action test in this repo that exercises a redirecting
 * action.
 *
 * The UI pieces (`AdminResetPasswordForm`, `AdminForgotPasswordForm`,
 * the two new pages, the confirm route) are covered the same way
 * Phase 3C.4B.4B's review UI was: structural source-text assertions
 * against the real, unmodified files, since this repository's Vitest
 * setup has no React rendering plugin/Testing Library and its
 * `include` glob doesn't pick up `.tsx` specs at all.
 */

const mockCreateSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: () => mockCreateSupabaseServerClient(),
}));

const mockRedirect = vi.fn((url: string) => {
	throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
	redirect: (url: string) => mockRedirect(url),
}));

const { adminRequestPasswordReset, adminUpdatePassword } = await import("../adminAuth");

type FakeSupabaseOptions = {
	resetPasswordError?: { message: string } | null;
	updateUserError?: { message: string } | null;
};

function fakeSupabase(opts: FakeSupabaseOptions = {}) {
	const { resetPasswordError = null, updateUserError = null } = opts;

	const resetPasswordForEmail = vi.fn(async (_email: string, _options: Record<string, unknown>) => ({
		data: {},
		error: resetPasswordError,
	}));
	const updateUser = vi.fn(async (_attrs: { password: string }) => ({
		data: { user: null },
		error: updateUserError,
	}));
	const signOut = vi.fn(async () => ({ error: null }));

	return {
		auth: { resetPasswordForEmail, updateUser, signOut },
	};
}

beforeEach(() => {
	mockCreateSupabaseServerClient.mockReset();
	mockRedirect.mockClear();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("adminRequestPasswordReset", () => {
	it("rejects a blank email without calling Supabase", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await adminRequestPasswordReset({ status: "idle" }, new FormData());

		expect(result).toEqual({ status: "error", message: "Enter your email address." });
		expect(supabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
	});

	it("reports not-configured when Supabase env vars are missing", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(null);
		const formData = new FormData();
		formData.set("email", "editor@example.com");

		const result = await adminRequestPasswordReset({ status: "idle" }, formData);

		expect(result.status).toBe("error");
	});

	it("sends the recovery email with redirectTo pointing at /admin/auth/confirm", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);
		const formData = new FormData();
		formData.set("email", "editor@example.com");

		await adminRequestPasswordReset({ status: "idle" }, formData);

		expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
			"editor@example.com",
			expect.objectContaining({ redirectTo: expect.stringContaining("/admin/auth/confirm") }),
		);
	});

	it("always reports success, even when Supabase reports an error, so the form never reveals which emails have accounts", async () => {
		const supabase = fakeSupabase({ resetPasswordError: { message: "User not found" } });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);
		const formData = new FormData();
		formData.set("email", "unknown@example.com");

		const result = await adminRequestPasswordReset({ status: "idle" }, formData);

		expect(result.status).toBe("success");
		expect(result.message).not.toMatch(/User not found/i);
	});
});

describe("adminUpdatePassword", () => {
	function formDataFor(password: string, confirmPassword: string) {
		const formData = new FormData();
		formData.set("password", password);
		formData.set("confirmPassword", confirmPassword);
		return formData;
	}

	it("rejects an empty password", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await adminUpdatePassword({ status: "idle" }, formDataFor("", ""));

		expect(result).toEqual({ status: "error", message: "Enter and confirm your new password." });
		expect(supabase.auth.updateUser).not.toHaveBeenCalled();
	});

	it("rejects mismatched passwords", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await adminUpdatePassword({ status: "idle" }, formDataFor("correct-horse-1", "correct-horse-2"));

		expect(result).toEqual({ status: "error", message: "Those passwords don't match." });
		expect(supabase.auth.updateUser).not.toHaveBeenCalled();
	});

	it("rejects a password shorter than 8 characters", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await adminUpdatePassword({ status: "idle" }, formDataFor("short1", "short1"));

		expect(result.status).toBe("error");
		expect(supabase.auth.updateUser).not.toHaveBeenCalled();
	});

	it("calls supabase.auth.updateUser with the new password and redirects to /admin/login on success", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		await expect(adminUpdatePassword({ status: "idle" }, formDataFor("correct-horse-battery", "correct-horse-battery"))).rejects.toThrow(
			"REDIRECT:/admin/login?reset=success",
		);

		expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: "correct-horse-battery" });
		expect(supabase.auth.signOut).toHaveBeenCalled();
	});

	it("shows a safe message on a Supabase error, never the raw error text", async () => {
		const supabase = fakeSupabase({ updateUserError: { message: "New password should be different from the old password." } });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await adminUpdatePassword({ status: "idle" }, formDataFor("correct-horse-battery", "correct-horse-battery"));

		expect(result.status).toBe("error");
		expect(result.message).not.toMatch(/should be different from the old password/i);
		expect(mockRedirect).not.toHaveBeenCalled();
	});
});

describe("no service-role client or admin API usage in the recovery flow", () => {
	const ACTIONS_SOURCE = readFileSync(resolve(process.cwd(), "src/lib/actions/adminAuth.ts"), "utf8");
	const ROUTE_SOURCE = readFileSync(resolve(process.cwd(), "src/app/admin/auth/confirm/route.ts"), "utf8");
	const RESET_FORM_SOURCE = readFileSync(resolve(process.cwd(), "src/features/admin/AdminResetPasswordForm.tsx"), "utf8");
	const FORGOT_FORM_SOURCE = readFileSync(resolve(process.cwd(), "src/features/admin/AdminForgotPasswordForm.tsx"), "utf8");

	const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

	it("never imports the privileged/service-role Supabase client", () => {
		for (const source of [ACTIONS_SOURCE, ROUTE_SOURCE, RESET_FORM_SOURCE, FORGOT_FORM_SOURCE]) {
			expect(strip(source)).not.toMatch(/createSupabasePrivilegedClient|service_role/);
		}
	});

	it("never calls auth.admin.updateUserById or any auth.admin.* method", () => {
		for (const source of [ACTIONS_SOURCE, ROUTE_SOURCE, RESET_FORM_SOURCE, FORGOT_FORM_SOURCE]) {
			expect(strip(source)).not.toMatch(/auth\.admin\./);
		}
	});

	it("never imports a Supabase client into a client component (both forms only import the Server Actions)", () => {
		expect(strip(RESET_FORM_SOURCE)).not.toMatch(/from ["']@supabase|from ["']@\/lib\/supabase/);
		expect(strip(FORGOT_FORM_SOURCE)).not.toMatch(/from ["']@supabase|from ["']@\/lib\/supabase/);
	});

	it("the confirm route only ever uses the existing session-aware server client, never a second Supabase client pattern", () => {
		expect(strip(ROUTE_SOURCE)).toMatch(/import \{ createSupabaseServerClient \} from "@\/lib\/supabase\/server";/);
		expect(strip(ROUTE_SOURCE)).not.toMatch(/createClient\(|createBrowserClient\(/);
	});
});

describe("recovery page rendering (structural — no React render plugin in this repo's Vitest setup)", () => {
	const RESET_PAGE_SOURCE = readFileSync(resolve(process.cwd(), "src/app/admin/reset-password/page.tsx"), "utf8");
	const FORGOT_PAGE_SOURCE = readFileSync(resolve(process.cwd(), "src/app/admin/forgot-password/page.tsx"), "utf8");

	it("renders AdminResetPasswordForm only when a session exists, and a safe invalid-link message otherwise", () => {
		expect(RESET_PAGE_SOURCE).toMatch(/const session = await getAdminSession\(\);/);
		expect(RESET_PAGE_SOURCE).toMatch(/\{session \? \(\s*<AdminResetPasswordForm \/>/);
		expect(RESET_PAGE_SOURCE).toContain("This link is invalid or has expired. Request a new password reset.");
	});

	it("renders the forgot-password request form", () => {
		expect(FORGOT_PAGE_SOURCE).toMatch(/<AdminForgotPasswordForm \/>/);
	});

	it("the reset-password form has both password fields, a real submit button, and no unrelated visual-review import", () => {
		expect(RESET_FORM_HAS_TWO_PASSWORD_FIELDS()).toBe(true);

		function RESET_FORM_HAS_TWO_PASSWORD_FIELDS() {
			const source = readFileSync(resolve(process.cwd(), "src/features/admin/AdminResetPasswordForm.tsx"), "utf8");
			const passwordFieldCount = (source.match(/type="password"/g) ?? []).length;
			return passwordFieldCount === 2 && /<button type="submit"/.test(source);
		}
	});
});
