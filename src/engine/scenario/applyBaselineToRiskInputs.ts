/**
 * Single source of truth: apply neutral baseline shaping to risk inputs for simulation and exposure.
 * Returns a NEW risk (no mutation). Uses sensitivity-gated multipliers from forward exposure.
 */

import type { Risk } from "@/domain/risk/risk.schema";
import { applyBaseline } from "@/engine/forwardExposure/baseline";
import type { BaselineMode } from "@/engine/forwardExposure/types";

export type BaselineModeId = BaselineMode;

/**
 * Applies baseline multipliers to parameters used by simulation and exposure engines.
 * Incorporates sensitivity gating: effectiveMultiplier = 1 + (m - 1) * clamp(sensitivity, 0, 1).
 * Returns a new Risk object; does not mutate the input.
 */
export function applyBaselineToRiskInputs(risk: Risk, baselineMode: BaselineModeId): Risk {
  const adjusted = applyBaseline(risk, baselineMode);
  return {
    ...risk,
    probability: adjusted.probability,
    escalationPersistence: adjusted.escalationPersistence,
    sensitivity: adjusted.sensitivity,
  };
}
