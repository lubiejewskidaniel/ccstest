import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * This repo has no React Testing Library and no JSX-rendering test
 * harness (vitest.config.ts's own comment: "no React component
 * rendering is under test here… so no @vitejs/plugin-react dependency
 * is needed") — installing one is out of scope for this phase. Instead
 * this test reads `MarketOpportunityInspector.tsx`'s own real source
 * text and asserts on it directly, the same source-inspection pattern
 * already used (and fixed for cross-platform correctness) for the
 * "no service-role bypass" test in
 * `market-opportunity/__tests__/queries.test.ts` — resolved from
 * `process.cwd()`, never `import.meta.url` (which throws
 * "The URL must be of scheme file" on Windows).
 *
 * Phase 3C.3 deliberately updates the write-control label list below
 * (locked decision 18): every EXECUTION-shaped label (locked decision 9)
 * stays forbidden, with "Generate" and "Refresh now" added to that list
 * alongside the four already there. The safe NAVIGATION handoff (plain
 * links to existing routes, never a submit/execute action) is verified
 * structurally -- that `buildRecommendationHandoff` is imported and
 * called, and that its `label`/`href` fields are rendered -- rather than
 * by asserting the literal link-text strings, which are owned by, and
 * already tested in, recommendationHandoff.test.ts. This file also
 * checks for an actual JSX `action=` attribute against comment-stripped
 * source only, so this file's own doc comments (like this one, which
 * mentions `action=` in prose) never trip that check.
 */

const SOURCE_PATH = resolve(process.cwd(), "src/features/content-intelligence/market-opportunity/MarketOpportunityInspector.tsx");
const source = readFileSync(SOURCE_PATH, "utf8");
const importLines = source.split("\n").filter((line) => line.trimStart().startsWith("import"));

const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("MarketOpportunityInspector — no write controls", () => {
	it("never imports from @/lib/actions/*", () => {
		expect(importLines.some((line) => line.includes("@/lib/actions/"))).toBe(false);
	});

	it("never renders a <form>", () => {
		expect(source).not.toContain("<form");
	});

	it("never sets an action= attribute", () => {
		// Matches a real JSX/HTML attribute usage (action={...} or
		// action="...") against comment-stripped code only -- a doc comment
		// or inline comment mentioning "action=" in prose (this file's own
		// production comments explain that no action= attribute is set) must
		// never trip this check. Same bug class as the "use client"
		// doc-comment false positive already fixed once in this file, and the
		// createSupabasePrivilegedClient doc-comment false positive fixed
		// once in queries.ts.
		expect(/\baction\s*=\s*[{"']/.test(codeOnly)).toBe(false);
	});

	it.each(["Publish", "Approve", "Dismiss", "Refresh article", "Create brief", "Promote", "Generate", "Refresh now"])(
		"never renders the write-control label %j",
		(label) => {
			expect(source).not.toContain(label);
		},
	);

	it("never imports a Server Action for brief creation, generation, or promotion", () => {
		const suspiciousImport = importLines.some(
			(line) =>
				line.includes("createBriefAction") ||
				line.includes("runGenerationAction") ||
				line.includes("promoteToArticlesAction") ||
				line.includes("/generation/generate") ||
				line.includes("/briefs/promote"),
		);
		expect(suspiciousImport).toBe(false);
	});
});

describe("MarketOpportunityInspector — Phase 3C.3 recommendation handoff (safe navigation only)", () => {
	it("renders the Recommendation section heading", () => {
		expect(source).toContain("Recommendation");
	});

	it("derives its recommendation from evaluateRecommendation, not a prop or persisted value", () => {
		expect(importLines.some((line) => line.includes("./recommendation") && line.includes("evaluateRecommendation"))).toBe(true);
		expect(source).toContain("evaluateRecommendation(evidence)");
	});

	it("imports buildRecommendationHandoff from recommendationHandoff.ts, never a hand-rolled URL", () => {
		expect(importLines.some((line) => line.includes("./recommendationHandoff") && line.includes("buildRecommendationHandoff"))).toBe(true);
	});

	it("calls buildRecommendationHandoff to compute the handoff", () => {
		expect(codeOnly).toMatch(/\bbuildRecommendationHandoff\s*\(/);
	});

	it("renders handoff.label as the link text -- the exact wording is owned by, and tested in, recommendationHandoff.test.ts, never duplicated here", () => {
		expect(codeOnly).toContain("{handoff.label}");
	});

	it("uses handoff.href as the navigation href, never a hardcoded path", () => {
		expect(codeOnly).toContain("href={handoff.href}");
	});
});

describe("MarketOpportunityInspector — evidence sections", () => {
	it.each(["Subject", "Market demand", "CCS visibility", "CCS trend", "Business relevance", "Content coverage", "Evidence confidence", "Classifications"])(
		"renders the %j section heading",
		(heading) => {
			expect(source).toContain(heading);
		},
	);

	it("uses MarketOpportunityEvidence as its evidence prop type", () => {
		expect(source).toContain("MarketOpportunityEvidence");
	});
});

describe("MarketOpportunityInspector — display-only component", () => {
	it("does not import Supabase or any query module directly (it only receives already-fetched evidence)", () => {
		const suspiciousImport = importLines.some(
			(line) => line.includes("@/lib/supabase") || line.includes("/market/queries") || line.includes("/market-opportunity/queries"),
		);
		expect(suspiciousImport).toBe(false);
	});

	it("is not a client component (no \"use client\" directive)", () => {
		// Matches the real directive form only (own statement, trailing
		// semicolon) — not the bare phrase, which this file's own doc
		// comment uses in prose to explain that it is NOT a client
		// component. A naive substring check would false-positive on that
		// comment, the same class of bug already fixed once in this repo
		// for the "no service-role bypass" test (a doc comment naming
		// createSupabasePrivilegedClient() as a warning, not a usage).
		expect(source).not.toMatch(/^\s*["']use client["'];\s*$/m);
	});
});
