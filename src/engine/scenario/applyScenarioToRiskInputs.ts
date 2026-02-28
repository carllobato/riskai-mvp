/**
 * Single source of truth: apply scenario to risk inputs for both simulation and exposure.
 * Returns a NEW risk (no mutation). Uses sensitivity-gated multipliers from forward exposure.
 */

import type { Risk } from "@/domain/risk/risk.schema";
import { applyScenario } from "@/engine/forwardExposure/scenario";
import type { Scenario } from "@/engine/forwardExposure/types";

export type ScenarioId = Scenario;

/**
 * Applies scenario multipliers to the parameters used by simulation and exposure engines.
 * Incorporates sensitivity gating: effectiveMultiplier = 1 + (m - 1) * clamp(sensitivity, 0, 1).
 * Returns a new Risk object; does not mutate the input.
 */
export function applyScenarioToRiskInputs(risk: Risk, scenarioId: ScenarioId): Risk {
  const adjusted = applyScenario(risk, scenarioId);
  return {
    ...risk,
    probability: adjusted.probability,
    baseCostImpact: adjusted.baseCostImpact,
    /** Simulation uses costImpact for cost ML; align with baseCostImpact for scenario consistency. */
    costImpact: adjusted.baseCostImpact,
    escalationPersistence: adjusted.escalationPersistence,
    sensitivity: adjusted.sensitivity,
  };
}
