/**
 * Forward exposure engine — pure deterministic functions.
 * Day 12: mitigation adjustment, baseline mode, time weights, risk curve, portfolio exposure.
 */

export type {
  PressureClass,
  BaselineMode,
  ForwardExposureSummary,
  MitigationAdjustment,
  AdjustedBaselineParams,
  RiskExposureCurve,
  ExposureByCategory,
  TopDriver,
  Concentration,
  PortfolioExposure,
} from "./types";

export { computeMitigationAdjustment } from "./mitigation";
export { applyBaseline } from "./baseline";
export { buildTimeWeights } from "./timeWeights";
export { computeRiskExposureCurve } from "./curve";
export { computePortfolioExposure } from "./portfolio";
