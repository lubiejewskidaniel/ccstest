/** Converts a generated title into a slug matching the exact pattern the
 * CMS's `slugSchema` requires (`src/features/insights/cms/schema.ts`) —
 * lowercase letters, digits, and hyphens only, no leading/trailing
 * hyphen. Diacritics are stripped via Unicode normalization so a Polish
 * title with ą/ć/ę/etc. still produces a valid ASCII slug. */
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
