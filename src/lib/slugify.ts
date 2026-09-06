/** Converts a title into a URL/id-safe slug — lowercase letters, digits,
 * and hyphens only, no leading/trailing hyphen. Diacritics are stripped
 * via Unicode normalization so a Polish title with ą/ć/ę/etc. still
 * produces a valid ASCII slug.
 *
 * Shared by the Insights CMS (article slugs, heading ids —
 * `src/features/insights/types/blocks.ts`) and the AI editorial pipeline
 * (`src/features/content-intelligence/generation/generate.ts`,
 * `localisation/localise.ts`) — moved here from content-intelligence so
 * `features/insights` doesn't have to import from
 * `features/content-intelligence` to reuse it (content-intelligence
 * depends on insights' CMS write path, not the other way around). */
export function slugify(title: string): string {
	return title
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 160);
}
