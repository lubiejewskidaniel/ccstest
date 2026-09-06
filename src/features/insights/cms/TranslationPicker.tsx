"use client";

import { useMemo, useState } from "react";
import type { Locale } from "@/lib/routes";
import styles from "./TranslationPicker.module.css";

export type TranslationCandidate = { id: string; title: string; slug: string; locale: Locale };

const OPPOSITE: Record<Locale, Locale> = { en: "pl", pl: "en" };
const LOCALE_LABEL: Record<Locale, string> = { en: "English", pl: "Polish" };

/**
 * Replaces the raw "paste the other article's UUID" field with a
 * search-by-title picker. Still just resolves to the same
 * `translationOf` article id underneath — submitted via the same hidden
 * form field the Server Action already reads, so `cms/schema.ts` and the
 * `translation_of` column/relationship are completely unchanged.
 */
export function TranslationPicker({
	candidates,
	locale,
	excludeId,
	value,
	onChange,
}: {
	candidates: TranslationCandidate[];
	locale: Locale;
	excludeId?: string;
	value: string | null;
	onChange: (id: string | null) => void;
}) {
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);

	const oppositeLocale = OPPOSITE[locale];

	const linked = useMemo(() => candidates.find((c) => c.id === value) ?? null, [candidates, value]);

	const results = useMemo(() => {
		const pool = candidates.filter((c) => c.locale === oppositeLocale && c.id !== excludeId);
		const q = query.trim().toLowerCase();
		if (!q) return pool.slice(0, 20);
		return pool.filter((c) => c.title.toLowerCase().includes(q)).slice(0, 20);
	}, [candidates, oppositeLocale, excludeId, query]);

	return (
		<div className={styles.root}>
			<input type="hidden" name="translationOf" value={value ?? ""} />

			{linked ? (
				<div className={styles.linked}>
					<span className={styles.linkedLabel}>Linked to</span>
					<span className={styles.linkedTitle}>{linked.title}</span>
					<span className={styles.linkedLocale}>{LOCALE_LABEL[linked.locale]}</span>
					<button type="button" className={styles.unlink} onClick={() => onChange(null)}>
						Unlink
					</button>
				</div>
			) : (
				<div className={styles.searchWrap}>
					<input
						type="text"
						className={styles.search}
						placeholder={`Search ${LOCALE_LABEL[oppositeLocale]} articles by title…`}
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setOpen(true);
						}}
						onFocus={() => setOpen(true)}
						onBlur={() => setTimeout(() => setOpen(false), 150)}
					/>
					{open ? (
						<div className={styles.results} role="listbox">
							{results.length === 0 ? (
								<div className={styles.empty}>
									No {LOCALE_LABEL[oppositeLocale]} articles {query ? "match that title" : "exist yet"}.
								</div>
							) : (
								results.map((candidate) => (
									<button
										key={candidate.id}
										type="button"
										className={styles.result}
										onMouseDown={(e) => e.preventDefault()}
										onClick={() => {
											onChange(candidate.id);
											setQuery("");
											setOpen(false);
										}}
									>
										{candidate.title}
									</button>
								))
							)}
						</div>
					) : null}
				</div>
			)}
			<p className={styles.hint}>
				Only {LOCALE_LABEL[oppositeLocale]} articles are shown — a translation always links to the opposite
				language.
			</p>
		</div>
	);
}
