import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildShareUrl, copyTextToClipboard } from "../ArticleShare";

/**
 * Coverage for the premium article-sharing section.
 *
 * `buildShareUrl`/`copyTextToClipboard` are plain functions operating on
 * `navigator`/`document`/`window` -- both directly testable with real
 * calls under this project's jsdom environment, no rendering needed.
 * The component's own JSX wiring (which cannot be exercised without
 * `@testing-library/react`, absent from this project's Vitest setup --
 * see vitest.config.ts) is proven structurally against the real,
 * unmodified source text, the same technique already used throughout
 * this codebase (see publicCoverRendering.test.ts).
 */

const SOURCE_PATH = resolve(process.cwd(), "src/features/insights/components/ArticleShare.tsx");
const source = readFileSync(SOURCE_PATH, "utf8");
const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const PAGE_PATH = resolve(process.cwd(), "src/features/insights/article/ArticlePage.tsx");
const pageSource = readFileSync(PAGE_PATH, "utf8");
const pageCode = pageSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const PAGE_CSS_PATH = resolve(process.cwd(), "src/features/insights/article/ArticlePage.module.css");
const pageCss = readFileSync(PAGE_CSS_PATH, "utf8");

const ARTICLE_URL = "https://codeconsultingstudio.com/insights/how-we-cut-build-times-in-half";

describe("buildShareUrl", () => {
	it("builds the LinkedIn share-offsite intent with the encoded article URL", () => {
		expect(buildShareUrl("linkedin", ARTICLE_URL)).toBe(
			`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(ARTICLE_URL)}`,
		);
	});

	it("builds the Facebook sharer intent with the encoded article URL", () => {
		expect(buildShareUrl("facebook", ARTICLE_URL)).toBe(
			`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(ARTICLE_URL)}`,
		);
	});

	it("builds the X (twitter.com) intent with the encoded article URL", () => {
		expect(buildShareUrl("x", ARTICLE_URL)).toBe(`https://twitter.com/intent/tweet?url=${encodeURIComponent(ARTICLE_URL)}`);
	});

	it("encodes query characters so they cannot break out of the share URL", () => {
		const trickyUrl = "https://codeconsultingstudio.com/insights/example?ref=email&x=1";
		const built = buildShareUrl("linkedin", trickyUrl);
		expect(built).toContain(encodeURIComponent(trickyUrl));
		expect(built.indexOf("?")).toBe(built.lastIndexOf("?")); // no second, unencoded "?" leaked through
	});

	it("gives each platform a distinct target for the same article URL", () => {
		const targets = new Set([
			buildShareUrl("linkedin", ARTICLE_URL),
			buildShareUrl("facebook", ARTICLE_URL),
			buildShareUrl("x", ARTICLE_URL),
		]);
		expect(targets.size).toBe(3);
	});

	it("a different article URL produces a different share URL for the same platform", () => {
		const other = "https://codeconsultingstudio.com/insights/a-different-article";
		expect(buildShareUrl("linkedin", ARTICLE_URL)).not.toBe(buildShareUrl("linkedin", other));
	});
});

describe("copyTextToClipboard", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		Reflect.deleteProperty(navigator, "clipboard");
		vi.restoreAllMocks();
	});

	function stubClipboard(writeText: (text: string) => Promise<void>) {
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText },
			configurable: true,
		});
	}

	it("copies via navigator.clipboard.writeText when available in a secure context", async () => {
		vi.stubGlobal("isSecureContext", true);
		const writeText = vi.fn().mockResolvedValue(undefined);
		stubClipboard(writeText);

		const result = await copyTextToClipboard("https://example.com/article");

		expect(result).toBe(true);
		expect(writeText).toHaveBeenCalledWith("https://example.com/article");
	});

	it("falls back to execCommand when the Clipboard API is unavailable (not a secure context)", async () => {
		vi.stubGlobal("isSecureContext", false);
		const execCommand = vi.fn().mockReturnValue(true);
		document.execCommand = execCommand as unknown as typeof document.execCommand;

		const result = await copyTextToClipboard("https://example.com/article");

		expect(result).toBe(true);
		expect(execCommand).toHaveBeenCalledWith("copy");
	});

	it("falls back to execCommand when navigator.clipboard.writeText rejects", async () => {
		vi.stubGlobal("isSecureContext", true);
		stubClipboard(vi.fn().mockRejectedValue(new Error("denied")));
		const execCommand = vi.fn().mockReturnValue(true);
		document.execCommand = execCommand as unknown as typeof document.execCommand;

		const result = await copyTextToClipboard("https://example.com/article");

		expect(result).toBe(true);
		expect(execCommand).toHaveBeenCalledWith("copy");
	});

	it("returns false, and never throws, when both the Clipboard API and the fallback fail", async () => {
		vi.stubGlobal("isSecureContext", false);
		document.execCommand = vi.fn().mockReturnValue(false) as unknown as typeof document.execCommand;

		await expect(copyTextToClipboard("https://example.com/article")).resolves.toBe(false);
	});

	it("removes the temporary fallback textarea from the DOM regardless of outcome", async () => {
		vi.stubGlobal("isSecureContext", false);
		document.execCommand = vi.fn().mockReturnValue(true) as unknown as typeof document.execCommand;

		await copyTextToClipboard("https://example.com/article");

		expect(document.querySelector("textarea")).toBeNull();
	});

	it("removes the temporary fallback textarea even when execCommand throws", async () => {
		vi.stubGlobal("isSecureContext", false);
		document.execCommand = vi.fn().mockImplementation(() => {
			throw new Error("not supported");
		}) as unknown as typeof document.execCommand;

		await expect(copyTextToClipboard("https://example.com/article")).resolves.toBe(false);
		expect(document.querySelector("textarea")).toBeNull();
	});
});

describe("ArticleShare.tsx structural boundaries", () => {
	it("renders natural, non-machine-translated EN and PL heading/platform/copy-state copy exactly as specified", () => {
		expect(codeOnly).toMatch(/heading:\s*"Share this insight"/);
		expect(codeOnly).toMatch(/copy:\s*"Copy link"/);
		expect(codeOnly).toMatch(/copied:\s*"Copied"/);

		expect(codeOnly).toMatch(/heading:\s*"Udostępnij artykuł"/);
		expect(codeOnly).toMatch(/copy:\s*"Kopiuj link"/);
		expect(codeOnly).toMatch(/copied:\s*"Skopiowano"/);
	});

	it("no longer renders the removed explanatory lede/body copy (refined to a compact utility)", () => {
		expect(codeOnly).not.toMatch(/Found this useful/);
		expect(codeOnly).not.toMatch(/Share it with someone who might find it valuable/);
		expect(codeOnly).not.toMatch(/Warto było przeczytać/);
		expect(codeOnly).not.toMatch(/Podziel się nim z kimś/);
		expect(codeOnly).not.toMatch(/\blede\b/);
	});

	it("renders the share label between two divider lines, as a compact separator rather than a card", () => {
		expect(codeOnly).toMatch(/styles\.dividerLine/);
		expect(codeOnly).toMatch(/styles\.label/);
		expect(codeOnly).toMatch(/id="article-share-heading"/);
	});

	it("every share action uses the url prop -- never a hardcoded article URL", () => {
		expect(codeOnly).toMatch(/buildShareUrl\("linkedin",\s*url\)/);
		expect(codeOnly).toMatch(/buildShareUrl\("facebook",\s*url\)/);
		expect(codeOnly).toMatch(/buildShareUrl\("x",\s*url\)/);
		expect(codeOnly).toMatch(/copyTextToClipboard\(url\)/);
		expect(codeOnly).not.toMatch(/https:\/\/(www\.)?codeconsultingstudio\.com/i);
	});

	it("external share links open safely in a new context (target=_blank, rel=noopener noreferrer)", () => {
		const externalLinkBlocks = codeOnly.match(/<a\s+href=\{buildShareUrl[\s\S]*?\/>/g) ?? [];
		expect(externalLinkBlocks.length).toBe(3);
		for (const block of externalLinkBlocks) {
			expect(block).toMatch(/target="_blank"/);
			expect(block).toMatch(/rel="noopener noreferrer"/);
		}
	});

	it("fires the article_share analytics event for every channel, using the existing events taxonomy", () => {
		expect(codeOnly).toMatch(/track\("linkedin"\)/);
		expect(codeOnly).toMatch(/track\("facebook"\)/);
		expect(codeOnly).toMatch(/track\("x"\)/);
		expect(codeOnly).toMatch(/track\("copy"\)/);
		// One single dispatch point for every channel -- not a separate
		// events.articleShare(...) call duplicated per platform.
		const dispatchCalls = codeOnly.match(/events\.articleShare\(/g) ?? [];
		expect(dispatchCalls).toHaveLength(1);
		expect(codeOnly).toMatch(/events\.articleShare\(slug,\s*channel,\s*getBaseContext\(pathname\)\)/);
	});

	it("never uses alert() for the copy interaction", () => {
		expect(codeOnly).not.toMatch(/\balert\(/);
	});

	it("the copy button announces its label change to assistive tech (aria-live)", () => {
		const copyButtonBlock = codeOnly.match(/<button[\s\S]*?<\/button>/)?.[0] ?? "";
		expect(copyButtonBlock).toMatch(/aria-live="polite"/);
	});

	it("icons are decorative only -- visible text is always present as the accessible name", () => {
		// Every icon is aria-hidden, and every action still renders its
		// copy.* label as visible text alongside the icon.
		const svgCount = (codeOnly.match(/aria-hidden="true"/g) ?? []).length;
		expect(svgCount).toBeGreaterThanOrEqual(4);
		expect(codeOnly).toMatch(/\{copy\.linkedin\}/);
		expect(codeOnly).toMatch(/\{copy\.facebook\}/);
		expect(codeOnly).toMatch(/\{copy\.x\}/);
		expect(codeOnly).toMatch(/copy\.copied\s*:\s*copy\.copy/);
	});

	it("does not import any third-party sharing SDK, package, or API-key-shaped env var", () => {
		expect(codeOnly).not.toMatch(/react-share|sharethis|addthis|social-share/i);
		expect(codeOnly).not.toMatch(/process\.env\./);
	});

	it("never modifies article content, SEO metadata, or the publication pipeline", () => {
		expect(codeOnly).not.toMatch(/BlockRenderer|generateMetadata|transitionArticleStatus|insights_articles/);
	});

	it("the copied label resets after the documented ~2 second window", () => {
		expect(codeOnly).toMatch(/COPIED_LABEL_DURATION_MS\s*=\s*2000/);
	});
});

describe("ArticlePage.tsx wiring", () => {
	it("renders ArticleShare between the article content and the existing CTA section, using the shared canonical URL helper", () => {
		const shareIndex = pageCode.indexOf("<ArticleShare");
		const ctaIndex = pageCode.indexOf("styles.cta");
		const gridCloseIndex = pageCode.lastIndexOf("</div>", shareIndex);

		expect(shareIndex).toBeGreaterThan(-1);
		expect(ctaIndex).toBeGreaterThan(-1);
		expect(gridCloseIndex).toBeGreaterThan(-1);
		expect(gridCloseIndex).toBeLessThan(shareIndex);
		expect(shareIndex).toBeLessThan(ctaIndex);

		expect(pageCode).toMatch(/articleUrl\(article\.slug,\s*locale\)/);
	});

	it("passes the article's own slug and locale through to ArticleShare, never a hardcoded value", () => {
		const shareTag = pageCode.match(/<ArticleShare[\s\S]*?\/>/)?.[0] ?? "";
		expect(shareTag).toMatch(/slug=\{article\.slug\}/);
		expect(shareTag).toMatch(/locale=\{locale\}/);
		expect(shareTag).toMatch(/url=\{articleUrl\(article\.slug,\s*locale\)\}/);
	});

	it("does not duplicate article rendering for EN vs PL -- one shared ArticlePage still owns both", () => {
		expect(pageCode).toMatch(/export function ArticlePage/);
	});
});

describe("ArticlePage.module.css layout (reading column centring)", () => {
	it("keeps the existing 900px two-column arrangement (TOC width, gap) completely unchanged", () => {
		expect(pageCss).toMatch(/@media \(min-width: 900px\) \{\s*\.grid \{\s*grid-template-columns: minmax\(0, 1fr\) 220px;/);
	});

	it("gives the reading column its own centred axis at the wide-desktop tier, reusing the existing --insights-content-width token rather than a new ad-hoc value", () => {
		const wideBlock = pageCss.match(/@media \(min-width: 1440px\) \{[\s\S]*?\n\}/)?.[0] ?? "";
		expect(wideBlock).toMatch(/max-width: var\(--insights-content-width, 780px\)/);
	});

	it("detaches the TOC into an absolutely positioned margin column at the wide-desktop tier, so it cannot affect the content column's own centring", () => {
		const wideBlock = pageCss.match(/@media \(min-width: 1440px\) \{[\s\S]*?\n\}/)?.[0] ?? "";
		expect(wideBlock).toMatch(/\.sidebar \{[\s\S]*?position: absolute;/);
	});

	it("the TOC's own sticky behaviour is untouched", () => {
		expect(pageCss).toMatch(/\.sidebarSticky \{\s*position: sticky;/);
	});
});
