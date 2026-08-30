"use client";

import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";

export type ThemePreference = "system" | "dark" | "light";

type ThemeContextValue = {
	preference: ThemePreference;
	resolvedTheme: "dark" | "light";
	setPreference: (next: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "ccs-theme";

function getSystemTheme(): "dark" | "light" {
	if (typeof window === "undefined") return "dark";
	return window.matchMedia("(prefers-color-scheme: light)").matches
		? "light"
		: "dark";
}

/**
 * System / Dark / Light theme support  - light theme
 * is intentionally designed, not a simple inversion, see globals.css
 * data-theme="light" overrides. Preference persists in localStorage and
 * is applied as `data-theme` on <html> so CSS can key off it directly.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
	const [preference, setPreferenceState] = useState<ThemePreference>("system");
	const [systemTheme, setSystemTheme] = useState<"dark" | "light">("dark");

	useEffect(() => {
		const stored = window.localStorage.getItem(
			STORAGE_KEY,
		) as ThemePreference | null;
		if (stored === "system" || stored === "dark" || stored === "light") {
			// Reads localStorage after mount (not a lazy initializer) so the
			// server-rendered markup (always "system") and the client's first
			// render agree - a returning visitor's stored preference is applied
			// only once mounted, avoiding a hydration mismatch.
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setPreferenceState(stored);
		}
		setSystemTheme(getSystemTheme());

		const media = window.matchMedia("(prefers-color-scheme: light)");
		const onChange = () => setSystemTheme(getSystemTheme());
		media.addEventListener("change", onChange);
		return () => media.removeEventListener("change", onChange);
	}, []);

	const resolvedTheme = preference === "system" ? systemTheme : preference;

	useEffect(() => {
		document.documentElement.setAttribute("data-theme", resolvedTheme);
	}, [resolvedTheme]);

	const setPreference = (next: ThemePreference) => {
		setPreferenceState(next);
		window.localStorage.setItem(STORAGE_KEY, next);
	};

	const value = useMemo(
		() => ({ preference, resolvedTheme, setPreference }),
		[preference, resolvedTheme],
	);

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
}

export function useTheme() {
	const ctx = useContext(ThemeContext);
	if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
	return ctx;
}
