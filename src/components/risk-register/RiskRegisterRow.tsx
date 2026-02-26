"use client";

import type { Risk, RiskCategory, RiskStatus } from "@/domain/risk/risk.schema";
import { useRiskRegister } from "@/store/risk-register.store";
import { RiskEditCell } from "@/components/risk-register/RiskEditCell";

const categories: RiskCategory[] = [
  "commercial",
  "programme",
  "design",
  "construction",
  "procurement",
  "hse",
  "authority",
  "operations",
  "other",
];

const statuses: RiskStatus[] = ["open", "monitoring", "closed"];

export function RiskRegisterRow({ risk }: { risk: Risk }) {
  const { updateRisk } = useRiskRegister();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr 1fr 1fr 2fr 1fr",
        padding: "10px 12px",
        borderBottom: "1px solid #eee",
        alignItems: "center",
        gap: 10,
      }}
    >
      {/* Title */}
      <RiskEditCell
        value={risk.title}
        placeholder="Risk title"
        onChange={(title) => updateRisk(risk.id, { title })}
      />

      {/* Category */}
      <select
        value={risk.category}
        onChange={(e) => updateRisk(risk.id, { category: e.target.value as RiskCategory })}
        style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd", background: "transparent" }}
      >
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      {/* Owner */}
      <RiskEditCell
        value={risk.owner ?? ""}
        placeholder="Owner"
        onChange={(owner) => updateRisk(risk.id, { owner: owner || undefined })}
      />

      {/* Inherent */}
      <div>
        {risk.inherent.level} ({risk.inherent.score})
      </div>

      {/* Mitigation */}
      <RiskEditCell
        value={risk.mitigation ?? ""}
        placeholder="Mitigation"
        onChange={(mitigation) => updateRisk(risk.id, { mitigation: mitigation || undefined })}
      />

      {/* Status */}
      <select
        value={risk.status}
        onChange={(e) => updateRisk(risk.id, { status: e.target.value as RiskStatus })}
        style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd", background: "transparent" }}
      >
        {statuses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}