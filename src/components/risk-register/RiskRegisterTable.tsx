"use client";

import type { Risk } from "@/domain/risk/risk.schema";
import type { DecisionMetrics } from "@/domain/decision/decision.types";
import { RiskRegisterRow } from "@/components/risk-register/RiskRegisterRow";

export function RiskRegisterTable({
  risks,
  decisionById = {},
  scoreDeltaByRiskId = {},
}: {
  risks: Risk[];
  decisionById?: Record<string, DecisionMetrics>;
  scoreDeltaByRiskId?: Record<string, number>;
}) {
  return (
    <div style={{ marginTop: 16, border: "1px solid #e5e5e5", borderRadius: 10, overflow: "hidden" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1.5fr 1.5fr 2fr 1fr 1.2fr",
          gap: 10,
          padding: "10px 12px",
          fontWeight: 600,
          background: "rgba(0,0,0,0.03)",
          borderBottom: "1px solid #e5e5e5",
        }}
      >
        <div>Title</div>
        <div>Category</div>
        <div>Owner</div>
        <div>Inherent</div>
        <div>Residual</div>
        <div
          style={{
            paddingTop: 10,
            marginTop: 6,
            borderTop: "1px solid #e8e8e8",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            alignItems: "flex-start",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, color: "#525252" }}>
            <span style={{ fontSize: 14 }} aria-hidden>🛠</span>
            <span>Mitigation Strategy</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 400, color: "#737373", lineHeight: 1.3 }}>
            Updates to these fields reset mitigation effectiveness tracking.
          </div>
        </div>
        <div>Status</div>
        <div>Decision</div>
      </div>

      {risks.length === 0 ? (
        <div style={{ padding: 12, opacity: 0.8 }}>No risks yet.</div>
      ) : (
        risks.map((risk) => (
          <RiskRegisterRow
            key={risk.id}
            risk={risk}
            decision={decisionById[risk.id]}
            scoreDelta={scoreDeltaByRiskId[risk.id]}
          />
        ))
      )}
    </div>
  );
}