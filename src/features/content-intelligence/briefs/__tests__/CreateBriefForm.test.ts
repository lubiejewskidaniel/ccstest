import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `CreateBriefForm.tsx` is a client component -- Vitest's `include`
 * (`src/**\/*.test.ts`) excludes `.tsx`, and this project has no
 * `@testing-library/react` installed (see vitest.config.ts). Its wiring
 * is proven structurally against the real, unmodified source text, the
 * same technique already used for `ArticleShare.tsx`/`ArticlePage.tsx`.
 */

const SOURCE_PATH = resolve(process.cwd(), "src/features/content-intelligence/briefs/CreateBriefForm.tsx");
const source = readFileSync(SOURCE_PATH, "utf8");
const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("CreateBriefForm.tsx -- Starting notes validation UX", () => {
	it("renders fieldError(\"keyPoints\") directly with the Starting notes field, unlike before", () => {
		expect(codeOnly).toMatch(/fieldError\("keyPoints"\)/);
	});

	it("caps the textarea at 4000 characters via maxLength, matching the schema's own limit", () => {
		expect(codeOnly).toMatch(/<textarea[\s\S]*?maxLength=\{KEY_POINTS_LIMIT\}[\s\S]*?\/>/);
		expect(codeOnly).toMatch(/KEY_POINTS_LIMIT\s*=\s*4000/);
	});

	it("the character counter is driven by keyPoints.length against the 4000 limit", () => {
		expect(codeOnly).toMatch(/\{keyPoints\.length\}\s*\/\s*\{KEY_POINTS_LIMIT\}/);
	});

	it("the Starting notes textarea is controlled by local keyPoints state seeded from defaultKeyPoints", () => {
		expect(codeOnly).toMatch(/useState\(defaultKeyPoints\s*\?\?\s*""\)/);
		expect(codeOnly).toMatch(/value=\{keyPoints\}/);
		expect(codeOnly).toMatch(/onChange=\{\(e\)\s*=>\s*setKeyPoints\(e\.target\.value\)\}/);
	});

	it("preserves name=\"keyPoints\" so FormData/server validation is unaffected", () => {
		const textareaBlock = codeOnly.match(/<textarea[\s\S]*?\/>/)?.[0] ?? "";
		expect(textareaBlock).toMatch(/name="keyPoints"/);
	});

	it("disables submission while keyPoints.length exceeds the limit, in addition to the existing pending check", () => {
		const submitButton = codeOnly.match(/<button type="submit"[\s\S]*?<\/button>/)?.[0] ?? "";
		expect(submitButton).toMatch(/disabled=\{pending\s*\|\|\s*keyPointsOverLimit\}/);
	});

	it("computes keyPointsOverLimit from the live state, not only from the maxLength attribute", () => {
		expect(codeOnly).toMatch(/keyPointsOverLimit\s*=\s*keyPoints\.length\s*>\s*KEY_POINTS_LIMIT/);
	});

	it("shows at most one Starting notes error -- the over-limit message takes priority over a stale server fieldError", () => {
		expect(codeOnly).toMatch(/keyPointsError\s*=\s*keyPointsOverLimit\s*\?\s*KEY_POINTS_OVER_LIMIT_MESSAGE\s*:\s*fieldError\("keyPoints"\)/);
		// Only one error span is ever rendered for this field -- no separate,
		// simultaneously-visible "over limit" AND "server error" elements.
		const errorSpans = codeOnly.match(/id="keyPoints-error"/g) ?? [];
		expect(errorSpans).toHaveLength(1);
	});

	it("never exposes raw Zod wording -- the client-side message matches the schema's own human-readable text", () => {
		expect(codeOnly).toMatch(/"Starting notes must be 4000 characters or fewer\."/);
		expect(codeOnly).not.toMatch(/expected string/i);
	});

	it("associates the textarea with the counter and error via aria-describedby/aria-invalid, scoped to this field only", () => {
		const textareaBlock = codeOnly.match(/<textarea[\s\S]*?\/>/)?.[0] ?? "";
		expect(textareaBlock).toMatch(/aria-invalid=\{keyPointsError \? true : undefined\}/);
		expect(textareaBlock).toMatch(/aria-describedby=\{keyPointsError \? "keyPoints-count keyPoints-error" : "keyPoints-count"\}/);
		// Both referenced ids actually exist on the elements they describe.
		expect(codeOnly).toMatch(/id="keyPoints-count"/);
		expect(codeOnly).toMatch(/id="keyPoints-error"/);
	});

	it("uses the existing global form styling classes rather than introducing a CSS Module", () => {
		expect(codeOnly).not.toMatch(/from ["'].*\.module\.css["']/);
		expect(codeOnly).toMatch(/className=\{`char-count \$\{keyPointsOverLimit \? "char-count-over" : ""\}`\}/);
	});
});
