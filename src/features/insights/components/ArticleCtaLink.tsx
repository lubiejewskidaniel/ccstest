"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { events, getBaseContext } from "@/lib/analytics";

/**
 * Wraps a normal `<Link>` with an `article_cta_click` fire-before-navigate
 * (master instruction Checkpoint 5 "CTA tracking"). A thin client
 * boundary around an otherwise-plain link, kept separate from
 * `ArticlePage` (a Server Component) so only this one small piece needs
 * to ship client JS.
 */
export function ArticleCtaLink({
	href,
	slug,
	ctaLocation,
	className,
	children,
}: {
	href: string;
	slug: string;
	ctaLocation: string;
	className?: string;
	children: ReactNode;
}) {
	const pathname = usePathname();

	return (
		<Link
			href={href}
			className={className}
			onClick={() => events.articleCtaClick(slug, ctaLocation, getBaseContext(pathname))}
		>
			{children}
		</Link>
	);
}
