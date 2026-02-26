"use client";

import type { Risk } from "@/domain/risk/risk.schema";
import { RiskRegisterRow } from "@/components/risk-register/RiskRegisterRow";

export function RiskRegisterTable({ risks }: { risks: Risk[] }) {
  return (
    <div style={{ marginTop: 16, border: "1px solid #e5e5e5", borderRadius: 10, overflow: "hidden" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr 2fr 1fr",
          gap: 0,
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
        <div>Mitigation</div>
        <div>Status</div>
      </div>

      {risks.length === 0 ? (
        <div style={{ padding: 12, opacity: 0.8 }}>No risks yet.</div>
      ) : (
        risks.map((risk) => <RiskRegisterRow key={risk.id} risk={risk} />)
      )}
    </div>
  );
}