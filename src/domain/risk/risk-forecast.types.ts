/**
 * Types for bounded forward projection of risk composite scores.
 */

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
};
