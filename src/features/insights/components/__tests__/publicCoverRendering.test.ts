import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Phase 3C.4B.8A — production-readiness audit closes one real coverage
 * gap: nothing previously proved that PUBLIC article rendering reads
 * the article's own `coverImageUrl`/`coverImageAlt` fields (populated
 * by `src/features/insights/data/mappers.ts` from
 * `insights_articles.cover_image_url`/`cover_image_alt`), rather than
 * querying `article_visuals` (the admin-only candidate history table)
 * on every public render.
 *
 * Structural source-text assertions, same technique already used
 * throughout this codebase's visual-workflow tests (no
 * `@testing-library/react` / `@vitejs/plugin-react` in this project's
 * Vitest setup, and its `include` glob excludes `.tsx` anyway).
 */

const HERO_PATH = resolve(process.cwd(), "src/features/insights/components/ArticleHero.tsx");
const heroSource = readFileSync(HERO_PATH, "utf8");
const heroCode = heroSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const CARD_PATH = resolve(process.cwd(), "src/features/insights/components/ArticleCard.tsx");
const cardSource = readFileSync(CARD_PATH, "utf8");
const cardCode = cardSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("ArticleHero renders the article's own cover fields", () => {
	it("renders the cover image from article.coverImageUrl", () => {
		expect(heroCode).toMatch(/article\.coverImageUrl\s*\?/);
		expect(heroCode).toMatch(/src=\{article\.coverImageUrl\}/);
	});

	it("renders the alt text from article.coverImageAlt", () => {
		expect(heroCode).toMatch(/alt=\{article\.coverImageAlt/);
	});

	it("never imports or references article_visuals or the admin-only visual query/deletion/review modules", () => {
		expect(heroCode).not.toMatch(/article_visuals|listArticleVisuals|articleVisualReviewService|articleVisualDeletionService|articleVisualQueries/);
	});

	it("never imports a Supabase client directly (public rendering reads only the already-mapped Article prop)", () => {
		expect(heroCode).not.toMatch(/createSupabase(Server|Browser|Privileged)?Client|@supabase\/supabase-js/);
	});
});

describe("ArticleCard renders the article's own cover fields", () => {
	it("renders the cover image from article.coverImageUrl, with an explicit fallback when absent (never a broken/empty <img>)", () => {
		expect(cardCode).toMatch(/article\.coverImageUrl\s*\?/);
		expect(cardCode).toMatch(/src=\{article\.coverImageUrl\}/);
		expect(cardCode).toMatch(/coverFallback/);
	});

	it("renders the alt text from article.coverImageAlt", () => {
		expect(cardCode).toMatch(/alt=\{article\.coverImageAlt/);
	});

	it("never imports or references article_visuals or the admin-only visual query/deletion/review modules", () => {
		expect(cardCode).not.toMatch(/article_visuals|listArticleVisuals|articleVisualReviewService|articleVisualDeletionService|articleVisualQueries/);
	});

	it("never imports a Supabase client directly (public rendering reads only the already-mapped ArticleSummary prop)", () => {
		expect(cardCode).not.toMatch(/createSupabase(Server|Browser|Privileged)?Client|@supabase\/supabase-js/);
	});
});

describe("mappers.ts is the single source translating DB columns to the public Article/ArticleSummary cover fields", () => {
	const MAPPERS_PATH = resolve(process.cwd(), "src/features/insights/data/mappers.ts");
	const mappersSource = readFileSync(MAPPERS_PATH, "utf8");
	const mappersCode = mappersSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

	it("maps coverImageUrl/coverImageAlt directly from insights_articles' own cover_image_url/cover_image_alt columns", () => {
		expect(mappersCode).toMatch(/coverImageUrl:\s*raw\.cover_image_url/);
		expect(mappersCode).toMatch(/coverImageAlt:\s*raw\.cover_image_alt/);
	});

	it("never references article_visuals -- the public read path has no per-render candidate-table query to derive the cover from", () => {
		expect(mappersCode).not.toMatch(/article_visuals/);
	});
});

describe("no public (non-admin) route queries article_visuals", () => {
	it("the public insights data-query module never imports or references article_visuals/listArticleVisuals", () => {
		const QUERIES_PATH = resolve(process.cwd(), "src/features/insights/data/queries.ts");
		const queriesSource = readFileSync(QUERIES_PATH, "utf8");
		const queriesCode = queriesSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

		expect(queriesCode).not.toMatch(/article_visuals|listArticleVisuals/);
	});
});
