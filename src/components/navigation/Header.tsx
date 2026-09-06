"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { routeFor, type Locale } from "@/lib/routes";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LanguageSwitch } from "./LanguageSwitch";
import { MobileMenu } from "./MobileMenu";
import { HoldNavLink } from "./HoldNavLink";

const NAV_ITEMS: {
	key: Parameters<typeof routeFor>[0];
	label: { en: string; pl: string };
	badge?: string;
}[] = [
	{ key: "services", label: { en: "Services", pl: "Usługi" } },
	{ key: "work", label: { en: "Work", pl: "Realizacje" } },
	{ key: "products", label: { en: "Products", pl: "Produkty" } },
	{ key: "growth", label: { en: "Growth", pl: "Marketing" }, badge: "NEW" },
	{ key: "mentoring", label: { en: "Mentoring", pl: "Mentoring" } },
	{ key: "insights", label: { en: "Insights", pl: "Wiedza" } },
	{ key: "about", label: { en: "About", pl: "O nas" } },
];

export function Header({ locale }: { locale: Locale }) {
	const pathname = usePathname();
	const [menuOpen, setMenuOpen] = useState(false);

	return (
		<header className="site" id="siteHeader">
			<div className="wrap site-inner">
				<Link href={routeFor("home", locale)} className="brand">
					<Image
						src="/brand/ccs-logo-mark.png"
						alt="CCS"
						loading="eager"
						width={1200}
						height={675}
						priority
						className="brand-logo"
					/>
					<span className="brand-word">
						CODE CONSULTING
						<b>STUDIO</b>
					</span>
				</Link>

				<nav className="primary" aria-label="Primary">
					{NAV_ITEMS.map((item) => {
						const href = routeFor(item.key, locale);
						const isActive = pathname === href;
						return (
							<Link
								key={item.key}
								href={href}
								className={isActive ? "active" : undefined}
							>
								{item.label[locale]}
								{item.badge ? (
									<span className="badge-new">{item.badge}</span>
								) : null}
							</Link>
						);
					})}
				</nav>

				<div className="head-actions">
					<LanguageSwitch locale={locale} />
					<ThemeToggle />
					<Link
						href="/admin/login"
						className="admin-access-btn"
						aria-label="Admin"
						title="Admin"
					>
						<svg
							viewBox="0 0 24 24"
							width="16"
							height="16"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.8"
						>
							<path d="M12 3l7 4v5c0 4.5-3 8.5-7 9-4-.5-7-4.5-7-9V7l7-4Z" />
							<circle cx="12" cy="10.3" r="1.6" />
							<path d="M8.6 15c.7-1.6 1.9-2.4 3.4-2.4s2.7.8 3.4 2.4" />
						</svg>
					</Link>
					<HoldNavLink
						href={routeFor("contact", locale)}
						className="btn btn-header"
					>
						{locale === "en" ? "Contact us" : "Kontakt"}
					</HoldNavLink>
					<button
						className="menu-btn"
						type="button"
						aria-label="Open menu"
						aria-expanded={menuOpen}
						onClick={() => setMenuOpen(true)}
					>
						<svg
							viewBox="0 0 24 24"
							width="18"
							height="18"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.8"
						>
							<path d="M4 6h16M4 12h16M4 18h16" />
						</svg>
					</button>
				</div>
			</div>

			<MobileMenu
				open={menuOpen}
				onClose={() => setMenuOpen(false)}
				locale={locale}
				items={NAV_ITEMS}
				pathname={pathname}
			/>
		</header>
	);
}
