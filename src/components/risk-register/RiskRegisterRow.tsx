"use client";

import { useState } from "react";
import type { Risk, RiskCategory, RiskLevel, RiskStatus } from "@/domain/risk/risk.schema";
import type { DecisionMetrics } from "@/domain/decision/decision.types";
import { useRiskRegister } from "@/store/risk-register.store";
import { RiskEditCell } from "@/components/risk-register/RiskEditCell";
import { RATING_TABLE_LEVEL_STYLES } from "@/components/risk-register/RiskLevelBadge";

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

const statuses: RiskStatus[] = ["draft", "open", "monitoring", "mitigating", "closed", "archived"];

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

const DESCRIPTION_TOOLTIP_MAX_LEN = 140;

function truncateDescription(desc: string): string {
  const t = desc.trim();
  if (t.length <= DESCRIPTION_TOOLTIP_MAX_LEN) return t;
  return t.slice(0, DESCRIPTION_TOOLTIP_MAX_LEN).trimEnd() + "…";
}

export function RiskRegisterRow({
  risk,
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
              className="absolute left-0 top-full z-10 mt-1 w-max min-w-0 max-w-[320px] rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-2 shadow-md text-xs text-neutral-700 dark:text-neutral-300 whitespace-normal"
              style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
            >
              {truncateDescription(risk.description ?? "").split("\n").join(" ")}
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
        <span className={cellTextClass}>{risk.owner ?? "—"}</span>
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