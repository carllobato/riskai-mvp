/**
 * Forward exposure engine — types.
 * Day 12: projection, baseline mode, and portfolio exposure.
 */

/** Placeholder: pressure class for portfolio forward exposure. */
export type PressureClass = "Low" | "Moderate" | "High" | "Severe";

/** Neutral-only baseline mode for exposure engine. */
export type BaselineMode = "neutral";

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

/** Risk params after applyBaseline (adjusted for baseline mode). */
export type AdjustedBaselineParams = {
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
    adjustedParams: AdjustedBaselineParams;
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
