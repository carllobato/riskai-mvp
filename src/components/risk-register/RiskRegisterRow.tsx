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
import { RiskLevelBadge, LEVEL_STYLES, RATING_TABLE_LEVEL_STYLES } from "@/components/risk-register/RiskLevelBadge";
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

const statuses: RiskStatus[] = ["draft", "open", "monitoring", "mitigating", "closed"];

function formatStatusLabel(status: RiskStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatCategoryLabel(category: RiskCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

/** Map risk level to single letter for Pre/Post Rating column. */
function levelToLetter(level: RiskLevel): "L" | "M" | "H" | "E" {
  const map: Record<RiskLevel, "L" | "M" | "H" | "E"> = {
    low: "L",
    medium: "M",
    high: "H",
    extreme: "E",
  };
  return map[level] ?? "M";
}

/** Risk movement: compare inherent vs residual score. */
function getRiskMovement(preScore: number, postScore: number): "↑" | "↓" | "→" {
  if (postScore > preScore) return "↑";
  if (postScore < preScore) return "↓";
  return "→";
}

/** Tailwind classes for Δ movement pill (stable only). Improving (↓) and Worsening (↑) use post-rating low/high styles for consistency. */
const MOVEMENT_PILL_CLASS_STABLE = "bg-neutral-100 text-[var(--foreground)] dark:bg-neutral-700/50 dark:text-neutral-300";

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
  readOnly,
}: {
  riskId: string;
  target: "inherent" | "residual";
  probability: number;
  consequence: number;
  score: number;
  level: RiskLevel;
  updateRatingPc: (id: string, target: "inherent" | "residual", payload: { probability?: number; consequence?: number }) => void;
  readOnly?: boolean;
}) {
  if (readOnly) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13 }}>P{probability} × C{consequence}</span>
        <span style={{ fontSize: 13, opacity: 0.85 }}>{score}</span>
        <RiskLevelBadge level={level} />
      </div>
    );
  }
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

const DESCRIPTION_TOOLTIP_MAX_LEN = 140;

function truncateDescription(desc: string): string {
  const t = desc.trim();
  if (t.length <= DESCRIPTION_TOOLTIP_MAX_LEN) return t;
  return t.slice(0, DESCRIPTION_TOOLTIP_MAX_LEN).trimEnd() + "…";
}

export function RiskRegisterRow({
  risk,
  rowIndex = 0,
  onRiskClick,
}: {
  risk: Risk;
  rowIndex?: number;
  decision?: DecisionMetrics | null;
  scoreDelta?: number;
  onRiskClick?: (risk: Risk) => void;
}) {
  const { updateRisk } = useRiskRegister();
  const readOnly = Boolean(onRiskClick);
  const [showDescCard, setShowDescCard] = useState(false);
  const hasDescription = Boolean(risk.description?.trim());
  const isDraft = risk.status === "draft";

  const cellTextClass = "text-sm text-[var(--foreground)] truncate min-w-0";
  const cellMutedClass = "text-sm text-neutral-500 dark:text-neutral-400 truncate min-w-0";

  const handleRowClick = (e: React.MouseEvent) => {
    if (!onRiskClick) return;
    const target = e.target as Node;
    if (target instanceof Element && (target.closest("button") || target.closest("select") || target.closest("input") || target.closest("a") || target.closest("[data-description-card]"))) return;
    onRiskClick(risk);
  };

  const handleRowFocus = () => { if (hasDescription) setShowDescCard(true); };
  const handleRowBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setShowDescCard(false);
  };

  const riskIdDisplay =
    risk.riskNumber != null ? String(risk.riskNumber).padStart(3, "0") : "—";
  const preLetter = levelToLetter(risk.inherentRating.level);
  const postLetter = levelToLetter(risk.residualRating.level);
  const movement = getRiskMovement(risk.inherentRating.score, risk.residualRating.score);
  const movementPillClass = movement === "→" ? MOVEMENT_PILL_CLASS_STABLE : "";
  const preStyle = RATING_TABLE_LEVEL_STYLES[risk.inherentRating.level];
  const postStyle = RATING_TABLE_LEVEL_STYLES[risk.residualRating.level];
  const gridCols = onRiskClick
    ? "56px minmax(0, 2.5fr) minmax(0, 1fr) minmax(0, 1fr) 100px 100px 100px minmax(0, 0.9fr) minmax(96px, 96px)"
    : "56px minmax(0, 2.5fr) minmax(0, 1fr) minmax(0, 1fr) 100px 100px 100px minmax(0, 0.9fr)";

  return (
    <div
      id={`risk-${risk.id}`}
      role={onRiskClick ? "row" : undefined}
      tabIndex={onRiskClick && hasDescription ? 0 : undefined}
      onClick={handleRowClick}
      onFocus={handleRowFocus}
      onBlur={handleRowBlur}
      className={[
        onRiskClick && "cursor-pointer transition-colors hover:bg-neutral-50/80 dark:hover:bg-neutral-800/50 hover:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] dark:hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]",
        isDraft && "bg-amber-50/40 dark:bg-amber-950/20 border-l-2 border-l-amber-400/60 dark:border-l-amber-500/50",
      ].filter(Boolean).join(" ")}
      style={{
        display: "grid",
        gridTemplateColumns: gridCols,
        padding: "10px 12px",
        borderBottom: "1px solid #eee",
        alignItems: "center",
        gap: 10,
        minWidth: 0,
      }}
    >
      {/* Risk ID (persistent 001, 002, …) */}
      <span className={cellTextClass} title={risk.id}>
        {riskIdDisplay}
      </span>

      {/* Title + optional description hover card */}
      {readOnly ? (
        <div
          className="relative min-w-0"
          onMouseEnter={() => hasDescription && setShowDescCard(true)}
          onMouseLeave={() => setShowDescCard(false)}
        >
          <span className={`${cellTextClass} block`} title={risk.title}>
            {risk.title || "—"}
          </span>
          {hasDescription && showDescCard && (
            <div
              data-description-card
              role="tooltip"
              className="absolute left-0 bottom-full z-10 mb-1 max-w-[320px] rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-2 shadow-md text-xs text-neutral-700 dark:text-neutral-300"
              style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.1)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}
            >
              {truncateDescription(risk.description ?? "").split("\n").slice(0, 2).join(" ")}
            </div>
          )}
        </div>
      ) : (
        <RiskEditCell
          value={risk.title}
          placeholder="Risk title"
          onChange={(title) => updateRisk(risk.id, { title })}
        />
      )}

      {/* Category */}
      {readOnly ? (
        <span className={cellTextClass}>{formatCategoryLabel(risk.category)}</span>
      ) : (
        <select
          value={risk.category}
          onChange={(e) => updateRisk(risk.id, { category: e.target.value as RiskCategory })}
          style={selectStyle}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {formatCategoryLabel(c)}
            </option>
          ))}
        </select>
      )}

      {/* Owner */}
      {readOnly ? (
        <span className={cellMutedClass}>{risk.owner ?? "—"}</span>
      ) : (
        <RiskEditCell
          value={risk.owner ?? ""}
          placeholder="Owner"
          onChange={(owner) => updateRisk(risk.id, { owner: owner || undefined })}
        />
      )}

      {/* Pre Rating (L / M / H / E) — softer green for L */}
      <span
        title={`Inherent: ${risk.inherentRating.level} (score ${risk.inherentRating.score})`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 28,
          padding: "2px 6px",
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          backgroundColor: preStyle.bg,
          color: preStyle.text,
        }}
      >
        {preLetter}
      </span>

      {/* Post Rating (L / M / H / E) or N/A when no mitigation applied */}
      {risk.mitigation?.trim() ? (
        <span
          title={`Residual: ${risk.residualRating.level} (score ${risk.residualRating.score})`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 28,
            padding: "2px 6px",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            backgroundColor: postStyle.bg,
            color: postStyle.text,
          }}
        >
          {postLetter}
        </span>
      ) : (
        <span
          title="No mitigation applied"
          className={`inline-flex items-center justify-center min-w-[28px] py-0.5 px-1.5 rounded-md text-[13px] font-semibold ${MOVEMENT_PILL_CLASS_STABLE} opacity-80`}
        >
          N/A
        </span>
      )}

      {/* Mitigation Movement (coloured pill like Pre/Post; Improving/Worsening use post-rating low/high styles) */}
      <span
        title={movement === "↑" ? "Worsening" : movement === "↓" ? "Improving" : "Stable"}
        className={`inline-flex items-center justify-center min-w-[28px] py-0.5 px-1.5 rounded-md text-[13px] font-semibold ${movementPillClass} ${movement === "→" ? "opacity-80" : ""}`}
        style={movement === "↓" ? { backgroundColor: RATING_TABLE_LEVEL_STYLES.low.bg, color: RATING_TABLE_LEVEL_STYLES.low.text } : movement === "↑" ? { backgroundColor: RATING_TABLE_LEVEL_STYLES.high.bg, color: RATING_TABLE_LEVEL_STYLES.high.text } : undefined}
      >
        {movement}
      </span>

      {/* Status */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {readOnly ? (
          isDraft ? (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 shrink-0">
              Draft
            </span>
          ) : (
            <span className={cellTextClass}>{formatStatusLabel(risk.status)}</span>
          )
        ) : (
          <select
            value={risk.status}
            onChange={(e) => updateRisk(risk.id, { status: e.target.value as RiskStatus })}
            style={selectStyle}
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {formatStatusLabel(s)}
              </option>
            ))}
          </select>
        )}
      </div>

      {onRiskClick && (
        <div className="flex items-center justify-end min-w-0 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRiskClick(risk);
            }}
            className="px-2 py-1.5 text-xs font-medium rounded-md border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 shrink-0 whitespace-nowrap"
            title="View and edit details"
          >
            View / Edit
          </button>
        </div>
      )}
    </div>
  );
}