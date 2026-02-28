/**
 * Apply scenario to risk params (pure, deterministic).
 * Uses safeNum/clamp so inputs are robust to missing or invalid values.
 */

import type { Risk } from "@/domain/risk/risk.schema";
import type { Scenario } from "./types";
import type { AdjustedRiskParams } from "./types";
import { safeNum, clamp01, clampNonNegative } from "./validate";

const DEFAULT_PROBABILITY = 0.5;
const DEFAULT_BASE_COST_IMPACT = 100_000;
const DEFAULT_ESCALATION_PERSISTENCE = 0.5;
const DEFAULT_SENSITIVITY = 0.5;

/** Scenario multipliers: conservative < 1, neutral = 1, aggressive > 1. Exported for dev introspection. */
export const SCENARIO_MULTIPLIERS: Record<
  Scenario,
  { probability: number; impact: number; persistence: number; sensitivity: number }
> = {
  conservative: { probability: 0.85, impact: 0.85, persistence: 0.9, sensitivity: 0.9 },
  neutral: { probability: 1, impact: 1, persistence: 1, sensitivity: 1 },
  aggressive: { probability: 1.15, impact: 1.15, persistence: 1.1, sensitivity: 1.1 },
};

/**
 * Effective multiplier gated by risk sensitivity: 1 + (m - 1) * clamp(sensitivity, 0, 1).
 * When sensitivity=0 → 1 (no scenario effect). When sensitivity=1 → m (full scenario effect).
 */
export function effectiveMultiplier(m: number, sensitivity: number): number {
  const s = Math.max(0, Math.min(1, sensitivity));
  return 1 + (m - 1) * s;
}

/**
 * Returns adjusted risk params for the given scenario.
 * Probability and impact are sensitivity-gated (effectiveMultiplier); when risk.sensitivity=0 they are unchanged.
 * Persistence and sensitivity in adjustedParams are also gated so sensitivity=0 ⇒ no scenario delta anywhere.
 * All 0..1 outputs clamped; baseCostImpact non-negative; NaN/Infinity prevented.
 */
export function applyScenario(risk: Risk, scenario: Scenario): AdjustedRiskParams {
  const m = SCENARIO_MULTIPLIERS[scenario]!;
  const riskSensitivity = clamp01(safeNum(risk.sensitivity, DEFAULT_SENSITIVITY));

  const probMultiplierEffective = effectiveMultiplier(m.probability, riskSensitivity);
  const impactMultiplierEffective = effectiveMultiplier(m.impact, riskSensitivity);
  const persistenceMultiplierEffective = effectiveMultiplier(m.persistence, riskSensitivity);
  const sensitivityMultiplierEffective = effectiveMultiplier(m.sensitivity, riskSensitivity);

  const prob = clamp01(safeNum(risk.probability, DEFAULT_PROBABILITY));
  const impact = clampNonNegative(risk.baseCostImpact ?? DEFAULT_BASE_COST_IMPACT, DEFAULT_BASE_COST_IMPACT);
  const persistence = clamp01(safeNum(risk.escalationPersistence, DEFAULT_ESCALATION_PERSISTENCE));
  const sensitivity = clamp01(safeNum(risk.sensitivity, DEFAULT_SENSITIVITY));

  return {
    probability: clamp01(prob * probMultiplierEffective),
    baseCostImpact: Math.max(0, impact * impactMultiplierEffective),
    escalationPersistence: clamp01(persistence * persistenceMultiplierEffective),
    sensitivity: clamp01(sensitivity * sensitivityMultiplierEffective),
  };
}
