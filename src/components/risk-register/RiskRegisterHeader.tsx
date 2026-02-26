"use client";

import { useRiskRegister } from "@/store/risk-register.store";
import { createRisk } from "@/domain/risk/risk.factory";

export function RiskRegisterHeader() {
  const { risks, clearRisks, addRisk } = useRiskRegister();

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Risk Register</h1>
        <p style={{ margin: "6px 0 0 0", opacity: 0.8 }}>
          {risks.length} risk{risks.length === 1 ? "" : "s"}
        </p>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => addRisk(createRisk())}>Add sample</button>
        <button onClick={clearRisks}>Clear</button>
      </div>
    </div>
  );
}