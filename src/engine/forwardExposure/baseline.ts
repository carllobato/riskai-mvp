/** Apply neutral baseline parameters to risk inputs (pure, deterministic). */

import type { Risk } from "@/domain/risk/risk.schema";
import { effectiveForwardCostImpact, probability01FromScale } from "@/domain/risk/risk.logic";
import type { BaselineMode } from "./types";
import type { AdjustedBaselineParams } from "./types";
import { safeNum, clamp01, clampNonNegative } from "./validate";

const DEFAULT_BASE_COST_IMPACT = 100_000;
const DEFAULT_ESCALATION_PERSISTENCE = 0.5;
const DEFAULT_SENSITIVITY = 0.5;

/** Neutral multipliers (identity). */
const BASELINE_MULTIPLIER = {
  probability: 1,
  impact: 1,
  persistence: 1,
  sensitivity: 1,
} as const;

/**
 * Effective multiplier gated by risk sensitivity: 1 + (m - 1) * clamp(sensitivity, 0, 1).
 * When sensitivity=0 -> 1 (no baseline delta). When sensitivity=1 -> m (full baseline multiplier).
 */
export function effectiveMultiplier(m: number, sensitivity: number): number {
  const s = Math.max(0, Math.min(1, sensitivity));
  return 1 + (m - 1) * s;
}

/**
 * Returns adjusted risk params for the given baseline mode.
 * Probability and impact are sensitivity-gated (effectiveMultiplier); when risk.sensitivity=0 they are unchanged.
 * Persistence and sensitivity in adjustedParams are also gated so sensitivity=0 -> no baseline delta anywhere.
 * All 0..1 outputs clamped; baseCostImpact non-negative; NaN/Infinity prevented.
 */
export function applyBaseline(risk: Risk, _baselineMode: BaselineMode): AdjustedBaselineParams {
  const m = BASELINE_MULTIPLIER;
  const riskSensitivity = clamp01(safeNum(risk.sensitivity, DEFAULT_SENSITIVITY));

  const probMultiplierEffective = effectiveMultiplier(m.probability, riskSensitivity);
  const impactMultiplierEffective = effectiveMultiplier(m.impact, riskSensitivity);
  const persistenceMultiplierEffective = effectiveMultiplier(m.persistence, riskSensitivity);
  const sensitivityMultiplierEffective = effectiveMultiplier(m.sensitivity, riskSensitivity);

  const defaultProb = probability01FromScale(risk.residualRating?.probability ?? risk.inherentRating?.probability ?? 3);
  const prob = clamp01(
    typeof risk.probability === "number" && Number.isFinite(risk.probability) ? risk.probability : defaultProb
  );
  const impact = clampNonNegative(effectiveForwardCostImpact(risk, DEFAULT_BASE_COST_IMPACT), DEFAULT_BASE_COST_IMPACT);
  const persistence = clamp01(safeNum(risk.escalationPersistence, DEFAULT_ESCALATION_PERSISTENCE));
  const sensitivity = clamp01(safeNum(risk.sensitivity, DEFAULT_SENSITIVITY));

  return {
    probability: clamp01(prob * probMultiplierEffective),
    baseCostImpact: Math.max(0, impact * impactMultiplierEffective),
    escalationPersistence: clamp01(persistence * persistenceMultiplierEffective),
    sensitivity: clamp01(sensitivity * sensitivityMultiplierEffective),
  };
}
