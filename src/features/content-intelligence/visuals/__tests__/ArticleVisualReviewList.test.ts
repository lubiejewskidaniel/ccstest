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

const PANEL_CSS_PATH = resolve(process.cwd(), "src/features/content-intelligence/visuals/ArticleVisualReviewPanel.module.css");
const panelCssSource = readFileSync(PANEL_CSS_PATH, "utf8");
const panelCss = panelCssSource.replace(/\/\*[\s\S]*?\*\//g, "");

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
		expect(listCode).toMatch(/setApprovalError\(result\.message\);/);
		expect(listCode).toMatch(/\{approvalError \? \(/);
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
	it("contains no Upload, Reject, Delete, Publish, or image-provider control", () => {
		expect(listCode).not.toMatch(/Upload/);
		expect(listCode).not.toMatch(/Reject/);
		expect(listCode).not.toMatch(/Delete/);
		expect(listCode).not.toMatch(/Publish|setArticleStatusAction|transitionArticleStatus/);
		expect(listCode).not.toMatch(/ArticleVisualProvider|articleVisualBrief|\.generate\(/);
	});

	it("contains no Regenerate, 'Generate again', or 'Generate and approve' control (Phase 3C.4B.5C exclusions)", () => {
		expect(listCode).not.toMatch(/Regenerate/i);
		expect(listCode).not.toMatch(/Generate again/i);
		expect(listCode).not.toMatch(/Generate and approve/i);
		expect(listCode).not.toMatch(/provider selector|model selector|quality selector|size selector|prompt input/i);
	});
});

describe("accessibility (37, 38)", () => {
	it("37. associates the alt-text label with its input via a matching id", () => {
		expect(listCode).toMatch(/htmlFor=\{`visual-alt-\$\{candidate\.id\}`\}[\s\S]{0,120}id=\{`visual-alt-\$\{candidate\.id\}`\}/);
	});

	it("38. uses real <button> elements for approval, confirmation, and generation, not click handlers on non-interactive elements", () => {
		const buttonCount = (listCode.match(/<button[\s\S]{0,30}type="button"/g) ?? []).length;
		expect(buttonCount).toBe(4); // Approve visual, Confirm, Cancel, Generate visual
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

// ============================================================
// Phase 3C.4B.5C — "Generate visual" human-triggered generation UI.
// Same structural-source-text technique as above (no React renderer in
// this test architecture); also reads the Server Action's own source
// directly, since its correctness (no business logic, correct
// revalidation) can only be checked there.
// ============================================================

const ACTIONS_SOURCE_PATH = resolve(process.cwd(), "src/lib/actions/insightsCms.ts");
const actionsSource = readFileSync(ACTIONS_SOURCE_PATH, "utf8");
const actionsCode = actionsSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("Generate visual control presence (1-5)", () => {
	it("1 & 2. renders a Generate visual button unconditionally, not gated behind candidates.length", () => {
		expect(listCode).toMatch(/>\s*\{generationPending \? "Generating visual…" : "Generate visual"\}\s*<\/button>/);
	});

	it("3, 4, 5. the Generate visual control is rendered before the candidates.length branch, so it is visible regardless of candidate/article state (pending, approved, or published-article context, none of which this component even receives as a status flag)", () => {
		const generateIndex = listCode.indexOf("runGenerate");
		const candidatesBranchIndex = listCode.indexOf("candidates.length === 0 ?");
		expect(generateIndex).toBeGreaterThan(-1);
		expect(candidatesBranchIndex).toBeGreaterThan(-1);
		expect(generateIndex).toBeLessThan(candidatesBranchIndex);
		// Nothing in the render path gates the generate button/row behind
		// isInconsistent, hasLegacyActiveCover, or any article-status value.
		expect(listCode).not.toMatch(/generateRow[\s\S]{0,10}isInconsistent/);
		expect(listCode).not.toMatch(/disabled=\{generationPending \|\| isInconsistent\}/);
	});
});

describe("Generate visual action call (6, 7, 8, 9, 10, 11)", () => {
	it("6 & 7. calls generateArticleVisualAction with exactly articleId, locale and slug", () => {
		expect(listCode).toMatch(/await generateArticleVisualAction\(\{ articleId, locale, slug \}\)/);
	});

	it("8. never includes a prompt field in the generation call site", () => {
		expect(listCode).not.toMatch(/prompt/i);
	});

	it("9. never includes a providerId/provider field in the generation call site", () => {
		expect(listCode).not.toMatch(/providerId|provider:/);
	});

	it("10. never includes a url/storagePath field in the generation call site", () => {
		expect(listCode).not.toMatch(/storagePath:|visualUrl:|imageUrl:/);
	});

	it("11. never references an API key anywhere in this file", () => {
		expect(listCode).not.toMatch(/api[_-]?key/i);
	});
});

describe("Generate visual pending behaviour (12, 13, 14, 15)", () => {
	it("12. disables the Generate visual button while generationPending", () => {
		expect(listCode).toMatch(/disabled=\{generationPending\}/);
	});

	it("13. shows explicit 'Generating visual…' pending text", () => {
		expect(listCode).toContain("Generating visual…");
	});

	it("14. never hides or filters the candidate grid while generation is pending — no generationPending check guards the candidates.length/.map branch", () => {
		const renderFromCandidates = listCode.slice(listCode.indexOf("{candidates.length === 0"));
		expect(renderFromCandidates).not.toMatch(/generationPending/);
	});

	it("15. never inserts a fake/optimistic candidate — candidates is never written to via setState, only read", () => {
		expect(listCode).not.toMatch(/setCandidates/);
		expect(listCode).not.toMatch(/\[\s*\.\.\.candidates/);
	});
});

describe("Generate visual success/failure behaviour (16, 17, 18)", () => {
	it("16. calls router.refresh() on a successful generation", () => {
		const generateFn = listCode.slice(listCode.indexOf("function runGenerate"), listCode.indexOf("function runGenerate") + 800);
		expect(generateFn).toMatch(/router\.refresh\(\);/);
	});

	it("17. never calls router.refresh() in the generation failure branch", () => {
		const generateFn = listCode.slice(listCode.indexOf("function runGenerate"), listCode.indexOf("function runGenerate") + 800);
		const failureBlock = generateFn.match(/if \(!result\.ok\) \{[\s\S]*?return;\s*\}/);
		expect(failureBlock).not.toBeNull();
		expect(failureBlock?.[0]).not.toMatch(/router\.refresh\(\)/);
	});

	it("18. displays result.message on generation failure via generationError", () => {
		expect(listCode).toMatch(/setGenerationError\(result\.message\);/);
		expect(listCode).toMatch(/\{generationError \? \(/);
	});
});

describe("Generation never approves (19, 20)", () => {
	it("19 & 20. the generation handler never calls approveArticleVisualAction and never sets confirmingVisualId", () => {
		const generateFn = listCode.slice(listCode.indexOf("function runGenerate"), listCode.indexOf("function runGenerate") + 800);
		expect(generateFn).not.toMatch(/approveArticleVisualAction/);
		expect(generateFn).not.toMatch(/setConfirmingVisualId/);
	});
});

describe("client/security boundary (21, 22, 23, 24)", () => {
	it("21. never imports a Supabase client (re-verified for the 5C additions)", () => {
		expect(listCode).not.toMatch(/from ["']@supabase|from ["']@\/lib\/supabase/);
	});

	it("22. never imports the OpenAI provider", () => {
		expect(listCode).not.toMatch(/OpenAiArticleVisualProvider|from ["']openai["']/i);
	});

	it("23. never imports the generation service internals directly", () => {
		expect(listCode).not.toMatch(/articleVisualGenerationService|generateArticleVisualCandidate/);
	});

	it("24. never references raw image bytes or base64 data", () => {
		expect(listCode).not.toMatch(/b64_json|base64|Uint8Array|data:image/);
	});
});

describe("scope exclusions specific to generation (25, 26, 27, 28)", () => {
	it("25. no Regenerate button", () => {
		expect(listCode).not.toMatch(/Regenerate/i);
	});

	it("26. no Upload button", () => {
		expect(listCode).not.toMatch(/Upload visual|Upload button/i);
	});

	it("27. no combined Generate-and-approve control", () => {
		expect(listCode).not.toMatch(/Generate and approve/i);
	});

	it("28. no confirmation step before generation — runGenerate is called directly from the button's onClick, with no intermediate confirm state", () => {
		expect(listCode).toMatch(/onClick=\{runGenerate\}/);
	});
});

describe("approval behaviour unaffected by generation (29, 30)", () => {
	it("29. approval confirmation logic (requiresConfirmation, confirmingVisualId) is unchanged by the 5C additions", () => {
		expect(listCode).toMatch(/const requiresConfirmation = approvedCandidates\.length > 0 \|\| hasLegacyActiveCover;/);
		expect(listCode).toMatch(/const \[confirmingVisualId, setConfirmingVisualId\] = useState<string \| null>\(null\);/);
	});

	it("30. generation error and approval error are two separate state variables, not one shared 'error' state", () => {
		expect(listCode).toMatch(/const \[approvalError, setApprovalError\] = useState<string \| null>\(null\);/);
		expect(listCode).toMatch(/const \[generationError, setGenerationError\] = useState<string \| null>\(null\);/);
		expect(listCode).not.toMatch(/const \[error, setError\]/);
	});
});

describe("cost-awareness note and re-enable behaviour (31, 32)", () => {
	it("31. shows the exact cost-awareness note near the control", () => {
		expect(listCode).toContain("Generates one new visual candidate for review.");
	});

	it("32. the Generate visual button re-enables after a failed action (disabled is driven only by the live generationPending transition flag, which useTransition clears once the async callback returns)", () => {
		expect(listCode).toMatch(/disabled=\{generationPending\}/);
		// The failure branch never sets generationPending or otherwise
		// leaves the button permanently disabled -- useTransition itself
		// owns clearing it once the transition's callback settles.
		const generateFn = listCode.slice(listCode.indexOf("function runGenerate"), listCode.indexOf("function runGenerate") + 800);
		expect(generateFn).not.toMatch(/setGenerationPending/);
	});
});

describe("independent repeatable invocation (33, 34)", () => {
	it("33 & 34. runGenerate always issues exactly one generateArticleVisualAction call per invocation, with no loop/retry wrapper", () => {
		const generateFn = listCode.slice(listCode.indexOf("function runGenerate"), listCode.indexOf("function runGenerate") + 800);
		const callCount = (generateFn.match(/generateArticleVisualAction\(/g) ?? []).length;
		expect(callCount).toBe(1);
		expect(generateFn).not.toMatch(/\bfor\s*\(|\bwhile\s*\(/);
	});
});

describe("generateArticleVisualAction Server Action (35, 36, 37, 38)", () => {
	it("35. contains no generation business logic -- delegates entirely to generateArticleVisualCandidate", () => {
		const actionBlock = actionsCode.slice(actionsCode.indexOf("export async function generateArticleVisualAction"));
		expect(actionBlock).toMatch(/await generateArticleVisualCandidate\(args\.articleId\)/);
		expect(actionBlock).not.toMatch(/createOpenAiArticleVisualProvider|storeGeneratedArticleVisual|buildArticleVisualBrief/);
	});

	it("36. revalidates the admin edit route on success", () => {
		const actionBlock = actionsCode.slice(actionsCode.indexOf("export async function generateArticleVisualAction"));
		expect(actionBlock).toMatch(/if \(result\.ok\) \{\s*revalidatePath\(`\/admin\/insights\/\$\{args\.articleId\}\/edit`\);/);
	});

	it("37. does not perform the success revalidation on failure (revalidatePath is inside the result.ok branch only)", () => {
		const actionBlock = actionsCode.slice(
			actionsCode.indexOf("export async function generateArticleVisualAction"),
			actionsCode.indexOf("export async function generateArticleVisualAction") + 600,
		);
		const okBlock = actionBlock.match(/if \(result\.ok\) \{[\s\S]*?\}/);
		expect(okBlock).not.toBeNull();
		expect(actionBlock.replace(okBlock?.[0] ?? "", "")).not.toMatch(/revalidatePath/);
	});

	it("38. the action returns the service result as-is -- no raw bytes/provider data field is added to it", () => {
		const actionBlock = actionsCode.slice(actionsCode.indexOf("export async function generateArticleVisualAction"));
		expect(actionBlock).toMatch(/return result;/);
		expect(actionBlock).not.toMatch(/b64_json|base64|bytes/i);
	});
});

describe("empty state preserved and status transitions untouched (39, 40)", () => {
	it("39. the existing empty-state copy is unchanged and still shown alongside the Generate visual control", () => {
		expect(listCode).toContain("No visual candidates yet.");
	});

	it("40. no publish/status-transition call anywhere in the generation path", () => {
		const generateFn = listCode.slice(listCode.indexOf("function runGenerate"), listCode.indexOf("function runGenerate") + 800);
		expect(generateFn).not.toMatch(/setArticleStatusAction|transitionArticleStatus/);
	});
});


/**
 * Regression coverage for the desktop scroll/responsiveness bug found
 * during the first live end-to-end visual generation test: a
 * pending_review candidate's preview image (real OpenAI intrinsic
 * size, up to ~1600x896px) and its pending-only "Approve visual"
 * button (`white-space: nowrap` via the shared `.btn` class) drove up
 * `.card`'s CSS Grid "automatic minimum size" (`min-width: auto`
 * resolving to the descendants' min-content contribution), which
 * propagated up through `.grid` -> `.panel` -> `.admin-main` and
 * effectively locked out normal desktop scrolling until the viewport
 * was narrowed enough (via DevTools) to force a reflow.
 *
 * Fix is CSS-only, confined to ArticleVisualReviewPanel.module.css:
 *  - `.card` gets an explicit `min-width: 0` so it can shrink below
 *    its descendants' content-driven minimum instead of forcing the
 *    grid track (and everything above it) wider than the viewport.
 *  - `.preview` gets an explicit `max-width: 100%; min-width: 0;
 *    display: block;` alongside its existing `width: 100%` --
 *    reinforcing, locally and explicitly, the safe responsive-image
 *    contract the task requires, on top of the sitewide
 *    `img, svg { max-width: 100% }` rule in globals.css.
 *  - `.grid`'s track sizing changes from a bare
 *    `minmax(240px, 1fr)` to the "safe minmax" pattern
 *    `minmax(min(240px, 100%), 1fr)`, so the track's own literal
 *    minimum can never itself force horizontal overflow on a
 *    viewport narrower than 240px plus padding/gaps.
 *
 * No JSX/markup change was needed or made -- ArticleVisualReviewList.tsx
 * is unchanged by this fix, confirmed by diffing it against the
 * versions already exercised by every describe block above.
 */
describe("desktop scroll/responsiveness regression (visual review CSS module)", () => {
	it("41. the preview image has a complete responsive sizing contract (width, max-width and min-width all constrained, plus display:block so it never behaves as inline content)", () => {
		const previewBlock = panelCss.slice(panelCss.indexOf(".preview {"), panelCss.indexOf(".preview {") + 400);
		expect(previewBlock).toMatch(/width:\s*100%/);
		expect(previewBlock).toMatch(/max-width:\s*100%/);
		expect(previewBlock).toMatch(/min-width:\s*0/);
		expect(previewBlock).toMatch(/display:\s*block/);
		// The intrinsic-height contract stays the modern aspect-ratio +
		// object-fit approach -- not reverted to height:auto.
		expect(previewBlock).toMatch(/aspect-ratio:\s*16\s*\/\s*9/);
		expect(previewBlock).toMatch(/object-fit:\s*cover/);
	});

	it("42. the candidate card can shrink below its content's natural min-content size (min-width: 0 overrides the CSS Grid automatic-minimum-size default)", () => {
		const cardBlock = panelCss.slice(panelCss.indexOf(".card {"), panelCss.indexOf(".card {") + 300);
		expect(cardBlock).toMatch(/min-width:\s*0/);
	});

	it("43. the grid track's own minimum can never force horizontal overflow on a narrow viewport (safe minmax pattern, not a bare pixel minimum)", () => {
		expect(panelCss).toMatch(/grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(240px,\s*100%\),\s*1fr\)\)/);
		// The old, unsafe bare-pixel-minimum form must be gone.
		expect(panelCss).not.toMatch(/minmax\(240px,\s*1fr\)/);
	});

	it("44. no fixed/fullscreen/scroll-lock style exists anywhere in the visual review CSS module", () => {
		expect(panelCss).not.toMatch(/position:\s*fixed/);
		expect(panelCss).not.toMatch(/position:\s*sticky/);
		expect(panelCss).not.toMatch(/100vh|100dvh|100vw/);
	});

	it("45. pending candidate rendering does not introduce a separate scroll container (no overflow/overflow-y/overflow-x declared anywhere in this module)", () => {
		expect(panelCss).not.toMatch(/overflow(-x|-y)?\s*:/);
	});

	it("46. the visual review panel never sets body/document overflow or height (no `body` or `html` selector appears in this module at all)", () => {
		expect(panelCss).not.toMatch(/\bbody\b/);
		expect(panelCss).not.toMatch(/\bhtml\b/);
	});

	it("47. existing approved/pending/superseded status markup is unchanged by the fix (all three data-status badge variants still present)", () => {
		expect(panelCss).toMatch(/\.statusBadge\[data-status="approved"\]/);
		expect(panelCss).toMatch(/\.statusBadge\[data-status="pending_review"\]/);
		expect(panelCss).toMatch(/\.statusBadge\[data-status="superseded"\]/);
		expect(listCode).toMatch(/data-status=\{candidate\.status\}/);
	});

	it("48. Generate visual and Approve visual controls are structurally unchanged by the fix (still present, still wired to the same handlers)", () => {
		expect(listCode).toMatch(/onClick=\{runGenerate\}/);
		expect(listCode).toMatch(/onClick=\{\(\) => handleApproveClick\(candidate\)\}/);
		expect(listCode).toMatch(/onClick=\{\(\) => runApprove\(candidate\)\}/);
	});
});
