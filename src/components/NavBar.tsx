"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import { useProjectionScenario } from "@/context/ProjectionScenarioContext";
import type { ProjectionProfile } from "@/lib/projectionProfiles";

const navItems: { href: string; label: string }[] = [
  { href: "/risk-register", label: "Risk Register" },
  { href: "/matrix", label: "Risk Matrix" },
  { href: "/outputs", label: "Outputs" },
  { href: "/day0", label: "Day 0" },
];

const SCENARIO_OPTIONS: { value: ProjectionProfile; label: string }[] = [
  { value: "conservative", label: "Conservative" },
  { value: "neutral", label: "Neutral" },
  { value: "aggressive", label: "Aggressive" },
];

export function NavBar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { profile, setProfile } = useProjectionScenario();

  return (
    <nav className="sticky top-0 z-50 flex items-center gap-6 px-6 py-3 border-b border-neutral-200 dark:border-neutral-700 bg-[var(--background)] shadow-sm">
      {/* Left: app name / logo */}
      <Link
        href="/risk-register"
        className="text-lg font-semibold text-[var(--foreground)] no-underline shrink-0 hover:opacity-80 transition-opacity"
      >
        RiskAI
      </Link>

      {/* Center/left: main nav links */}
      <div className="flex items-center gap-1">
        {navItems.map(({ href, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`
                px-3 py-2 rounded-md text-sm font-medium no-underline transition-colors
                ${isActive
                  ? "bg-neutral-200 dark:bg-neutral-700 text-[var(--foreground)] underline underline-offset-4"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-[var(--foreground)] hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }
              `}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Right: scenario selector + theme toggle */}
      <div className="ml-auto flex items-center gap-2 shrink-0">
        <div
          className="flex items-center gap-1.5"
          title="Adjusts drift persistence and decay for scenario testing."
        >
          <label htmlFor="projection-scenario" className="sr-only">
            Scenario
          </label>
          <select
            id="projection-scenario"
            aria-label="Scenario"
            aria-describedby="projection-scenario-desc"
            value={profile}
            onChange={(e) => setProfile(e.target.value as ProjectionProfile)}
            className="h-9 min-w-0 max-w-[10rem] rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-[var(--foreground)] text-sm font-medium px-2.5 py-1.5 cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500"
          >
            {SCENARIO_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <span id="projection-scenario-desc" className="text-neutral-500 dark:text-neutral-400 text-xs hidden sm:inline">
            Scenario
          </span>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-[var(--foreground)] hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors text-base"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>
    </nav>
  );
}
