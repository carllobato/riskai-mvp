"use client";

import { useMemo, useEffect, useState, useRef } from "react";
import { useRiskRegister } from "@/store/risk-register.store";
import { useProjectionScenario } from "@/context/ProjectionScenarioContext";
import { createRisk } from "@/domain/risk/risk.factory";
import type { ScenarioName } from "@/lib/instability/selectScenarioLens";
import { validateScenarioOrdering } from "@/lib/instability/validateScenarioOrdering";
import { getDemoRisks } from "@/data/demoRisks";
import type { ProjectContext } from "@/lib/projectContext";

export function RiskRegisterHeader({
  projectContext,
  showReviewRisksButton,
  filterQuery = "",
  onFilterQueryChange,
  onReviewRisks,
}: {
  projectContext: ProjectContext | null;
  showReviewRisksButton?: boolean;
  filterQuery?: string;
  onFilterQueryChange?: (value: string) => void;
  onReviewRisks?: () => void;
}) {
  const { risks, clearRisks, addRisk, setRisks, forwardPressure, riskForecastsById } = useRiskRegister();
  const [filterOpen, setFilterOpen] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);
  const { lensMode, uiMode } = useProjectionScenario();
  const pct = Math.round(forwardPressure.pctProjectedCritical * 100);
  const isElevated = forwardPressure.pressureClass === "High" || forwardPressure.pressureClass === "Severe";

  const autoLensCounts = useMemo(() => {
    if (lensMode !== "Auto") return null;
    let conservative = 0;
    let neutral = 0;
    let aggressive = 0;
    for (const r of risks) {
      const rec = riskForecastsById[r.id]?.instability?.recommendedScenario;
      if (rec === "Conservative") conservative++;
      else if (rec === "Aggressive") aggressive++;
      else neutral++;
    }
    const mostCommon: ScenarioName =
      conservative >= neutral && conservative >= aggressive
        ? "Conservative"
        : aggressive >= neutral && aggressive >= conservative
          ? "Aggressive"
          : "Neutral";
    return { conservative, neutral, aggressive, mostCommon, total: risks.length };
  }, [lensMode, risks, riskForecastsById]);

  const scenarioOrderingViolation = useMemo(() => {
    if (uiMode !== "Diagnostic" || risks.length === 0) return false;
    const snapshots = risks
      .map((r) => riskForecastsById[r.id]?.scenarioTTC)
      .filter((t): t is NonNullable<typeof t> => t != null)
      .map((t) => ({
        conservativeTTC: t.conservative,
        neutralTTC: t.neutral,
        aggressiveTTC: t.aggressive,
      }));
    if (snapshots.length === 0) return false;
    const result = validateScenarioOrdering(snapshots);
    return result.flag === "ScenarioOrderingViolation";
  }, [uiMode, risks, riskForecastsById]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || !autoLensCounts || autoLensCounts.total === 0) return;
    const rate = autoLensCounts.conservative / autoLensCounts.total;
    if (rate > 0.3) {
      console.warn("Portfolio instability elevated: high Conservative recommendation rate.");
    }
  }, [autoLensCounts]);

  const isMeeting = uiMode === "Meeting";

  useEffect(() => {
    if (filterOpen) filterInputRef.current?.focus();
  }, [filterOpen]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Risk Register</h1>
          {!isMeeting && projectContext != null && (
            <span
              className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
              title="Project context is saved and complete"
            >
              Project context: Complete
            </span>
          )}
          {!isMeeting && projectContext == null && (
            <span
              className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
              title="Complete Project Settings to use the Risk Register"
            >
              Project context: Incomplete
            </span>
          )}
        </div>
        {!isMeeting && (
          <p style={{ margin: "6px 0 0 0", opacity: 0.8 }}>
            {risks.length} risk{risks.length === 1 ? "" : "s"}
          </p>
        )}
        {!isMeeting && (
          <>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Forward pressure: {forwardPressure.pressureClass} — {pct}% projected critical
              {isElevated && (
                <span className="ml-1.5 text-amber-600 dark:text-amber-500" title="Forward pressure is High or Severe">
                  <span aria-hidden>⚠</span>
                </span>
              )}
            </p>
            {autoLensCounts != null && (
              <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                Forecast lens (Auto): {autoLensCounts.conservative} Conservative · {autoLensCounts.neutral} Neutral · {autoLensCounts.aggressive} Aggressive. Most common: {autoLensCounts.mostCommon}.
              </p>
            )}
            {scenarioOrderingViolation && (
              <p className="mt-0.5 text-[11px] text-neutral-600 dark:text-neutral-400" title="Scenario TTC ordering or neutral consistency violation detected">
                <span aria-hidden>⚠</span> ScenarioOrderingViolation
              </p>
            )}
            <p className="mt-0.5 text-[11px] text-neutral-400 dark:text-neutral-500 font-normal">
              Tip: toggle &quot;Show projected only&quot; to surface pre-escalation risks.
            </p>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {showReviewRisksButton && onReviewRisks && (
          <button
            type="button"
            onClick={onReviewRisks}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            Review risks
          </button>
        )}
        {onFilterQueryChange && (
          <div className="relative" ref={filterPopoverRef}>
            <button
              type="button"
              onClick={() => setFilterOpen((v) => !v)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md border ${
                filterQuery.trim()
                  ? "border-neutral-400 dark:border-neutral-500 bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200"
                  : "border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700"
              }`}
              aria-expanded={filterOpen}
              aria-haspopup="dialog"
            >
              Filter
            </button>
            {filterOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  aria-hidden
                  onClick={() => setFilterOpen(false)}
                />
                <div
                  role="dialog"
                  aria-label="Filter risks by all columns"
                  className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 shadow-lg p-2"
                >
                  <div className="flex items-center gap-1 rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)]">
                    <input
                      ref={filterInputRef}
                      type="text"
                      value={filterQuery}
                      onChange={(e) => onFilterQueryChange(e.target.value)}
                      placeholder="Search all columns…"
                      className="flex-1 min-w-0 px-2.5 py-1.5 text-sm bg-transparent border-0 rounded focus:outline-none focus:ring-0 text-[var(--foreground)] placeholder:text-neutral-400"
                      aria-label="Filter search"
                    />
                    {filterQuery && (
                      <button
                        type="button"
                        onClick={() => onFilterQueryChange("")}
                        className="p-1 rounded text-neutral-500 hover:text-[var(--foreground)] hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        aria-label="Clear filter"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                    Filters table and review list. Use H/M/L or High/Medium/Low for ratings.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => setRisks(getDemoRisks())}
          className="px-3 py-1.5 text-sm rounded-md border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700"
        >
          Load demo
        </button>
        <button
          type="button"
          onClick={() => addRisk(createRisk())}
          className="px-3 py-1.5 text-sm rounded-md border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700"
        >
          Add sample
        </button>
        <button
          type="button"
          onClick={clearRisks}
          className="px-3 py-1.5 text-sm rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30"
        >
          Clear
        </button>
      </div>
    </div>
  );
}