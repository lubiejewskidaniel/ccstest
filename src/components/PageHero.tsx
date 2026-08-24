import type { ReactNode } from "react";

/**
 * Shared inner-page header for every hub and legal page - the same
 * eyebrow/H1/lede rhythm as the homepage hero, without the full brand
 * animation.
 */
export function PageHero({
	eyebrow,
	title,
	lede,
	actions,
}: {
	eyebrow: string;
	title: string;
	lede?: string;
	actions?: ReactNode;
}) {
	return (
		<section className="page-hero">
			<div className="wrap page-hero-inner">
				<span className="eyebrow">{eyebrow}</span>
				<h1>{title}</h1>
				{lede ? <p className="lede">{lede}</p> : null}
				{actions ? <div className="hero-actions">{actions}</div> : null}
			</div>
		</section>
	);
}
