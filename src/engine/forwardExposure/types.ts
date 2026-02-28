/**
 * Forward exposure engine — types.
 * Day 12: projection, scenario, and portfolio exposure.
 */

/** Placeholder: pressure class for portfolio forward exposure. */
export type PressureClass = "Low" | "Moderate" | "High" | "Severe";

/** Scenario for exposure (aligned with ProjectionProfile). */
export type Scenario = "conservative" | "neutral" | "aggressive";

/** Placeholder: scenario name for projection lens. */
export type ScenarioName = "Conservative" | "Neutral" | "Aggressive";

/** Placeholder: summary of forward exposure at portfolio level. */
export type ForwardExposureSummary = {
  pressureClass: PressureClass;
  projectedCriticalCount: number;
  pctProjectedCritical: number;
};

/** Result of computeMitigationAdjustment. */
export type MitigationAdjustment = {
  probMultiplier: number;
  impactMultiplier: number;
};

/** Risk params after applyScenario (adjusted for scenario). */
export type AdjustedRiskParams = {
  probability: number;
  baseCostImpact: number;
  escalationPersistence: number;
  sensitivity: number;
};

/** Result of computeRiskExposureCurve. */
export type RiskExposureCurve = {
  monthlyExposure: number[];
  total: number;
  debug?: {
    adjustedParams: AdjustedRiskParams;
    timeWeights: number[];
    mitigationByMonth: MitigationAdjustment[];
  };
};

/** Per-category exposure. */
export type ExposureByCategory = Record<string, number>;

/** Top driver: risk id + total exposure. */
export type TopDriver = { riskId: string; category: string; total: number };

/** Concentration: HHI (sum of squared shares, 0–1) and top-3 share (0–1). */
export type Concentration = {
  top3Share: number;
  hhi: number;
};

/** Result of computePortfolioExposure. */
export type PortfolioExposure = {
  monthlyTotal: number[];
  total: number;
  byCategory: ExposureByCategory;
  topDrivers: TopDriver[];
  concentration: Concentration;
  /** Diagnostic only: validation/clamping warnings from input sanitization. */
  debugWarnings?: string[];
  debug?: {
    riskCurves: Array<{ riskId: string; total: number; monthlyExposure: number[] }>;
  };
};
