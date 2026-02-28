/**
 * Types for bounded forward projection of risk composite scores.
 */

import type { ScenarioDeltaSummary, InstabilityResult, FragilityResult } from "@/types/instability";

export type ForecastPoint = {
  step: number;
  projectedScore: number;
  projectedDeltaFromNow: number;
  confidence: number;
};

export type RiskForecast = {
  riskId: string;
  horizon: number;
  points: ForecastPoint[];
  /** First step (1-based) at which projected score reaches critical band, or null if never. */
  timeToCritical: number | null;
  /** True if any projected point in the window is in the critical band. */
  crossesCriticalWithinWindow: boolean;
  /** True when current band is not critical but projection crosses into critical within the window. */
  projectedCritical: boolean;
};

/** Confidence band for forecast confidence score: low < 40, medium 40–69, high ≥ 70. */
export type ConfidenceBand = "low" | "medium" | "high";

/** Result of mitigation stress testing: baseline (no mitigation) and mitigated forecasts with derived flags. */
export type RiskMitigationForecast = {
  riskId: string;
  baselineForecast: RiskForecast;
  mitigatedForecast: RiskForecast;
  /** True when the mitigated forecast still crosses into critical within the horizon (mitigation insufficient). */
  mitigationInsufficient: boolean;
  /** First step to critical in baseline projection, or null. */
  timeToCriticalBaseline: number | null;
  /** First step to critical in mitigated projection, or null. */
  timeToCriticalMitigated: number | null;
  /** Forecast confidence 0–100 derived from history depth, stability, and volatility (contextual only). */
  forecastConfidence: number;
  /** Band for forecast confidence: low < 40, medium 40–69, high ≥ 70. */
  confidenceBand?: ConfidenceBand;
  /** Debug-only breakdown; present when DEBUG_FORWARD_PROJECTION is true. */
  confidenceBreakdown?: {
    depthScore: number;
    stabilityScore: number;
    volatilityPenalty: number;
    window: number;
  };
  /** Profile used for this projection (traceability). */
  projectionProfileUsed: "conservative" | "neutral" | "aggressive";
  /** True when history had fewer than 2 snapshots (for UI tooltip). */
  insufficientHistory?: boolean;
  /** Day 11: scenario TTC deltas (conservative/neutral/aggressive). */
  scenarioDeltaSummary?: ScenarioDeltaSummary;
  /** Day 11 A4: TTC per scenario for display lens (display-layer only). */
  scenarioTTC?: {
    conservative: number | null;
    neutral: number | null;
    aggressive: number | null;
  };
  /** Day 11: Escalation Instability Index result. */
  instability?: InstabilityResult;
  /** Structural fragility score (EII + delta + confidence). */
  fragility?: FragilityResult;
  /** Early warning: high EII with non-imminent TTC or low confidence. */
  earlyWarning?: boolean;
  /** Reason strings for early warning (when earlyWarning is true). */
  earlyWarningReason?: string[];
}
