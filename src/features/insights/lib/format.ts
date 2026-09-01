import type { Locale } from "@/lib/routes";

export function formatArticleDate(locale: Locale, iso: string | null): string {
	if (!iso) return "";
	return new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-GB", {
		year: "numeric",
		month: "long",
		day: "numeric",
	}).format(new Date(iso));
}

const READING_TIME_LABEL: Record<Locale, (minutes: number) => string> = {
	en: (minutes) => `${minutes} min read`,
	pl: (minutes) => `${minutes} min czytania`,
};

export function formatReadingTime(locale: Locale, minutes: number | null): string | null {
	if (!minutes) return null;
	return READING_TIME_LABEL[locale](minutes);
}
