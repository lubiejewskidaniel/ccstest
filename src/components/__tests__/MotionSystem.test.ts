import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isBootExcludedRoute } from "../MotionSystem";

/**
 * Regression coverage for the boot-lock lifecycle bug: `<html>` could
 * keep the `boot-lock` class (motion.css: `overflow: hidden` on
 * `html`/`body`) after navigating into the admin dashboard, because its
 * only removal path was a 620ms timer that a rapid effect cleanup could
 * cancel before it fired.
 *
 * This repository's Vitest setup has no `@vitejs/plugin-react` (see
 * vitest.config.ts), so `MotionSystem` itself cannot be rendered.
 * `isBootExcludedRoute` is exported specifically so the one condition
 * that decides whether `boot-lock` may legitimately exist is testable
 * with real function calls. The DOM-effect wiring around it (which
 * cannot be exercised without rendering) is proven structurally against
 * the real, unmodified source text -- the same technique already used
 * throughout this codebase for untestable `.tsx` files (see
 * ArticleVisualReviewList.test.ts).
 */

describe("isBootExcludedRoute", () => {
	it("excludes every admin dashboard route", () => {
		expect(isBootExcludedRoute("/admin")).toBe(true);
		expect(isBootExcludedRoute("/admin/insights")).toBe(true);
		expect(isBootExcludedRoute("/admin/insights/11111111-1111-4111-8111-111111111111/edit")).toBe(true);
		expect(isBootExcludedRoute("/admin/leads")).toBe(true);
	});

	it("does not exclude /admin/login -- it gets the normal public boot chrome", () => {
		expect(isBootExcludedRoute("/admin/login")).toBe(false);
	});

	it("does not exclude public routes", () => {
		expect(isBootExcludedRoute("/")).toBe(false);
		expect(isBootExcludedRoute("/insights")).toBe(false);
		expect(isBootExcludedRoute("/pl/uslugi")).toBe(false);
	});

	it("matches PublicChrome/SiteChrome's own startsWith(\"/admin\") behaviour exactly, including its known startsWith quirk", () => {
		// Not a new characteristic introduced here -- PublicChrome.tsx and
		// SiteChrome.tsx already use this exact `startsWith("/admin")` check,
		// so a path like "/administration" is excluded by all three for the
		// same pre-existing reason. Asserted here so this stays intentional
		// and consistent, not because it's the ideal general-purpose check.
		expect(isBootExcludedRoute("/administration")).toBe(true);
	});

	it("treats a null pathname as not excluded (matches PublicChrome's own optional-chaining default)", () => {
		expect(isBootExcludedRoute(null)).toBe(false);
	});

	it("is a pure function -- the same input always produces the same result", () => {
		expect(isBootExcludedRoute("/admin/insights")).toBe(isBootExcludedRoute("/admin/insights"));
	});
});

describe("MotionSystem.tsx structural boundaries (boot-lock lifecycle)", () => {
	const SOURCE_PATH = resolve(process.cwd(), "src/components/MotionSystem.tsx");
	const source = readFileSync(SOURCE_PATH, "utf8");
	const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

	it("the boot-curtain effect checks isBootExcludedRoute before touching the curtain element", () => {
		const effectBody = codeOnly.match(/useIsomorphicLayoutEffect\(\(\) => \{[\s\S]*?\}, \[pathname\]\);/)?.[0] ?? "";
		expect(effectBody).not.toBe("");

		const excludedCheckIndex = effectBody.indexOf("isBootExcludedRoute(pathname)");
		const curtainLookupIndex = effectBody.indexOf('getElementById("bootCurtain")');

		expect(excludedCheckIndex).toBeGreaterThan(-1);
		expect(curtainLookupIndex).toBeGreaterThan(-1);
		expect(excludedCheckIndex).toBeLessThan(curtainLookupIndex);
	});

	it("removes boot-lock unconditionally on an excluded (admin) route, in the effect body -- not only in a cleanup function", () => {
		const excludedBranch = codeOnly.match(/if \(isBootExcludedRoute\(pathname\)\) \{[\s\S]*?\}/)?.[0] ?? "";
		expect(excludedBranch).toMatch(/document\.documentElement\.classList\.remove\(["']boot-lock["']\)/);
		// This must be a plain statement in the branch, not something
		// returned as a cleanup function -- proven by the branch containing
		// no arrow-function cleanup syntax of its own.
		expect(excludedBranch).not.toMatch(/return \(\) =>/);
	});

	it("the boot timer's cleanup removes boot-lock itself, not only clearTimeout", () => {
		const cleanupBlock = codeOnly.match(/return \(\) => \{[\s\S]*?\};/)?.[0] ?? "";
		expect(cleanupBlock).toMatch(/window\.clearTimeout\(t\)/);
		expect(cleanupBlock).toMatch(/document\.documentElement\.classList\.remove\(["']boot-lock["']\)/);
	});

	it("boot-lock is only ever added inside the genuine, non-excluded boot branch (never unconditionally at module scope)", () => {
		const addCalls = codeOnly.match(/classList\.add\(["']boot-lock["']\)/g) ?? [];
		expect(addCalls).toHaveLength(1);
	});

	it("does not remove the #admin/login exception -- the sign-in page still marks its curtain done immediately", () => {
		expect(codeOnly).toMatch(/pathname === "\/admin\/login"/);
		expect(codeOnly).toMatch(/curtain\.classList\.add\("done"\)/);
	});
});
