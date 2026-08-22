"use client";

import { usePathname } from "next/navigation";
import { useTheme, type ThemePreference } from "./ThemeProvider";
import { events, getBaseContext } from "@/lib/analytics";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  const pathname = usePathname();

  function cycle() {
    const currentIndex = OPTIONS.findIndex((o) => o.value === preference);
    const next = OPTIONS[(currentIndex + 1) % OPTIONS.length]!.value;
    setPreference(next);
    events.themeChange(next, getBaseContext(pathname));
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={`Theme: ${preference}. Click to change.`}
      title={`Theme: ${preference}`}
      onClick={cycle}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
    </button>
  );
}
