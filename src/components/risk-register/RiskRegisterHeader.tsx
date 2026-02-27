"use client";

import { useRiskRegister } from "@/store/risk-register.store";
import { createRisk } from "@/domain/risk/risk.factory";

export function RiskRegisterHeader() {
  const { risks, clearRisks, addRisk, forwardPressure } = useRiskRegister();
  const pct = Math.round(forwardPressure.pctProjectedCritical * 100);
  const isElevated = forwardPressure.pressureClass === "High" || forwardPressure.pressureClass === "Severe";

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Risk Register</h1>
        <p style={{ margin: "6px 0 0 0", opacity: 0.8 }}>
          {risks.length} risk{risks.length === 1 ? "" : "s"}
        </p>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Forward pressure: {forwardPressure.pressureClass} — {pct}% projected critical
          {isElevated && (
            <span className="ml-1.5 text-amber-600 dark:text-amber-500" title="Forward pressure is High or Severe">
              <span aria-hidden>⚠</span>
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[11px] text-neutral-400 dark:text-neutral-500 font-normal">
          Tip: toggle &quot;Show projected only&quot; to surface pre-escalation risks.
        </p>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => addRisk(createRisk())}>Add sample</button>
        <button onClick={clearRisks}>Clear</button>
      </div>
    </div>
  );
}