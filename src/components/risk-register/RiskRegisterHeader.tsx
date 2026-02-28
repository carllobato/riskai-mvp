"use client";

import { useMemo, useEffect } from "react";
import { useRiskRegister } from "@/store/risk-register.store";
import { useProjectionScenario } from "@/context/ProjectionScenarioContext";
import { createRisk } from "@/domain/risk/risk.factory";
import type { ScenarioName } from "@/lib/instability/selectScenarioLens";
import { validateScenarioOrdering } from "@/lib/instability/validateScenarioOrdering";

export function RiskRegisterHeader() {
  const { risks, clearRisks, addRisk, forwardPressure, riskForecastsById } = useRiskRegister();
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
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Risk Register</h1>
        <p style={{ margin: "6px 0 0 0", opacity: 0.8 }}>
          {risks.length} risk{risks.length === 1 ? "" : "s"}
        </p>
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

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => addRisk(createRisk())}>Add sample</button>
        <button onClick={clearRisks}>Clear</button>
      </div>
    </div>
  );
}