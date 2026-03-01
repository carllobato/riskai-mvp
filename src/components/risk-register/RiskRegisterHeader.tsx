"use client";

import { useMemo, useEffect } from "react";
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
  onReviewRisks,
}: {
  projectContext: ProjectContext | null;
  showReviewRisksButton?: boolean;
  onReviewRisks?: () => void;
}) {
  const { risks, clearRisks, addRisk, setRisks, forwardPressure, riskForecastsById } = useRiskRegister();
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
            className="px-3 py-1.5 text-sm rounded-md border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            Review risks
          </button>
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