import { describe, it, expect } from "vitest";
import { hasLinkedTranslation } from "../translationLink";

const ARTICLE_ID = "article-1";
const OTHER_ID = "article-2";
const UNRELATED_ID = "article-3";

describe("hasLinkedTranslation", () => {
	it("is true when this article points at its translation", () => {
		expect(hasLinkedTranslation(ARTICLE_ID, OTHER_ID, [])).toBe(true);
	});

	it("is true when another article points back at this one", () => {
		const allArticles = [{ id: OTHER_ID, translationOf: ARTICLE_ID }];

		expect(hasLinkedTranslation(ARTICLE_ID, null, allArticles)).toBe(true);
	});

	it("is false when there is no relationship in either direction", () => {
		const allArticles = [{ id: UNRELATED_ID, translationOf: null }];

		expect(hasLinkedTranslation(ARTICLE_ID, null, allArticles)).toBe(false);
	});

	it("is false when other articles link to a different article, not this one", () => {
		const allArticles = [{ id: OTHER_ID, translationOf: UNRELATED_ID }];

		expect(hasLinkedTranslation(ARTICLE_ID, null, allArticles)).toBe(false);
	});
});
