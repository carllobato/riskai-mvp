/**
 * Single-risk exposure curve (pure, deterministic).
 */

import type { Risk } from "@/domain/risk/risk.schema";
import type { Scenario } from "./types";
import type { RiskExposureCurve } from "./types";
import { applyScenario, effectiveMultiplier, SCENARIO_MULTIPLIERS } from "./scenario";
import { buildTimeWeights } from "./timeWeights";
import { computeMitigationAdjustment } from "./mitigation";

/**
 * Computes monthly exposure curve for one risk under a scenario.
 * monthlyExposure[i] = adjustedProb * adjustedImpact * timeWeight[i] * probMultiplier[i] * impactMultiplier[i].
 * When options.__introspect is true, debug includes scenario multipliers and raw vs adjusted params (dev-only).
 */
export function computeRiskExposureCurve(
  risk: Risk,
  scenario: Scenario,
  horizonMonths: number,
  options?: { includeDebug?: boolean; __introspect?: boolean }
): RiskExposureCurve {
  const adjustedParams = applyScenario(risk, scenario);
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
      const m = SCENARIO_MULTIPLIERS[scenario]!;
      const riskSens = risk.sensitivity ?? 0.5;
      (result.debug as Record<string, unknown>).rawMultipliers = m;
      (result.debug as Record<string, unknown>).effectiveMultipliers = {
        probability: effectiveMultiplier(m.probability, riskSens),
        impact: effectiveMultiplier(m.impact, riskSens),
        persistence: effectiveMultiplier(m.persistence, riskSens),
        sensitivity: effectiveMultiplier(m.sensitivity, riskSens),
      };
      (result.debug as Record<string, unknown>).scenarioMultipliers = m;
      (result.debug as Record<string, unknown>).rawParams = {
        probability: risk.probability,
        baseCostImpact: risk.baseCostImpact,
        escalationPersistence: risk.escalationPersistence,
        sensitivity: risk.sensitivity,
      };
    }
  }

  return result;
}
