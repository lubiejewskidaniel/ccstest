import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * TrackMarketKeywordForm.tsx is a client component -- no @testing-library
 * in this project (see vitest.config.ts), so its wiring is proven
 * structurally, the same technique used for CreateBriefForm.tsx/
 * PipelineControls.tsx.
 */

const SOURCE_PATH = resolve(process.cwd(), "src/features/content-intelligence/market/TrackMarketKeywordForm.tsx");
const source = readFileSync(SOURCE_PATH, "utf8");
const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("TrackMarketKeywordForm.tsx", () => {
	it("offers exactly the UK and Poland markets", () => {
		expect(codeOnly).toMatch(/<option value="gb">UK — English<\/option>/);
		expect(codeOnly).toMatch(/<option value="pl">Poland — Polish<\/option>/);
	});

	it("associates the keyword and market inputs with their labels", () => {
		expect(codeOnly).toMatch(/htmlFor="market-keyword"/);
		expect(codeOnly).toMatch(/id="market-keyword"/);
		expect(codeOnly).toMatch(/htmlFor="market-country"/);
		expect(codeOnly).toMatch(/id="market-country"/);
	});

	it("trims the keyword and blocks an empty/whitespace-only submission before calling the action", () => {
		expect(codeOnly).toMatch(/const trimmed = keyword\.trim\(\);/);
		expect(codeOnly).toMatch(/if \(!trimmed\) return;/);
		expect(codeOnly).toMatch(/fetchMarketKeywordStatsAction\(trimmed, country\)/);
	});

	it("disables the submit button while pending or when the keyword is empty", () => {
		expect(codeOnly).toMatch(/disabled=\{pending \|\| !keyword\.trim\(\)\}/);
	});

	it("announces errors and status via role, not colour alone", () => {
		expect(codeOnly).toMatch(/role="status"/);
		expect(codeOnly).toMatch(/role=\{message\.isError \? "alert" : "status"\}/);
	});

	it("never imports the Bing API key or constructs a request itself -- only calls the existing action", () => {
		expect(codeOnly).not.toMatch(/BING_WEBMASTER_API_KEY/);
		expect(codeOnly).not.toMatch(/fetch\(/);
	});
});
