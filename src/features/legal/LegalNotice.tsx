import type { Locale } from "@/lib/routes";

const COPY = {
	en: {
		label: "About this document:",
		text: "This document reflects the current operation of Code Consulting Studio and its website. CCS actively develops its services and technology, so this information may be updated when our functionality, providers, business arrangements or applicable legal requirements change.",
	},

	pl: {
		label: "O tym dokumencie:",
		text: "Dokument opisuje aktualny sposób działania Code Consulting Studio i jego strony internetowej. CCS aktywnie rozwija swoje usługi i technologie, dlatego informacje te mogą być aktualizowane wraz ze zmianami funkcjonalności, dostawców, zasad działalności lub obowiązujących wymagań prawnych.",
	},
};

export function LegalNotice({ locale }: { locale: Locale }) {
	const t = COPY[locale];

	return (
		<div
			className="prose-toc"
			role="note"
			style={{
				borderColor: "rgba(251,191,36,.35)",
				background: "rgba(251,191,36,.06)",
			}}
		>
			<p
				style={{
					fontSize: 12.5,
					color: "var(--ink-2)",
					lineHeight: 1.6,
					margin: 0,
				}}
			>
				<strong>{t.label}</strong> {t.text}
			</p>
		</div>
	);
}
