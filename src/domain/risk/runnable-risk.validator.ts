/**
 * Validator for "RunnableRisk": a risk that has all required fields to be included in simulation.
 * Pre-mitigation fields are always required; post-mitigation required only when mitigation is enabled/present.
 * Does not change simulation math or outputs; used only for UI validation and disabling Run Simulation.
 */

import type { Risk } from "./risk.schema";

function isFiniteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function inRangePct(n: number): boolean {
  return n >= 0 && n <= 100;
}

/**
 * Returns a list of validation error messages for the risk.
 * Pre-mitigation: title, probability% (0–100), cost min/ml/max (≥0, min≤ml≤max), time min/ml/max (same).
 * Post-mitigation: required only when risk.mitigation is present (non-empty string); same rules.
 */
export function getRiskValidationErrors(risk: Risk): string[] {
  const errors: string[] = [];

  if (!risk.title?.trim()) {
    errors.push("Title is required");
  }

  const prePct = risk.preMitigationProbabilityPct;
  if (!isFiniteNum(prePct) || !inRangePct(prePct)) {
    errors.push("Pre-mitigation probability % must be 0–100");
  }

  const preCostMin = risk.preMitigationCostMin;
  const preCostML = risk.preMitigationCostML;
  const preCostMax = risk.preMitigationCostMax;
  if (
    !isFiniteNum(preCostMin) ||
    !isFiniteNum(preCostML) ||
    !isFiniteNum(preCostMax) ||
    preCostMin < 0 ||
    preCostML < 0 ||
    preCostMax < 0 ||
    preCostMin > preCostML ||
    preCostML > preCostMax
  ) {
    errors.push("Pre-mitigation cost: min, most likely, and max required (≥0, min ≤ ML ≤ max)");
  }

  const preTimeMin = risk.preMitigationTimeMin;
  const preTimeML = risk.preMitigationTimeML;
  const preTimeMax = risk.preMitigationTimeMax;
  if (
    !isFiniteNum(preTimeMin) ||
    !isFiniteNum(preTimeML) ||
    !isFiniteNum(preTimeMax) ||
    preTimeMin < 0 ||
    preTimeML < 0 ||
    preTimeMax < 0 ||
    Math.floor(preTimeMin) > Math.floor(preTimeML) ||
    Math.floor(preTimeML) > Math.floor(preTimeMax)
  ) {
    errors.push("Pre-mitigation time (days): min, most likely, and max required (≥0, min ≤ ML ≤ max)");
  }

  const hasMitigation = Boolean(risk.mitigation?.trim());
  if (hasMitigation) {
    const postPct = risk.postMitigationProbabilityPct;
    if (!isFiniteNum(postPct) || !inRangePct(postPct)) {
      errors.push("Post-mitigation probability % must be 0–100 (mitigation is set)");
    }

    const postCostMin = risk.postMitigationCostMin;
    const postCostML = risk.postMitigationCostML;
    const postCostMax = risk.postMitigationCostMax;
    if (
      !isFiniteNum(postCostMin) ||
      !isFiniteNum(postCostML) ||
      !isFiniteNum(postCostMax) ||
      postCostMin < 0 ||
      postCostML < 0 ||
      postCostMax < 0 ||
      postCostMin > postCostML ||
      postCostML > postCostMax
    ) {
      errors.push("Post-mitigation cost: min, most likely, and max required (≥0, min ≤ ML ≤ max)");
    }

    const postTimeMin = risk.postMitigationTimeMin;
    const postTimeML = risk.postMitigationTimeML;
    const postTimeMax = risk.postMitigationTimeMax;
    if (
      !isFiniteNum(postTimeMin) ||
      !isFiniteNum(postTimeML) ||
      !isFiniteNum(postTimeMax) ||
      postTimeMin < 0 ||
      postTimeML < 0 ||
      postTimeMax < 0 ||
      Math.floor(postTimeMin) > Math.floor(postTimeML) ||
      Math.floor(postTimeML) > Math.floor(postTimeMax)
    ) {
      errors.push("Post-mitigation time (days): min, most likely, and max required (≥0, min ≤ ML ≤ max)");
    }
  }

  return errors;
}

/**
 * Returns true if the risk has all required fields for simulation (RunnableRisk).
 * Pre-mitigation: title, probability% 0–100, cost min/ml/max ≥0 and min≤ml≤max, time min/ml/max same.
 * Post-mitigation: required only when mitigation is enabled/present.
 */
export function isRiskValid(risk: Risk): boolean {
  return getRiskValidationErrors(risk).length === 0;
}
