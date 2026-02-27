/**
 * Portfolio-level aggregation of forward pressure from risk mitigation forecasts.
 */

import type { RiskMitigationForecast } from "@/domain/risk/risk-forecast.types";
import type { ProjectionProfile } from "@/lib/projectionProfiles";

export type PressureClass = "Low" | "Moderate" | "High" | "Severe";

export type PortfolioForwardPressure = {
  totalRisks: number;
  projectedCriticalCount: number;
  mitigationInsufficientCount: number;
  pctProjectedCritical: number;
  pctMitigationInsufficient: number;
  pressureClass: PressureClass;
  /** Profile used for the projections that produced this aggregate (traceability). */
  projectionProfileUsed?: ProjectionProfile;
  /** Confidence-weighted variant (same shape; counts/percentages downweighted by forecastConfidence). */
  forwardPressureWeighted?: PortfolioForwardPressure;
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

/** Weight from forecastConfidence; if missing use 0.5 (medium uncertainty so risk still contributes partially). */
function confidenceWeight(forecastConfidence: number | undefined): number {
  if (typeof forecastConfidence !== "number" || !Number.isFinite(forecastConfidence))
    return 0.5;
  return Math.max(0, Math.min(1, forecastConfidence / 100));
}

/**
 * Aggregates portfolio forward pressure from an array of risk mitigation forecasts.
 * Raw: unweighted counts and percentages (unchanged; primary value).
 * Weighted: each risk's contribution multiplied by w = clamp(forecastConfidence/100, 0, 1);
 *   missing forecastConfidence → w = 0.5 (medium uncertainty).
 * Division-by-zero safe: when totalRisks is 0, percentages are 0 and pressureClass is Low.
 * When profile is provided, sets projectionProfileUsed on the result (traceability).
 */
export function computePortfolioForwardPressure(
  risksWithForecasts: RiskMitigationForecast[],
  profile?: ProjectionProfile
): PortfolioForwardPressure {
  const totalRisks = risksWithForecasts.length;
  let projectedCriticalCount = 0;
  let mitigationInsufficientCount = 0;
  let weightedProjectedCriticalSum = 0;
  let weightedMitigationSum = 0;

  for (const f of risksWithForecasts) {
    const projectedCritical = f.baselineForecast.projectedCritical;
    const mitigationInsufficient = f.mitigationInsufficient;
    if (projectedCritical) projectedCriticalCount += 1;
    if (mitigationInsufficient) mitigationInsufficientCount += 1;
    const w = confidenceWeight(f.forecastConfidence);
    weightedProjectedCriticalSum += (projectedCritical ? 1 : 0) * w;
    weightedMitigationSum += (mitigationInsufficient ? 1 : 0) * w;
  }

  const pctProjectedCritical = safePct(projectedCriticalCount, totalRisks);
  const pctMitigationInsufficient = safePct(mitigationInsufficientCount, totalRisks);
  const pressureClass = pressureClassFromPct(pctProjectedCritical);

  const pctProjectedCriticalWeighted = safePct(weightedProjectedCriticalSum, totalRisks);
  const pctMitigationInsufficientWeighted = safePct(weightedMitigationSum, totalRisks);
  const pressureClassWeighted = pressureClassFromPct(pctProjectedCriticalWeighted);

  const forwardPressureWeighted: PortfolioForwardPressure = {
    totalRisks,
    projectedCriticalCount: weightedProjectedCriticalSum,
    mitigationInsufficientCount: weightedMitigationSum,
    pctProjectedCritical: pctProjectedCriticalWeighted,
    pctMitigationInsufficient: pctMitigationInsufficientWeighted,
    pressureClass: pressureClassWeighted,
    ...(profile != null && { projectionProfileUsed: profile }),
  };

  return {
    totalRisks,
    projectedCriticalCount,
    mitigationInsufficientCount,
    pctProjectedCritical,
    pctMitigationInsufficient,
    pressureClass,
    ...(profile != null && { projectionProfileUsed: profile }),
    forwardPressureWeighted,
  };
}
