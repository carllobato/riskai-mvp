"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import { useProjectionScenario } from "@/context/ProjectionScenarioContext";
import { useRiskRegister } from "@/store/risk-register.store";
import type { ProjectionProfile } from "@/lib/projectionProfiles";
import type { ScenarioName } from "@/lib/instability/selectScenarioLens";

const isDev = process.env.NODE_ENV === "development";

const CogIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const ALL_NAV_ITEMS: { href: string; label: string; icon?: "cog"; hideInMvp?: boolean }[] = [
  { href: "/project", label: "Project Settings", icon: "cog" },
  { href: "/risk-register", label: "Risk Register" },
  { href: "/matrix", label: "Risk Matrix", hideInMvp: true },
  { href: "/outputs", label: "Outputs" },
  { href: "/analysis", label: "Analysis" },
  { href: "/day0", label: "Day 0", hideInMvp: true },
  ...(isDev ? [{ href: "/dev/health", label: "Engine Health", hideInMvp: true }] : []),
];

const SCENARIO_OPTIONS: { value: ProjectionProfile; label: string }[] = [
  { value: "conservative", label: "Conservative" },
  { value: "neutral", label: "Neutral" },
  { value: "aggressive", label: "Aggressive" },
];

export function NavBar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { profile, setProfile, lensMode, setLensMode, uiMode, setUiMode } = useProjectionScenario();
  const { risks, riskForecastsById } = useRiskRegister();
  const isAuto = lensMode === "Auto";

  const autoLensSummary = useMemo(() => {
    if (!isAuto || risks.length === 0) return null;
    let conservative = 0;
    let neutral = 0;
    let aggressive = 0;
    for (const r of risks) {
      const rec = riskForecastsById[r.id]?.instability?.recommendedScenario;
      if (rec === "Conservative") conservative++;
      else if (rec === "Aggressive") aggressive++;
      else neutral++;
    }
    const total = risks.length;
    const mostCommon: ScenarioName =
      conservative >= neutral && conservative >= aggressive
        ? "Conservative"
        : aggressive >= neutral && aggressive >= conservative
          ? "Aggressive"
          : "Neutral";
    const conservativeShare = total > 0 ? conservative / total : 0;
    return {
      conservative,
      neutral,
      aggressive,
      mostCommon,
      elevatedInstability: conservativeShare > 0.3,
    };
  }, [isAuto, risks, riskForecastsById]);

  return (
    <nav className="sticky top-0 z-50 flex items-center gap-6 px-6 py-3 border-b border-neutral-200 dark:border-neutral-700 bg-[var(--background)] shadow-sm">
      {/* Left: app name / logo */}
      <Link
        href="/project"
        className="text-lg font-semibold text-[var(--foreground)] no-underline shrink-0 hover:opacity-80 transition-opacity"
      >
        RiskAI
      </Link>

      {/* Center/left: main nav links (Risk Matrix hidden in MVP mode) */}
      <div className="flex items-center gap-1">
        {ALL_NAV_ITEMS.filter((item) => !(item.hideInMvp && uiMode === "MVP")).map(({ href, label, icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`
                inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium no-underline transition-colors
                ${isActive
                  ? "bg-neutral-200 dark:bg-neutral-700 text-[var(--foreground)] underline underline-offset-4"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-[var(--foreground)] hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }
              `}
            >
              {icon === "cog" && <CogIcon />}
              {label}
            </Link>
          );
        })}
      </div>

      {/* Right: lens distribution (Debug only) + UI Mode + Forecast Lens + Scenario + theme */}
      <div className="ml-auto flex items-center gap-3 shrink-0">
        {uiMode === "Debug" && autoLensSummary != null && (
          <div className="hidden sm:flex flex-col items-end gap-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
            <span>
              Forecast lens (Auto): {autoLensSummary.conservative} Conservative • {autoLensSummary.neutral} Neutral • {autoLensSummary.aggressive} Aggressive
            </span>
            <span>
              Most common: {autoLensSummary.mostCommon}
              {autoLensSummary.elevatedInstability && (
                <span
                  className="ml-1.5 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                  title="Conservative share &gt; 30%"
                >
                  Elevated instability
                </span>
              )}
            </span>
          </div>
        )}
        <div className="flex flex-col gap-0.5 items-end">
          <div className="flex items-center gap-2">
            <span className="text-neutral-400 dark:text-neutral-500 text-xs select-none shrink-0">UI Mode</span>
            <div
              className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 p-0.5"
              role="group"
              aria-label="UI Mode"
            >
              <button
                type="button"
                onClick={() => setUiMode("MVP")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  uiMode === "MVP"
                    ? "bg-neutral-200 dark:bg-neutral-600 text-[var(--foreground)] shadow-sm"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-[var(--foreground)]"
                }`}
              >
                MVP
              </button>
              <button
                type="button"
                onClick={() => setUiMode("Debug")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  uiMode === "Debug"
                    ? "bg-neutral-200 dark:bg-neutral-600 text-[var(--foreground)] shadow-sm"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-[var(--foreground)]"
                }`}
              >
                Debug
              </button>
            </div>
            {uiMode !== "MVP" && (
              <>
                <span
                  className="inline-flex items-center gap-1.5"
                  title="Forecast Lens affects projections, TTC, crossings, pressure, and early warnings. Baseline simulation tiles are unchanged unless explicitly enabled."
                >
                  <span className="text-neutral-400 dark:text-neutral-500 text-xs cursor-help select-none" aria-hidden>ⓘ</span>
                  <div
                    className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 p-0.5"
                    role="group"
                    aria-label="Forecast Lens"
                  >
                    <button
                      type="button"
                      onClick={() => setLensMode("Manual")}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        lensMode === "Manual"
                          ? "bg-neutral-200 dark:bg-neutral-600 text-[var(--foreground)] shadow-sm"
                          : "text-neutral-600 dark:text-neutral-400 hover:text-[var(--foreground)]"
                      }`}
                    >
                      Manual
                    </button>
                    <button
                      type="button"
                      onClick={() => setLensMode("Auto")}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        lensMode === "Auto"
                          ? "bg-neutral-200 dark:bg-neutral-600 text-[var(--foreground)] shadow-sm"
                          : "text-neutral-600 dark:text-neutral-400 hover:text-[var(--foreground)]"
                      }`}
                    >
                      Auto
                    </button>
                  </div>
                </span>
                <label htmlFor="projection-scenario" className="sr-only">
                  Forecast Scenario
                </label>
                <select
                  id="projection-scenario"
                  aria-label="Forecast Scenario"
                  aria-describedby="projection-scenario-desc"
                  value={profile}
                  onChange={(e) => setProfile(e.target.value as ProjectionProfile)}
                  disabled={isAuto}
                  className={`h-9 min-w-0 max-w-[10rem] rounded-md border border-neutral-200 dark:border-neutral-700 text-sm font-medium px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 ${
                    isAuto
                      ? "bg-neutral-100 dark:bg-neutral-800/60 text-neutral-500 dark:text-neutral-400 cursor-default"
                      : "bg-neutral-100 dark:bg-neutral-800 text-[var(--foreground)] cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  }`}
                >
                  {SCENARIO_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <span id="projection-scenario-desc" className="text-neutral-500 dark:text-neutral-400 text-xs hidden sm:inline">
                  Forecast Scenario
                </span>
              </>
            )}
          </div>
          {uiMode !== "MVP" && isAuto && (
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              Auto uses each risk&apos;s recommended forecast (from instability).
            </p>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={theme === "dark"}
          aria-label="Toggle theme"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggleTheme}
          className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 p-0.5 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 focus:ring-offset-2 focus:ring-offset-[var(--background)]"
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-neutral-300 dark:bg-neutral-500 shadow-sm transition-transform duration-200 ease-out ${
              theme === "dark" ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </nav>
  );
}
