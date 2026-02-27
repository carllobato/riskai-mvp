/**
 * Portfolio-level aggregation of forward pressure from risk mitigation forecasts.
 */

import type { RiskMitigationForecast } from "@/domain/risk/risk-forecast.types";

export type PressureClass = "Low" | "Moderate" | "High" | "Severe";

export type PortfolioForwardPressure = {
  totalRisks: number;
  projectedCriticalCount: number;
  mitigationInsufficientCount: number;
  pctProjectedCritical: number;
  pctMitigationInsufficient: number;
  pressureClass: PressureClass;
};

const PRESSURE_LOW_MAX = 0.1;
const PRESSURE_MODERATE_MAX = 0.2;
const PRESSURE_HIGH_MAX = 0.35;

function safePct(count: number, total: number): number {
  if (total <= 0 || !Number.isFinite(total)) return 0;
  const n = Number.isFinite(count) ? Math.max(0, count) : 0;
  return n / total;
}

function pressureClassFromPct(pct: number): PressureClass {
  if (!Number.isFinite(pct) || pct < 0) return "Low";
  if (pct < PRESSURE_LOW_MAX) return "Low";
  if (pct <= PRESSURE_MODERATE_MAX) return "Moderate";
  if (pct <= PRESSURE_HIGH_MAX) return "High";
  return "Severe";
}

/**
 * Aggregates portfolio forward pressure from an array of risk mitigation forecasts.
 * Division-by-zero safe: when totalRisks is 0, percentages are 0 and pressureClass is Low.
 */
export function computePortfolioForwardPressure(
  risksWithForecasts: RiskMitigationForecast[]
): PortfolioForwardPressure {
  const totalRisks = risksWithForecasts.length;
  let projectedCriticalCount = 0;
  let mitigationInsufficientCount = 0;
  for (const f of risksWithForecasts) {
    if (f.baselineForecast.projectedCritical) projectedCriticalCount += 1;
    if (f.mitigationInsufficient) mitigationInsufficientCount += 1;
  }
  const pctProjectedCritical = safePct(projectedCriticalCount, totalRisks);
  const pctMitigationInsufficient = safePct(mitigationInsufficientCount, totalRisks);
  const pressureClass = pressureClassFromPct(pctProjectedCritical);

  return {
    totalRisks,
    projectedCriticalCount,
    mitigationInsufficientCount,
    pctProjectedCritical,
    pctMitigationInsufficient,
    pressureClass,
  };
}
