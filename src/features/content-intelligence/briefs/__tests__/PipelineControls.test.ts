import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A2 — `PipelineControls.tsx` is a client component; Vitest's `include`
 * (`src/**\/*.test.ts`) excludes `.tsx`, and this project has no
 * `@testing-library/react` installed (see vitest.config.ts). Its wiring
 * is proven structurally against the real, unmodified source text, the
 * same technique already used for `CreateBriefForm.tsx`/`ArticleShare.tsx`.
 */

const SOURCE_PATH = resolve(process.cwd(), "src/features/content-intelligence/briefs/PipelineControls.tsx");
const source = readFileSync(SOURCE_PATH, "utf8");
const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("PipelineControls.tsx -- A2 promoted-status gating", () => {
	it("relevantStageKeys returns no stage-rerun actions once the brief is promoted", () => {
		expect(codeOnly).toMatch(/if\s*\(status === "promoted"\)\s*return\s*\[\];/);
	});

	it("the promoted branch is checked before the generic fallback that otherwise exposes all four stages", () => {
		const fnBody = codeOnly.match(/function relevantStageKeys[\s\S]*?\n\}/)?.[0] ?? "";
		const promotedIndex = fnBody.indexOf('status === "promoted"');
		const fallbackIndex = fnBody.indexOf('return ["research", "generation", "localisation", "quality"];');
		expect(promotedIndex).toBeGreaterThan(-1);
		expect(fallbackIndex).toBeGreaterThan(-1);
		expect(promotedIndex).toBeLessThan(fallbackIndex);
	});

	it("does not render the 'Promote to draft article(s)' button once the brief is already promoted", () => {
		expect(codeOnly).toMatch(/const isPromoted = status === "promoted";/);
		expect(codeOnly).toMatch(/\{!isPromoted \? \(\s*<button type="button" className="btn btn-primary"/);
	});

	it("shows a clear 'already promoted' message directing further edits to the article editor", () => {
		expect(codeOnly).toMatch(/This brief has already been promoted\./);
		expect(codeOnly).toMatch(/article editor/);
	});

	it("still gates promotion itself on quality_passed, unchanged from before", () => {
		expect(codeOnly).toMatch(/const canPromote = status === "quality_passed";/);
	});

	it("visibleStages is still derived from relevantStageKeys, so the promoted branch actually suppresses the rendered buttons", () => {
		expect(codeOnly).toMatch(/const visibleStages = STAGE_ORDER\.filter\(\(stage\) => relevantStageKeys\(status, hasResearch, hasGenerated\)\.includes\(stage\.key\)\);/);
	});

	it("does not introduce a new BriefStatus value or touch the existing stage action list", () => {
		expect(codeOnly).not.toMatch(/"promoted_locked"|"archived"|"completed"/);
		expect(codeOnly).toMatch(/runResearchAction,\s*runGenerationAction,\s*runLocalisationAction,\s*runQualityCheckAction,\s*promoteToArticlesAction,/);
	});
});
