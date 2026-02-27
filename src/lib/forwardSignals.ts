/**
 * Adapter: per-risk forward projection signals for UI (no forecast recomputation).
 * Uses existing riskForecastsById from store; returns defaults when data is missing.
 * Includes display normalization for already-critical risks.
 */

import type { RiskMitigationForecast } from "@/domain/risk/risk-forecast.types";
import type { EscalationBand } from "@/config/riskThresholds";
import { getBand } from "@/config/riskThresholds";

/**
 * True if the risk is already in the critical band (score >= 80 or band === 'critical').
 */
export function isCurrentlyCritical(scoreOrBand: number | EscalationBand): boolean {
  if (typeof scoreOrBand === "number") return getBand(scoreOrBand) === "critical";
  return scoreOrBand === "critical";
}

/** Raw forecast summary as stored (for display normalization only). */
export type ForecastSummaryForDisplay = {
  crossesCritical: boolean;
  timeToCriticalBaseline: number | null;
  timeToCriticalMitigated: number | null;
  mitigationInsufficient: boolean;
  projectedPeakBand: EscalationBand;
};

/** Normalized strings for UI when showing forecast (already-critical vs not). */
export type NormalizedForecastDisplay = {
  peakBandDisplay: EscalationBand;
  crossesCriticalDisplay: string;
  ttCBaselineDisplay: string;
  ttCMitigatedDisplay: string;
  mitigationInsufficientDisplay: string;
};

/**
 * Presentation transform: for already-critical risks, show "— (already critical)", TtC 0, and consistent mitigation copy.
 * Does not change stored forecast values.
 */
export function normalizeForecastForDisplay(
  currentBand: EscalationBand,
  summary: ForecastSummaryForDisplay
): NormalizedForecastDisplay {
  const critical = currentBand === "critical";
  return {
    peakBandDisplay: summary.projectedPeakBand,
    crossesCriticalDisplay: critical ? "— (already critical)" : summary.crossesCritical ? "Yes" : "No",
    ttCBaselineDisplay: critical ? "0" : summary.timeToCriticalBaseline != null ? `${summary.timeToCriticalBaseline} cycles` : "—",
    ttCMitigatedDisplay: critical ? "0" : summary.timeToCriticalMitigated != null ? `${summary.timeToCriticalMitigated} cycles` : "—",
    mitigationInsufficientDisplay: critical
      ? (summary.mitigationInsufficient ? "YES (remains critical)" : "—")
      : (summary.mitigationInsufficient ? "Yes" : "No"),
  };
}

export type ForwardSignals = {
  projectedCritical: boolean;
  timeToCritical: number | null;
  mitigationInsufficient: boolean;
  projectedPeakBand: EscalationBand;
  hasForecast: boolean;
  /** Forecast confidence 0–100 (contextual only). */
  forecastConfidence?: number;
  /** Low <40, medium 40–69, high ≥70. */
  confidenceBand?: "low" | "medium" | "high";
  /** True when history had fewer than 2 snapshots. */
  insufficientHistory?: boolean;
};

const DEFAULTS: ForwardSignals = {
  projectedCritical: false,
  timeToCritical: null,
  mitigationInsufficient: false,
  projectedPeakBand: "normal",
  hasForecast: false,
};

function projectedPeakBandFromForecast(forecast: RiskMitigationForecast): EscalationBand {
  const points = forecast.baselineForecast.points;
  if (!points.length) return "normal";
  let maxScore = 0;
  for (const p of points) {
    if (p.projectedScore > maxScore) maxScore = p.projectedScore;
  }
  return getBand(maxScore);
}

/**
 * Returns forward projection signals for a risk from precomputed forecasts.
 * If no forecast exists for the risk, returns hasForecast=false and safe defaults.
 */
export function getForwardSignals(
  riskId: string,
  riskForecastsById: Record<string, RiskMitigationForecast>
): ForwardSignals {
  const forecast = riskForecastsById[riskId];
  if (!forecast) return DEFAULTS;

  const baseline = forecast.baselineForecast;
  return {
    projectedCritical: baseline.projectedCritical ?? false,
    timeToCritical: baseline.timeToCritical ?? null,
    mitigationInsufficient: forecast.mitigationInsufficient ?? false,
    projectedPeakBand: projectedPeakBandFromForecast(forecast),
    hasForecast: true,
    forecastConfidence: forecast.forecastConfidence,
    confidenceBand: forecast.confidenceBand,
    insufficientHistory: forecast.insufficientHistory,
  };
}
