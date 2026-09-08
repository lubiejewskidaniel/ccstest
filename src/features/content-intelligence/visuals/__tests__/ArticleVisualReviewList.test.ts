import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Phase 3C.4B.4B — coverage for the "Article visual" review UI.
 *
 * This test file cannot render the components: this repository's
 * Vitest setup has no `@vitejs/plugin-react` and no
 * `@testing-library/react` (see `vitest.config.ts`'s own comment, and
 * its `include: ["src/**\/*.test.ts"]`, which doesn't even pick up
 * `.tsx` specs), and adding either is a package-installation decision
 * outside this phase's scope. Every scenario below is therefore proven
 * the same way this repository already proves things it can't run
 * end-to-end — structural source-text assertions against the real,
 * unmodified component files (the exact technique already used for
 * `articleVisualStorage.ts` and the migration SQL) — comments stripped
 * first so a doc comment naming a forbidden concept to document its
 * absence can never cause a false positive.
 */

const LIST_SOURCE_PATH = resolve(process.cwd(), "src/features/content-intelligence/visuals/ArticleVisualReviewList.tsx");
const listSource = readFileSync(LIST_SOURCE_PATH, "utf8");
const listCode = listSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const PANEL_SOURCE_PATH = resolve(process.cwd(), "src/features/content-intelligence/visuals/ArticleVisualReviewPanel.tsx");
const panelSource = readFileSync(PANEL_SOURCE_PATH, "utf8");
const panelCode = panelSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("empty state and candidate rendering", () => {
	it("1. renders the empty-state copy when there are no candidates", () => {
		expect(listCode).toMatch(/candidates\.length === 0[\s\S]{0,80}No visual candidates yet\./);
	});

	it("2, 3, 4, 5. gives every status (pending_review, approved, superseded) a visible text label", () => {
		expect(listCode).toMatch(/pending_review:\s*"Pending review"/);
		expect(listCode).toMatch(/approved:\s*"Approved"/);
		expect(listCode).toMatch(/superseded:\s*"Superseded"/);
	});

	it("renders every candidate the server provided, never a filtered subset (superseded candidates stay visible as history)", () => {
		expect(listCode).toMatch(/\{candidates\.map\(/);
		// No `.filter(` call narrows `candidates` before it's mapped —
		// the only `.filter(` in the file is `approvedCandidates`, a
		// separate derived value used purely for active-cover/confirmation
		// logic, never substituted for `candidates` in the render.
		expect(listCode).not.toMatch(/\{candidates\.filter\([\s\S]{0,200}\.map\(/);
	});

	it("6. never reorders the server-provided candidate list (no .sort()/.reverse() call)", () => {
		expect(listCode).not.toMatch(/\.sort\(|\.reverse\(/);
	});
});

describe("preview and alt text", () => {
	it("7. renders the preview image from candidate.publicUrl", () => {
		expect(listCode).toMatch(/src=\{candidate\.publicUrl\}/);
	});

	it("8 & 9. prefills the pending alt input from candidate.altText, falling back to an empty string when it's null", () => {
		expect(listCode).toMatch(/return altValues\[candidate\.id\] \?\? candidate\.altText \?\? "";/);
		expect(listCode).toMatch(/value=\{altValueFor\(candidate\)\}/);
	});

	it("40. never derives a Storage URL client-side — no storage.from/getPublicUrl/bucket reference anywhere in the UI", () => {
		expect(listCode).not.toMatch(/\.storage\.from\(|getPublicUrl\(|ARTICLE_VISUALS_BUCKET/);
		expect(panelCode).not.toMatch(/\.storage\.from\(|getPublicUrl\(|ARTICLE_VISUALS_BUCKET/);
	});
});

describe("approve action gating (10, 11, 12)", () => {
	it("gates every approval control behind isPending, defined as candidate.status === 'pending_review' — so approved/superseded candidates structurally cannot reach an approve button", () => {
		expect(listCode).toMatch(/const isPending = candidate\.status === "pending_review";/);
		expect(listCode).toMatch(/\{isPending \? \(/);
	});
});

describe("action payload safety (13, 14, 15, 16, 17)", () => {
	it("13. calls approveArticleVisualAction with exactly articleId, visualId, altText, locale and slug", () => {
		expect(listCode).toMatch(
			/await approveArticleVisualAction\(\{\s*articleId,\s*visualId: candidate\.id,\s*altText: altValueFor\(candidate\),\s*locale,\s*slug,\s*\}\)/,
		);
	});

	it("14. never submits a URL of any kind (no publicUrl/coverImageUrl/storagePath key anywhere in the file)", () => {
		expect(listCode).not.toMatch(/publicUrl:|coverImageUrl:|storagePath:/);
	});

	it("15. never submits a reviewedBy field", () => {
		expect(listCode).not.toMatch(/reviewed_?[Bb]y/);
	});

	it("16. never imports a Supabase client", () => {
		expect(listCode).not.toMatch(/from ["']@supabase|from ["']@\/lib\/supabase/);
		expect(panelCode).not.toMatch(/from ["']@supabase|from ["']@\/lib\/supabase/);
	});

	it("17. never imports or references the privileged/service-role client", () => {
		expect(listCode).not.toMatch(/createSupabasePrivilegedClient|service_role/);
		expect(panelCode).not.toMatch(/createSupabasePrivilegedClient|service_role/);
	});
});

describe("pending/disabled behaviour (18)", () => {
	it("disables the approve button and both confirmation buttons while a transition is pending", () => {
		expect(listCode).toMatch(/disabled=\{pending \|\| isInconsistent\}/);
		const confirmButtonDisabled = (listCode.match(/disabled=\{pending\}/g) ?? []).length;
		expect(confirmButtonDisabled).toBe(2); // Confirm and Cancel
	});
});

describe("error and refresh behaviour (19, 20, 21, 22)", () => {
	it("19 & 20. renders any failure's result.message (covers every kind uniformly, including validation and persistence)", () => {
		expect(listCode).toMatch(/setError\(result\.message\);/);
		expect(listCode).toMatch(/\{error \? \(/);
	});

	it("21. calls router.refresh() only after the success path", () => {
		expect(listCode).toMatch(/router\.refresh\(\);/);
	});

	it("22. never calls router.refresh() inside the failure branch", () => {
		const failureBlock = listCode.match(/if \(!result\.ok\) \{[\s\S]*?return;\s*\}/);
		expect(failureBlock).not.toBeNull();
		expect(failureBlock?.[0]).not.toMatch(/router\.refresh\(\)/);
	});
});

describe("no optimistic mutation (23)", () => {
	it("never copies the server-provided candidates into local state or mutates a candidate's status client-side", () => {
		expect(listCode).not.toMatch(/useState\([^)]*candidates[^)]*\)/);
		expect(listCode).not.toMatch(/\.status\s*=\s*["']approved["']/);
	});
});

describe("independent per-candidate alt state (24)", () => {
	it("keys alt-text edits by candidate.id, not a single shared value", () => {
		expect(listCode).toMatch(/\[candidate\.id\]: value/);
	});
});

describe("confirmation rule (25, 26, 27, 28)", () => {
	it("requires confirmation when another managed candidate is approved, or a legacy cover is active — and only then", () => {
		expect(listCode).toMatch(/const requiresConfirmation = approvedCandidates\.length > 0 \|\| hasLegacyActiveCover;/);
	});

	it("identifies the confirming candidate by id, never a bare boolean (so multiple pending candidates stay independently confirmable)", () => {
		expect(listCode).toMatch(/const \[confirmingVisualId, setConfirmingVisualId\] = useState<string \| null>\(null\);/);
		expect(listCode).not.toMatch(/const \[confirm(ing)?,.*useState<boolean>/);
	});
});

describe("inconsistent state handling (29, 30, 31)", () => {
	it("29. shows the exact locked warning copy when state is inconsistent", () => {
		expect(listCode).toContain("The active cover state is inconsistent. Refresh the page before making further visual changes.");
	});

	it("30. never guesses an active candidate while inconsistent — isActive is forced false for every candidate in that state", () => {
		expect(listCode).toMatch(/const isActive = !isInconsistent && candidate\.status === "approved";/);
	});

	it("31. disables the approve control while inconsistent", () => {
		expect(listCode).toMatch(/disabled=\{pending \|\| isInconsistent\}/);
	});
});

describe("scope exclusions (32-36)", () => {
	it("contains no Generate, Upload, Reject, Delete, Publish, or image-provider control", () => {
		expect(listCode).not.toMatch(/Generate/);
		expect(listCode).not.toMatch(/Upload/);
		expect(listCode).not.toMatch(/Reject/);
		expect(listCode).not.toMatch(/Delete/);
		expect(listCode).not.toMatch(/Publish|setArticleStatusAction|transitionArticleStatus/);
		expect(listCode).not.toMatch(/ArticleVisualProvider|articleVisualBrief|\.generate\(/);
	});
});

describe("accessibility (37, 38)", () => {
	it("37. associates the alt-text label with its input via a matching id", () => {
		expect(listCode).toMatch(/htmlFor=\{`visual-alt-\$\{candidate\.id\}`\}[\s\S]{0,120}id=\{`visual-alt-\$\{candidate\.id\}`\}/);
	});

	it("38. uses real <button> elements for approval and confirmation, not click handlers on non-interactive elements", () => {
		const buttonCount = (listCode.match(/<button[\s\S]{0,30}type="button"/g) ?? []).length;
		expect(buttonCount).toBe(3); // Approve visual, Confirm, Cancel
	});
});

describe("legacy-cover note (39)", () => {
	it("gates the legacy-cover note behind hasLegacyActiveCover, itself only true with zero approved candidates and an approved article cover status", () => {
		expect(listCode).toMatch(
			/const hasLegacyActiveCover = approvedCandidates\.length === 0 && articleCoverImageStatus === "approved" && Boolean\(articleCoverImageUrl\);/,
		);
		expect(listCode).toMatch(/\{hasLegacyActiveCover \? \(/);
	});
});

describe("ArticleVisualReviewPanel.tsx (server component)", () => {
	it("loads candidates via the existing listArticleVisuals query, not a new data path", () => {
		expect(panelCode).toMatch(/import \{ listArticleVisuals \} from "\.\/articleVisualQueries";/);
		expect(panelCode).toMatch(/await listArticleVisuals\(articleId\)/);
	});

	it("passes only the article fields needed for active-cover context, not the full Article object", () => {
		expect(panelCode).not.toMatch(/import type \{ Article \}/);
	});
});
