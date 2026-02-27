"use client";

import type { Risk, RiskCategory, RiskLevel, RiskStatus } from "@/domain/risk/risk.schema";
import type { TrajectoryState } from "@/domain/risk/risk.logic";
import type { DecisionMetrics } from "@/domain/decision/decision.types";
import { calculateMomentum, detectTrajectoryState } from "@/domain/risk/risk.logic";
import { getScoreBand } from "@/lib/decisionScoreBand";
import { useRiskRegister } from "@/store/risk-register.store";
import { RiskEditCell } from "@/components/risk-register/RiskEditCell";
import { RiskLevelBadge } from "@/components/risk-register/RiskLevelBadge";

const SCORE_DELTA_THRESHOLD = 3;

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

const decisionBadgeStyle = (score: number): React.CSSProperties => {
  const band = getScoreBand(score);
  if (band === "critical") return { backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#b91c1c" };
  if (band === "watch") return { backgroundColor: "rgba(234, 179, 8, 0.2)", color: "#a16207" };
  return { backgroundColor: "rgba(0,0,0,0.06)", color: "#525252" };
};

const alertPillStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "2px 6px",
  borderRadius: 9999,
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.02em",
};

const trajectoryBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "2px 5px",
  borderRadius: 6,
  fontSize: 9,
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.03em",
};

function trajectoryLabelStyle(state: TrajectoryState): React.CSSProperties {
  if (state === "ESCALATING") return { backgroundColor: "rgba(239, 68, 68, 0.12)", color: "#b91c1c" };
  if (state === "STABILISING") return { backgroundColor: "rgba(34, 197, 94, 0.12)", color: "#15803d" };
  if (state === "VOLATILE") return { backgroundColor: "rgba(234, 179, 8, 0.15)", color: "#a16207" };
  return {};
}

function DecisionCell({
  decision,
  scoreDelta,
  momentumScore,
  trajectoryState,
}: {
  decision: DecisionMetrics | null | undefined;
  scoreDelta?: number;
  momentumScore?: number;
  trajectoryState?: TrajectoryState;
}) {
  if (!decision) return <span style={{ fontSize: 12, color: "#737373" }}>—</span>;
  const tags = decision.alertTags ?? [];
  const showTags = tags.slice(0, 2);
  const extra = tags.length > 2 ? tags.length - 2 : 0;
  const momentumArrow =
    typeof momentumScore === "number"
      ? momentumScore > 2
        ? "↑"
        : momentumScore < -2
          ? "↓"
          : "→"
      : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        <span
          style={{
            ...alertPillStyle,
            ...decisionBadgeStyle(decision.compositeScore),
            minWidth: 24,
            justifyContent: "center",
          }}
        >
          {Math.round(decision.compositeScore)}
          {momentumArrow != null && <span style={{ marginLeft: 2, fontSize: 10, opacity: 0.85 }}>{momentumArrow}</span>}
        </span>
        {trajectoryState != null && trajectoryState !== "NEUTRAL" && (
          <span style={{ ...trajectoryBadgeStyle, ...trajectoryLabelStyle(trajectoryState) }}>
            {trajectoryState}
          </span>
        )}
        {showTags.map((t) => (
          <span
            key={t}
            style={{
              ...alertPillStyle,
              backgroundColor: "rgba(59, 130, 246, 0.15)",
              color: "#1d4ed8",
            }}
          >
            {t}
          </span>
        ))}
        {extra > 0 && (
          <span style={{ ...alertPillStyle, backgroundColor: "rgba(0,0,0,0.08)", color: "#737373" }}>
            +{extra}
          </span>
        )}
      </div>
    </div>
  );
}

export function RiskRegisterRow({
  risk,
  decision,
  scoreDelta,
}: {
  risk: Risk;
  decision?: DecisionMetrics | null;
  scoreDelta?: number;
}) {
  const { updateRisk, updateRatingPc } = useRiskRegister();
  const momentum = calculateMomentum(risk);
  const trajectoryState = detectTrajectoryState(risk);

  return (
    <div
      id={`risk-${risk.id}`}
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr 1fr 1.5fr 1.5fr 2fr 1fr 1.2fr",
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

      {/* Decision: score + momentum arrow + trajectory badge + alert pills */}
      <DecisionCell
        decision={decision}
        scoreDelta={scoreDelta}
        momentumScore={momentum.momentumScore}
        trajectoryState={trajectoryState}
      />
    </div>
  );
}