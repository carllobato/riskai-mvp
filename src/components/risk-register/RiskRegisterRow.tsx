"use client";

import { useState, useRef, useEffect } from "react";
import type { Risk, RiskCategory, RiskLevel, RiskStatus } from "@/domain/risk/risk.schema";
import type { TrajectoryState } from "@/domain/risk/risk.logic";
import type { DecisionMetrics } from "@/domain/decision/decision.types";
import type { EscalationBand } from "@/config/riskThresholds";
import { calculateMomentum, detectTrajectoryState } from "@/domain/risk/risk.logic";
import { getBand } from "@/config/riskThresholds";
import { getScoreBand } from "@/lib/decisionScoreBand";
import { getForwardSignals } from "@/lib/forwardSignals";
import { useRiskRegister } from "@/store/risk-register.store";
import { useProjectionScenario, type UiMode } from "@/context/ProjectionScenarioContext";
import {
  selectScenarioForRisk,
  profileToScenarioName,
  scenarioNameToProfile,
  getTTCForScenario,
} from "@/lib/instability/selectScenarioLens";
import type { RiskWithInstability } from "@/lib/instability/selectScenarioLens";
import type { ScenarioLensMode, ScenarioName } from "@/lib/instability/selectScenarioLens";
import { LensDebugIcon } from "@/components/debug/LensDebugIcon";
import { RiskEditCell } from "@/components/risk-register/RiskEditCell";
import { RiskLevelBadge } from "@/components/risk-register/RiskLevelBadge";
import { ForecastConfidenceBadge } from "@/components/risk-register/ForecastConfidenceBadge";
import { InstabilityBadge } from "@/components/risk-register/InstabilityBadge";

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

/** Faint row tint by highest projected band (restrained; low opacity for light and dark). Hidden in Meeting mode. */
function rowTintForBand(band: EscalationBand): React.CSSProperties["backgroundColor"] {
  if (band === "normal") return undefined;
  if (band === "watch") return "rgba(128, 128, 128, 0.04)"; // faint neutral
  if (band === "high") return "rgba(249, 115, 22, 0.05)"; // faint amber
  return "rgba(239, 68, 68, 0.05)"; // faint red (critical)
}

/** Single governance status for Meeting mode: Stable | Escalating | At Risk | Critical */
type MeetingStatus = "Stable" | "Escalating" | "At Risk" | "Critical";

function getMeetingStatus(
  currentBand: EscalationBand,
  signals: { hasForecast: boolean; projectedCritical?: boolean; mitigationInsufficient?: boolean },
  trajectoryState: TrajectoryState | undefined,
  momentumScore: number | undefined
): MeetingStatus {
  if (currentBand === "critical") return "Critical";
  if (signals.hasForecast && (signals.projectedCritical || signals.mitigationInsufficient)) return "At Risk";
  if (trajectoryState === "ESCALATING" || (typeof momentumScore === "number" && momentumScore > 2)) return "Escalating";
  return "Stable";
}

const meetingStatusStyle: Record<MeetingStatus, React.CSSProperties> = {
  Stable: {
    backgroundColor: "rgba(0,0,0,0.05)",
    color: "var(--foreground)",
    opacity: 0.9,
  },
  Escalating: {
    backgroundColor: "rgba(128, 128, 128, 0.12)",
    color: "var(--foreground)",
    opacity: 0.95,
  },
  "At Risk": {
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    color: "#a16207",
  },
  Critical: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    color: "#b91c1c",
  },
};

function DecisionCell({
  decision,
  scoreDelta,
  momentumScore,
  trajectoryState,
  signals,
  currentBand,
  lensDebug,
  scenarioToUse,
  uiMode,
}: {
  decision: DecisionMetrics | null | undefined;
  scoreDelta?: number;
  momentumScore?: number;
  trajectoryState?: TrajectoryState;
  signals: ReturnType<typeof getForwardSignals>;
  currentBand: EscalationBand;
  lensDebug?: { risk: RiskWithInstability; lensMode: ScenarioLensMode; manualScenario: ScenarioName };
  scenarioToUse?: ScenarioName;
  uiMode?: UiMode;
}) {
  const { hasForecast, projectedCritical, timeToCritical, mitigationInsufficient } = signals;
  const showProjectedUp = hasForecast && projectedCritical && currentBand !== "critical";
  const isCritical = currentBand === "critical";
  const cyclesLabel = hasForecast && (timeToCritical != null || isCritical)
    ? (isCritical ? "0 cycles" : `in ${timeToCritical} cycles`)
    : null;
  const mitigationLabel = hasForecast && mitigationInsufficient
    ? (isCritical ? "Remains critical" : "Mitigation insufficient")
    : null;

  if (!decision) return <span style={{ fontSize: 12, color: "#737373" }}>—</span>;

  // Meeting mode: single clean status badge only
  if (uiMode === "Meeting") {
    const meetingStatus = getMeetingStatus(
      currentBand,
      { hasForecast, projectedCritical, mitigationInsufficient },
      trajectoryState,
      momentumScore
    );
    const style = {
      ...alertPillStyle,
      ...meetingStatusStyle[meetingStatus],
      minWidth: 56,
      justifyContent: "center" as const,
    };
    return (
      <div style={{ display: "flex", alignItems: "center" }}>
        <span style={style}>{meetingStatus}</span>
      </div>
    );
  }

  // Diagnostic mode: full indicators
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
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", width: "100%" }}>
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
        {showProjectedUp && (
          <span style={{ ...alertPillStyle, backgroundColor: "rgba(0,0,0,0.06)", color: "#525252" }} title={cyclesLabel ?? undefined}>
            Projected ↑
          </span>
        )}
        {cyclesLabel != null && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
            <span
              style={{ fontSize: 10, color: "#a3a3a3" }}
              title={
                signals.fallbackToNeutral
                  ? "Fallback to Neutral (missing scenario output)"
                  : isCritical
                    ? "Already critical"
                    : `Reaches critical in ${timeToCritical} cycles`
              }
            >
              {isCritical ? "0 cycles" : `in ${timeToCritical} cycles`}
              {signals.fallbackToNeutral && (
                <span style={{ marginLeft: 2, opacity: 0.7 }} title="Fallback to Neutral (missing scenario output)">
                  ·
                </span>
              )}
            </span>
            {lensDebug && (
              <LensDebugIcon
                risk={lensDebug.risk}
                lensMode={lensDebug.lensMode}
                manualScenario={lensDebug.manualScenario}
                uiMode={uiMode}
              />
            )}
          </span>
        )}
        {mitigationLabel != null && (
          <span style={{ ...alertPillStyle, backgroundColor: "rgba(180, 83, 9, 0.12)", color: "#b45309", display: "inline-flex", alignItems: "center", gap: 4 }} title={isCritical ? "Remains critical within horizon" : "Mitigation still crosses critical within horizon"}>
            <span aria-hidden>⚠</span>
            {mitigationLabel}
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
        {hasForecast && (
          <span style={{ marginLeft: "auto" }}>
            <ForecastConfidenceBadge
              forecastConfidence={signals.forecastConfidence}
              insufficientHistory={signals.insufficientHistory}
            />
          </span>
        )}
      </div>
    </div>
  );
}

function ApplyRecommendedButton({
  recommendedScenario,
  manualScenario,
  onApply,
}: {
  recommendedScenario: ScenarioName;
  manualScenario: ScenarioName;
  onApply: () => void;
}) {
  const [appliedAt, setAppliedAt] = useState<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (appliedAt == null) return;
    timeoutRef.current = setTimeout(() => setAppliedAt(null), 1500);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [appliedAt]);

  const isAligned = recommendedScenario === manualScenario;
  const handleClick = () => {
    if (isAligned) return;
    onApply();
    setAppliedAt(Date.now());
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <button
        type="button"
        disabled={isAligned}
        title={isAligned ? "Already aligned" : "Set global scenario to recommended"}
        onClick={handleClick}
        style={{
          fontSize: 10,
          fontWeight: 500,
          padding: "2px 6px",
          border: "1px solid rgba(0,0,0,0.15)",
          borderRadius: 4,
          background: isAligned ? "rgba(0,0,0,0.02)" : "rgba(0,0,0,0.04)",
          cursor: isAligned ? "default" : "pointer",
          opacity: isAligned ? 0.7 : 1,
        }}
      >
        Apply
      </button>
      {appliedAt != null && (
        <span style={{ fontSize: 10, color: "#22c55e", opacity: 0.9 }} aria-live="polite">
          Applied
        </span>
      )}
    </span>
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
  const { updateRisk, updateRatingPc, riskForecastsById } = useRiskRegister();
  const { profile, setProfile, lensMode, uiMode } = useProjectionScenario();
  const momentum = calculateMomentum(risk);
  const trajectoryState = detectTrajectoryState(risk);
  const forecast = riskForecastsById[risk.id];
  const manualScenario = profileToScenarioName(profile);
  const scenarioToUse = selectScenarioForRisk(
    { instability: forecast?.instability },
    lensMode,
    manualScenario
  );
  const baseSignals = getForwardSignals(risk.id, riskForecastsById);
  const scenarioTTC = forecast?.scenarioTTC;
  let timeToCritical = baseSignals.timeToCritical ?? null;
  let projectedCritical = baseSignals.projectedCritical ?? false;
  let fallbackToNeutral = false;
  if (scenarioTTC) {
    const block = getTTCForScenario(scenarioTTC, scenarioToUse);
    const neutralBlock = getTTCForScenario(scenarioTTC, "Neutral");
    fallbackToNeutral = block.fallbackToNeutral;
    const ttc: number | null = !block.fallbackToNeutral
      ? block.ttc
      : !neutralBlock.fallbackToNeutral
        ? neutralBlock.ttc
        : null;
    timeToCritical = ttc;
    projectedCritical = ttc !== null;
  }
  const signals = {
    ...baseSignals,
    timeToCritical,
    projectedCritical,
    ...(fallbackToNeutral && { fallbackToNeutral: true }),
  };
  const currentBand = getBand(decision?.compositeScore ?? 0);
  const rowTint =
    uiMode === "Diagnostic" && signals.hasForecast
      ? rowTintForBand(signals.projectedPeakBand)
      : undefined;
  const recommendedScenario = forecast?.instability?.recommendedScenario;
  const showLensMismatch =
    lensMode === "Manual" &&
    recommendedScenario != null &&
    manualScenario !== recommendedScenario;

  const isMeeting = uiMode === "Meeting";
  return (
    <div
      id={`risk-${risk.id}`}
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr 1fr 1.5fr 1.5fr 2fr 1fr 1.2fr 0.9fr",
        padding: isMeeting ? "8px 12px" : "10px 12px",
        borderBottom: "1px solid #eee",
        alignItems: "center",
        gap: isMeeting ? 8 : 10,
        backgroundColor: rowTint,
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

      {/* Decision: score + momentum arrow + trajectory badge + alert pills + projection signals */}
      <DecisionCell
        decision={decision}
        scoreDelta={scoreDelta}
        momentumScore={momentum.momentumScore}
        trajectoryState={trajectoryState}
        signals={signals}
        currentBand={currentBand}
        scenarioToUse={scenarioToUse}
        uiMode={uiMode}
        lensDebug={
          uiMode === "Diagnostic"
            ? { risk: { instability: forecast?.instability }, lensMode, manualScenario }
            : undefined
        }
      />

      {/* Instability: Meeting = one badge only; Diagnostic = full breakdown */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: isMeeting ? 0 : 4,
          alignItems: "flex-start",
        }}
      >
        {isMeeting ? (
          <InstabilityBadge
            instability={forecast?.instability}
            lensUsed={scenarioToUse}
            manualScenario={manualScenario}
            lensMode={lensMode}
            uiMode={uiMode}
          />
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <InstabilityBadge
                instability={forecast?.instability}
                lensUsed={scenarioToUse}
                manualScenario={manualScenario}
                lensMode={lensMode}
                uiMode={uiMode}
              />
              {forecast?.earlyWarning && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: "#a16207",
                    opacity: 0.9,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 2,
                  }}
                  title={forecast?.earlyWarningReason?.join(" ") ?? "Early warning"}
                >
                  <span aria-hidden style={{ opacity: 0.85 }}>⚠</span>
                  Early Warning
                </span>
              )}
            </div>
            {recommendedScenario != null && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--foreground)",
                    opacity: 0.8,
                  }}
                  title={showLensMismatch ? "Recommended lens differs due to instability signals." : undefined}
                >
                  Recommended: {recommendedScenario}
                  {showLensMismatch && (
                    <span style={{ marginLeft: 4, color: "#737373" }} title="Recommended lens differs due to instability signals.">
                      · Viewing: {manualScenario} (differs)
                    </span>
                  )}
                </span>
                {lensMode === "Manual" && (
                  <ApplyRecommendedButton
                    recommendedScenario={recommendedScenario}
                    manualScenario={manualScenario}
                    onApply={() => setProfile(scenarioNameToProfile(recommendedScenario))}
                  />
                )}
              </div>
            )}
            {forecast?.fragility != null && (
              <span
                style={{
                  fontSize: 10,
                  color: "var(--foreground)",
                  opacity: 0.65,
                }}
                title="Structural fragility: differentiates temporary instability from persistent structural fragility."
              >
                Fragility: {forecast.fragility.level}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}