"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { routeFor, type Locale, type RouteKey } from "@/lib/routes";
import { HoldNavLink } from "./HoldNavLink";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

type NavItem = { key: RouteKey; label: { en: string; pl: string }; badge?: string };

export function MobileMenu({
  open,
  onClose,
  locale,
  items,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  items: NavItem[];
  pathname: string;
}) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="mobile-menu-head">
        <span className="brand">
          <Image
            src="/brand/ccs-logo-mark.png"
            alt="CCS"
            width={1200}
            height={675}
            className="brand-logo"
          />
        </span>
        {/* Below the 1180px breakpoint this overlay is the ONLY way to reach
            the header - it's position:fixed above everything, including
            header.site (z-index 100 vs its own 2200) - so without its own
            ThemeToggle there was no way to change theme once the nav
            collapsed to the hamburger. */}
        <div className="mobile-menu-head-actions">
          <ThemeToggle />
          <Link
            href="/admin/login"
            className="admin-access-btn"
            aria-label="Admin"
            title="Admin"
            onClick={onClose}
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
          <button className="menu-btn" type="button" aria-label="Close menu" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>
      <nav className="mobile-menu-nav" aria-label="Primary">
        {items.map((item) => {
          const href = routeFor(item.key, locale);
          return (
            <Link key={item.key} href={href} onClick={onClose} className={pathname === href ? "active" : undefined}>
              {item.label[locale]}
              {item.badge ? <span className="badge-new">{item.badge}</span> : null}
            </Link>
          );
        })}
      </nav>
      <HoldNavLink href={routeFor("contact", locale)} className="btn btn-primary" onClick={onClose}>
        {locale === "en" ? "Contact us" : "Kontakt"}
      </HoldNavLink>
    </div>
  );
}
