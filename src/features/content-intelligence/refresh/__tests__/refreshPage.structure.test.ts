import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * /admin/insights/refresh is a Server Component with no client-testable
 * runtime harness in this project (see CreateBriefForm.test.ts for the
 * same constraint) -- proven structurally against the real source instead.
 */

const PAGE_PATH = resolve(process.cwd(), "src/app/admin/(dashboard)/insights/refresh/page.tsx");
const source = readFileSync(PAGE_PATH, "utf8");
const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("refresh page -- active measurement state is communicated, not silent", () => {
	it("checks hasPendingRefresh per candidate before deciding what to show", () => {
		expect(codeOnly).toMatch(/hasPendingRefresh\(c\.articleId\)/);
	});

	it("shows an explicit 'active measurement' message instead of a plain edit link when one is pending", () => {
		expect(codeOnly).toMatch(/Active measurement in progress/);
		expect(codeOnly).toMatch(/\{measuring \? \(/);
	});

	it("candidate links carry the refreshCandidate intent flag", () => {
		expect(codeOnly).toMatch(/\?refreshCandidate=1/);
	});

	it("renders a refresh history section with baseline evidence and evaluation status", () => {
		expect(codeOnly).toMatch(/Refresh history/);
		expect(codeOnly).toMatch(/baselineWindowDays/);
		expect(codeOnly).toMatch(/STATUS_LABEL/);
	});

	it("shows the Evaluate action only when isEligibleForEvaluation says so, and a countdown otherwise", () => {
		expect(codeOnly).toMatch(/isEligibleForEvaluation\(entry\)/);
		expect(codeOnly).toMatch(/daysUntilEvaluable\(entry\)/);
		expect(codeOnly).toMatch(/<EvaluateRefreshButton id={entry\.id} \/>/);
	});
});
