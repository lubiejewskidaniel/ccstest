"use client";

import { useEffect, useState } from "react";

type BackToTopProps = {
	locale?: "en" | "pl";
};

export function BackToTop({ locale = "en" }: BackToTopProps) {
	const [visible, setVisible] = useState(false);
	const [active, setActive] = useState(false);

	useEffect(() => {
		const handleScroll = () => {
			setVisible(window.scrollY > 420);
		};

		handleScroll();

		window.addEventListener("scroll", handleScroll, { passive: true });

		return () => {
			window.removeEventListener("scroll", handleScroll);
		};
	}, []);

	const handleClick = () => {
		setActive(true);

		window.scrollTo({
			top: 0,
			behavior: "smooth",
		});

		window.setTimeout(() => {
			setActive(false);
		}, 420);
	};

	const label = locale === "pl" ? "Wróć na górę" : "Back to top";

	return (
		<button
			className={["to-top", visible ? "show" : "", active ? "is-active" : ""]
				.filter(Boolean)
				.join(" ")}
			type="button"
			aria-label={label}
			onClick={handleClick}
		>
			<span className="to-top__surface" aria-hidden="true">
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M12 19V5" />
					<path d="M5.5 11.5 12 5l6.5 6.5" />
				</svg>
			</span>

			<span className="to-top__glow" aria-hidden="true" />
		</button>
	);
}
