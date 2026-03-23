/**
 * Single-risk exposure curve (pure, deterministic).
 */

import type { Risk } from "@/domain/risk/risk.schema";
import type { BaselineMode } from "./types";
import type { RiskExposureCurve } from "./types";
import { applyBaseline } from "./baseline";
import { buildTimeWeights } from "./timeWeights";
import { computeMitigationAdjustment } from "./mitigation";

/**
 * Computes monthly exposure curve for one risk under the neutral baseline.
 * monthlyExposure[i] = adjustedProb * adjustedImpact * timeWeight[i] * probMultiplier[i] * impactMultiplier[i].
 * When options.__introspect is true, debug includes raw and adjusted params (dev-only).
 */
export function computeRiskExposureCurve(
  risk: Risk,
  baselineMode: BaselineMode,
  horizonMonths: number,
  options?: { includeDebug?: boolean; __introspect?: boolean }
): RiskExposureCurve {
  const adjustedParams = applyBaseline(risk, baselineMode);
  const timeWeights = buildTimeWeights(risk, horizonMonths);

  const monthlyExposure: number[] = [];
  const mitigationByMonth: Array<{ probMultiplier: number; impactMultiplier: number }> = [];

  for (let m = 0; m < horizonMonths; m++) {
    const adj = computeMitigationAdjustment(risk, m);
    mitigationByMonth.push(adj);
    const w = timeWeights[m] ?? 0;
    const exposure =
      adjustedParams.probability *
      adjustedParams.baseCostImpact *
      w *
      adj.probMultiplier *
      adj.impactMultiplier;
    monthlyExposure.push(Number.isFinite(exposure) ? exposure : 0);
  }

  let total = monthlyExposure.reduce((s, v) => s + v, 0);
  if (!Number.isFinite(total)) total = 0;

  const result: RiskExposureCurve = {
    monthlyExposure: monthlyExposure.map((v) => (Number.isFinite(v) ? v : 0)),
    total,
  };

  if (options?.includeDebug || options?.__introspect) {
    result.debug = {
      adjustedParams,
      timeWeights,
      mitigationByMonth,
    };
    if (options?.__introspect) {
      (result.debug as Record<string, unknown>).baselineMode = baselineMode;
      (result.debug as Record<string, unknown>).rawParams = {
        probability: risk.probability,
        preMitigationCostML: risk.preMitigationCostML,
        postMitigationCostML: risk.postMitigationCostML,
        escalationPersistence: risk.escalationPersistence,
        sensitivity: risk.sensitivity,
      };
    }
  }

  return result;
}
