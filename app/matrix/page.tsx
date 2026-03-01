"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRiskRegister } from "@/store/risk-register.store";
import { useProjectionScenario } from "@/context/ProjectionScenarioContext";
import { LEVEL_STYLES } from "@/components/risk-register/RiskLevelBadge";
import type { Risk, RiskLevel } from "@/domain/risk/risk.schema";

const PROBABILITY = [1, 2, 3, 4, 5] as const;
const CONSEQUENCE = [1, 2, 3, 4, 5] as const;

const SEVERITY_LEGEND_ORDER: RiskLevel[] = ["low", "medium", "high", "extreme"];

/** Static (P,C) -> severity for cell heat tint only. Matches buildRating thresholds: score 1-4 low, 5-9 medium, 10-16 high, 17-25 extreme. */
const CELL_SEVERITY: Record<number, RiskLevel> = {
  1: "low",
  2: "low",
  3: "low",
  4: "low",
  5: "low",
  6: "medium",
  7: "medium",
  8: "medium",
  9: "medium",
  10: "medium",
  11: "high",
  12: "high",
  13: "high",
  14: "high",
  15: "high",
  16: "high",
  17: "extreme",
  18: "extreme",
  19: "extreme",
  20: "extreme",
  21: "extreme",
  22: "extreme",
  23: "extreme",
  24: "extreme",
  25: "extreme",
};

/** Subtle cell background tint by severity (UI only). Low opacity for light and dark. */
const HEAT_TINT: Record<RiskLevel, string> = {
  low: "rgba(34, 197, 94, 0.08)",
  medium: "rgba(234, 179, 8, 0.1)",
  high: "rgba(239, 68, 68, 0.08)",
  extreme: "rgba(127, 29, 29, 0.12)",
};

const CELL_MIN_HEIGHT = 72;

type MatrixMode = "Inherent" | "Residual";

const MAX_TITLE_LEN = 16;
const MAX_CHIPS_VISIBLE = 6;
const CHIP_MAX_W = 80;

const VALID_PC = { min: 1, max: 5 };

function getCellSeverity(p: number, c: number): RiskLevel {
  const score = p * c;
  return CELL_SEVERITY[score] ?? "low";
}

function chipLabel(risk: Risk): string {
  if (risk.title.length <= MAX_TITLE_LEN) return risk.title;
  return risk.id.slice(0, 8);
}

function isPlottable(risk: Risk, mode: MatrixMode): boolean {
  const r = mode === "Inherent" ? risk.inherentRating : risk.residualRating;
  const p = r.probability;
  const c = r.consequence;
  return (
    typeof p === "number" &&
    p >= VALID_PC.min &&
    p <= VALID_PC.max &&
    typeof c === "number" &&
    c >= VALID_PC.min &&
    c <= VALID_PC.max
  );
}

export default function RiskMatrixPage() {
  const router = useRouter();
  const { uiMode } = useProjectionScenario();
  const { risks } = useRiskRegister();
  const count = risks.length;
  const [mode, setMode] = useState<MatrixMode>("Inherent");
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());

  // Risk Matrix is hidden in MVP mode; redirect to Outputs
  useEffect(() => {
    if (uiMode === "MVP") router.replace("/outputs");
  }, [uiMode, router]);

  const { plottableCount, unplottableCount, risksByCell } = useMemo(() => {
    if (uiMode === "MVP") {
      return { plottableCount: 0, unplottableCount: 0, risksByCell: new Map<string, Risk[]>() };
    }
    let plottable = 0;
    let unplottable = 0;
    const map = new Map<string, Risk[]>();
    for (const p of PROBABILITY) {
      for (const c of CONSEQUENCE) {
        map.set(`${p}-${c}`, []);
      }
    }
    for (const risk of risks) {
      if (isPlottable(risk, mode)) {
        plottable++;
        const rating = mode === "Inherent" ? risk.inherentRating : risk.residualRating;
        const key = `${rating.probability}-${rating.consequence}`;
        const list = map.get(key);
        if (list) list.push(risk);
      } else {
        unplottable++;
      }
    }
    return { plottableCount: plottable, unplottableCount: unplottable, risksByCell: map };
  }, [risks, mode, uiMode]);

  const toggleCellExpanded = (cellKey: string) => {
    setExpandedCells((prev) => {
      const next = new Set(prev);
      if (next.has(cellKey)) next.delete(cellKey);
      else next.add(cellKey);
      return next;
    });
  };

  if (uiMode === "MVP") return null;

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold m-0">Risk Matrix</h1>
      <p className="mt-1.5 opacity-80">
        Visual validation of risk positions (no scoring logic).
      </p>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-600 dark:text-neutral-400">
        <span>Risks loaded: {count}</span>
        <span>Plotted: {plottableCount}</span>
        <span>Unplottable: {unplottableCount}</span>
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div
          className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 p-0.5"
          role="group"
          aria-label="Inherent or Residual"
        >
          <button
            type="button"
            onClick={() => setMode("Inherent")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === "Inherent"
                ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm dark:bg-neutral-700"
                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
            }`}
          >
            Inherent
          </button>
          <button
            type="button"
            onClick={() => setMode("Residual")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === "Residual"
                ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm dark:bg-neutral-700"
                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
            }`}
          >
            Residual
          </button>
        </div>
        <span className="text-xs text-neutral-500">Mode: {mode}</span>
        <div className="flex flex-wrap items-center gap-2" role="list" aria-label="Severity legend">
          {SEVERITY_LEGEND_ORDER.map((level) => {
            const s = LEVEL_STYLES[level];
            const label = level.charAt(0).toUpperCase() + level.slice(1);
            return (
              <span
                key={level}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: s.bg, color: s.text }}
              >
                <span
                  className="h-1 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: s.dot }}
                />
                {label}
              </span>
            );
          })}
        </div>
      </div>

      <div className="mt-8 w-full max-w-5xl">
        {/* Option A: outer 2x2 grid — [headerCol, matrixCol] x [headerRow, matrixRow]. Only the 5x5 has heat/cells. */}
        <div
          className="grid w-full gap-px rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-200 dark:bg-neutral-700 p-px"
          style={{
            gridTemplateColumns: "2.5rem 1fr",
            gridTemplateRows: "auto auto",
            gridTemplateAreas: '"corner topHeader" "leftHeader matrix"',
          }}
        >
          {/* (0,0) Corner — empty header cell */}
          <div
            className="min-h-[28px] min-w-[2.5rem] rounded-sm bg-neutral-100 dark:bg-neutral-800"
            style={{ gridArea: "corner" }}
          />
          {/* (1,0) Top header row — Consequence 1..5, own row, 5 equal columns aligned with matrix */}
          <div
            className="grid min-h-[28px] grid-cols-5 gap-px"
            style={{ gridArea: "topHeader" }}
          >
            {CONSEQUENCE.map((c) => (
              <div
                key={`h-${c}`}
                className="flex items-center justify-center rounded-sm bg-neutral-100 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
              >
                {c}
              </div>
            ))}
          </div>
          {/* (0,1) Left header column — Probability 5..1, own column, 5 rows aligned with matrix */}
          <div
            className="grid gap-px"
            style={{
              gridArea: "leftHeader",
              gridTemplateRows: "repeat(5, minmax(72px, auto))",
            }}
          >
            {PROBABILITY.map((p) => (
              <div
                key={`p-${p}`}
                className="flex items-center justify-center rounded-sm bg-neutral-100 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
              >
                {p}
              </div>
            ))}
          </div>
          {/* (1,1) 5x5 matrix only — heat shading and chips live here */}
          <div
            className="grid grid-cols-5 gap-px"
            style={{
              gridArea: "matrix",
              gridTemplateRows: "repeat(5, minmax(72px, auto))",
            }}
          >
            {PROBABILITY.flatMap((p) =>
              CONSEQUENCE.map((c) => {
                const cellKey = `${p}-${c}`;
                const cellRisks = risksByCell.get(cellKey) ?? [];
                const isExpanded = expandedCells.has(cellKey);
                const visibleRisks =
                  cellRisks.length <= MAX_CHIPS_VISIBLE || isExpanded
                    ? cellRisks
                    : cellRisks.slice(0, MAX_CHIPS_VISIBLE);
                const overflowCount = cellRisks.length - MAX_CHIPS_VISIBLE;
                const showMore = overflowCount > 0 && !isExpanded;
                const heatLevel = getCellSeverity(p, c);
                const tint = HEAT_TINT[heatLevel];

                return (
                  <div
                    key={cellKey}
                    className="flex min-h-[72px] min-w-0 w-full flex-col overflow-hidden rounded-sm border border-neutral-200 bg-[var(--background)] p-1.5 dark:border-neutral-700"
                    style={{ backgroundColor: tint }}
                  >
                    <div className="flex min-h-0 flex-1 flex-wrap content-start gap-1.5 overflow-auto">
                      {visibleRisks.map((risk) => {
                        const r = mode === "Inherent" ? risk.inherentRating : risk.residualRating;
                        const s = LEVEL_STYLES[r.level];
                        return (
                          <Link
                            key={risk.id}
                            href={`/risk-register?focusRiskId=${encodeURIComponent(risk.id)}`}
                            className="shrink-0 truncate rounded px-1.5 py-0.5 text-[10px] font-medium no-underline transition-opacity hover:opacity-90"
                            style={{
                              backgroundColor: s.bg,
                              color: s.text,
                              maxWidth: CHIP_MAX_W,
                            }}
                            title={risk.title}
                          >
                            {chipLabel(risk)}
                          </Link>
                        );
                      })}
                      {showMore && (
                        <button
                          type="button"
                          onClick={() => toggleCellExpanded(cellKey)}
                          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
                        >
                          +{overflowCount} more
                        </button>
                      )}
                      {isExpanded && cellRisks.length > MAX_CHIPS_VISIBLE && (
                        <button
                          type="button"
                          onClick={() => toggleCellExpanded(cellKey)}
                          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
                        >
                          Less
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-neutral-500">
          Consequence →
        </p>
      </div>
    </main>
  );
}
