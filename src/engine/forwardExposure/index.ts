/**
 * Forward exposure engine — pure deterministic functions.
 * Day 12: mitigation adjustment, scenario, time weights, risk curve, portfolio exposure.
 */

export type {
  PressureClass,
  Scenario,
  ScenarioName,
  ForwardExposureSummary,
  MitigationAdjustment,
  AdjustedRiskParams,
  RiskExposureCurve,
  ExposureByCategory,
  TopDriver,
  Concentration,
  PortfolioExposure,
} from "./types";

export { computeMitigationAdjustment } from "./mitigation";
export { applyScenario } from "./scenario";
export { buildTimeWeights } from "./timeWeights";
export { computeRiskExposureCurve } from "./curve";
export { computePortfolioExposure } from "./portfolio";
