import type { Locale } from "@/lib/routes";
import { searchPath } from "../seo/paths";
import styles from "./SearchForm.module.css";

const COPY: Record<Locale, { placeholder: string; button: string }> = {
	en: { placeholder: "Search Insights…", button: "Search" },
	pl: { placeholder: "Szukaj w Wiedzy…", button: "Szukaj" },
};

/**
 * Plain GET form — navigates to the search results page with `?q=`, no
 * client-side JavaScript required (docs/INSIGHTS_ARCHITECTURE.md §8
 * "use animation sparingly" / editorial-calm design direction extends to
 * not reaching for a client component where a native form does the job).
 */
export function SearchForm({ locale, defaultValue }: { locale: Locale; defaultValue?: string }) {
	const t = COPY[locale];
	return (
		<form action={searchPath(locale)} method="GET" className={styles.form} role="search">
			<input
				type="search"
				name="q"
				defaultValue={defaultValue}
				placeholder={t.placeholder}
				className={styles.input}
				aria-label={t.placeholder}
			/>
			<button type="submit" className={styles.button}>
				{t.button}
			</button>
		</form>
	);
}
