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
 */

const SOURCE_PATH = resolve(process.cwd(), "src/features/content-intelligence/market-opportunity/MarketOpportunityInspector.tsx");
const source = readFileSync(SOURCE_PATH, "utf8");
const importLines = source.split("\n").filter((line) => line.trimStart().startsWith("import"));

describe("MarketOpportunityInspector — no write controls", () => {
	it("never imports from @/lib/actions/*", () => {
		expect(importLines.some((line) => line.includes("@/lib/actions/"))).toBe(false);
	});

	it("never renders a <form>", () => {
		expect(source).not.toContain("<form");
	});

	it("never sets an action= attribute", () => {
		expect(source).not.toContain("action=");
	});

	it.each(["Publish", "Approve", "Dismiss", "Refresh article", "Create brief", "Promote"])(
		"never renders the write-control label %j",
		(label) => {
			expect(source).not.toContain(label);
		},
	);
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
