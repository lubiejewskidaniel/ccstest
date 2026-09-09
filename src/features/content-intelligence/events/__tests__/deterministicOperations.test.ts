import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Phase 3C.4C.2, scenario 8 — deterministic content-intelligence modules
 * make no provider call, so they must not create AI operation events.
 * Structural-only check (no behavioural mocking needed): confirms these
 * modules do not import the event writer or any AI provider at all.
 * Reads files via `process.cwd()` + `resolve`, never
 * `import.meta.url`/`fileURLToPath` (fails under Windows Vitest).
 */

function readProjectFile(relativePath: string): string {
	return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function stripComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const DETERMINISTIC_FILES = [
	"src/features/content-intelligence/quality/qualityGate.ts",
	"src/features/content-intelligence/refresh/staleness.ts",
	"src/features/content-intelligence/market-opportunity/marketOpportunity.ts",
	"src/features/content-intelligence/monitoring/performanceAnalysis.ts",
];

describe("8. deterministic operations create no AI events", () => {
	it.each(DETERMINISTIC_FILES)("%s does not import the AI operation event writer or any AI provider", (file) => {
		const code = stripComments(readProjectFile(file));
		expect(code).not.toMatch(/recordAiOperationEvent/);
		expect(code).not.toMatch(/aiOperationEventWriter/);
		expect(code).not.toMatch(/AnthropicProvider/);
		expect(code).not.toMatch(/createAnthropicProvider/);
	});
});
