"use client";

import type { Risk, RiskCategory, RiskLevel, RiskStatus } from "@/domain/risk/risk.schema";
import { useRiskRegister } from "@/store/risk-register.store";
import { RiskEditCell } from "@/components/risk-register/RiskEditCell";
import { RiskLevelBadge } from "@/components/risk-register/RiskLevelBadge";

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

const selectStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 8,
  border: "1px solid #ddd",
  background: "transparent",
};

function RatingCell({
  riskId,
  target,
  probability,
  consequence,
  score,
  level,
  updateRatingPc,
}: {
  riskId: string;
  target: "inherent" | "residual";
  probability: number;
  consequence: number;
  score: number;
  level: RiskLevel;
  updateRatingPc: (id: string, target: "inherent" | "residual", payload: { probability?: number; consequence?: number }) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <select
        value={probability}
        onChange={(e) => updateRatingPc(riskId, target, { probability: Number(e.target.value) })}
        style={selectStyle}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            P{n}
          </option>
        ))}
      </select>
      <select
        value={consequence}
        onChange={(e) => updateRatingPc(riskId, target, { consequence: Number(e.target.value) })}
        style={selectStyle}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            C{n}
          </option>
        ))}
      </select>
      <span style={{ fontSize: 13, opacity: 0.85 }}>{score}</span>
      <RiskLevelBadge level={level} />
    </div>
  );
}

export function RiskRegisterRow({ risk }: { risk: Risk }) {
  const { updateRisk, updateRatingPc } = useRiskRegister();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr 1fr 1.5fr 1.5fr 2fr 1fr",
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
        style={selectStyle}
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

      {/* Inherent: P/C dropdowns + read-only score · level */}
      <RatingCell
        riskId={risk.id}
        target="inherent"
        probability={risk.inherentRating.probability}
        consequence={risk.inherentRating.consequence}
        score={risk.inherentRating.score}
        level={risk.inherentRating.level}
        updateRatingPc={updateRatingPc}
      />

      {/* Residual: P/C dropdowns + read-only score · level */}
      <RatingCell
        riskId={risk.id}
        target="residual"
        probability={risk.residualRating.probability}
        consequence={risk.residualRating.consequence}
        score={risk.residualRating.score}
        level={risk.residualRating.level}
        updateRatingPc={updateRatingPc}
      />

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
        style={selectStyle}
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