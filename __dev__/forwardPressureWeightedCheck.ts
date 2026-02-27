/**
 * Minimal check: confidence-weighted forward pressure is lower than raw when low confidence dominates.
 * Run from repo root: npx tsx __dev__/forwardPressureWeightedCheck.ts
 */

import type { RiskMitigationForecast } from "../src/domain/risk/risk-forecast.types";
import { computePortfolioForwardPressure } from "../src/lib/portfolioForwardPressure";

function run(): number {
  // Two risks, both projected critical; one high confidence (85), one low (25).
  const highConf: RiskMitigationForecast = {
    riskId: "high",
    baselineForecast: {
      riskId: "high",
      horizon: 5,
      points: [],
      timeToCritical: 2,
      crossesCriticalWithinWindow: true,
      projectedCritical: true,
    },
    mitigatedForecast: {
      riskId: "high",
      horizon: 5,
      points: [],
      timeToCritical: 3,
      crossesCriticalWithinWindow: true,
      projectedCritical: true,
    },
    mitigationInsufficient: true,
    timeToCriticalBaseline: 2,
    timeToCriticalMitigated: 3,
    forecastConfidence: 85,
    confidenceBand: "high",
    projectionProfileUsed: "neutral",
  };

  const lowConf: RiskMitigationForecast = {
    riskId: "low",
    baselineForecast: {
      riskId: "low",
      horizon: 5,
      points: [],
      timeToCritical: 4,
      crossesCriticalWithinWindow: true,
      projectedCritical: true,
    },
    mitigatedForecast: {
      riskId: "low",
      horizon: 5,
      points: [],
      timeToCritical: 5,
      crossesCriticalWithinWindow: true,
      projectedCritical: true,
    },
    mitigationInsufficient: true,
    timeToCriticalBaseline: 4,
    timeToCriticalMitigated: 5,
    forecastConfidence: 25,
    confidenceBand: "low",
    projectionProfileUsed: "neutral",
  };

  const result = computePortfolioForwardPressure([highConf, lowConf], "neutral");
  const raw = result.pctProjectedCritical;
  const weighted = result.forwardPressureWeighted?.pctProjectedCritical;

  if (weighted == null) {
    console.error("[forwardPressureWeightedCheck] FAIL: forwardPressureWeighted missing.");
    return 1;
  }
  if (raw <= weighted) {
    console.error(
      "[forwardPressureWeightedCheck] FAIL: expected weighted < raw when low confidence dominates. raw=",
      raw,
      "weighted=",
      weighted
    );
    return 1;
  }
  console.log(
    "[forwardPressureWeightedCheck] OK: weighted (",
    weighted,
    ") < raw (",
    raw,
    ") when low confidence dominates."
  );
  return 0;
}

process.exit(run());
