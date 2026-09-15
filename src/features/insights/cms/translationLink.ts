export type TranslationLinkCandidate = { id: string; translationOf: string | null };

// Checks both directions for the Article Visual UI.
export function hasLinkedTranslation(
	articleId: string,
	translationOf: string | null,
	allArticles: TranslationLinkCandidate[],
): boolean {
	return Boolean(translationOf) || allArticles.some((candidate) => candidate.translationOf === articleId);
}
