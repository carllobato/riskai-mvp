/**
 * Validator for "RunnableRisk": a risk that has all required fields to be included in simulation.
 * Pre-mitigation fields are always required; post-mitigation required only when mitigation is enabled/present.
 * Does not change simulation math or outputs; used only for UI validation and disabling Run Simulation.
 * Draft risks are not runnable; we skip validation for them so they don't show runnable errors until saved.
 */

import type { Risk } from "./risk.schema";

/** Coerce to number for validation (handles string numbers from JSON/form). */
function toNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

/** Coerce to integer for time (days). */
function toInt(v: unknown): number {
  const n = toNum(v);
  return Number.isFinite(n) ? Math.floor(n) : NaN;
}

function inRangePct(n: number): boolean {
  return n >= 0 && n <= 100;
}

/**
 * Returns a list of validation error messages for the risk.
 * Pre-mitigation: title, probability% (0–100), cost min/ml/max (≥0, min≤ml≤max), time min/ml/max (same).
 * Post-mitigation: required only when risk.mitigation is present (non-empty string); same rules.
 * Draft risks are not validated (return no errors).
 */
export function getRiskValidationErrors(risk: Risk): string[] {
  if (risk.status === "draft") return [];

  const errors: string[] = [];

  if (!risk.title?.trim()) {
    errors.push("Title is required");
  }

  const prePct = toNum(risk.preMitigationProbabilityPct);
  if (!Number.isFinite(prePct) || !inRangePct(prePct)) {
    errors.push("Pre-mitigation probability % must be 0–100");
  }

  const preCostMin = toNum(risk.preMitigationCostMin);
  const preCostML = toNum(risk.preMitigationCostML);
  const preCostMax = toNum(risk.preMitigationCostMax);
  if (
    !Number.isFinite(preCostMin) ||
    !Number.isFinite(preCostML) ||
    !Number.isFinite(preCostMax) ||
    preCostMin < 0 ||
    preCostML < 0 ||
    preCostMax < 0 ||
    preCostMin > preCostML ||
    preCostML > preCostMax
  ) {
    errors.push("Pre-mitigation cost: min, most likely, and max required (≥0, min ≤ ML ≤ max)");
  }

  const preTimeMin = toInt(risk.preMitigationTimeMin);
  const preTimeML = toInt(risk.preMitigationTimeML);
  const preTimeMax = toInt(risk.preMitigationTimeMax);
  if (
    !Number.isFinite(preTimeMin) ||
    !Number.isFinite(preTimeML) ||
    !Number.isFinite(preTimeMax) ||
    preTimeMin < 0 ||
    preTimeML < 0 ||
    preTimeMax < 0 ||
    preTimeMin > preTimeML ||
    preTimeML > preTimeMax
  ) {
    errors.push("Pre-mitigation time (days): min, most likely, and max required (≥0, min ≤ ML ≤ max)");
  }

  const hasMitigation = Boolean(risk.mitigation?.trim());
  if (hasMitigation) {
    const postPct = toNum(risk.postMitigationProbabilityPct);
    if (!Number.isFinite(postPct) || !inRangePct(postPct)) {
      errors.push("Post-mitigation probability % must be 0–100 (mitigation is set)");
    }

    const postCostMin = toNum(risk.postMitigationCostMin);
    const postCostML = toNum(risk.postMitigationCostML);
    const postCostMax = toNum(risk.postMitigationCostMax);
    if (
      !Number.isFinite(postCostMin) ||
      !Number.isFinite(postCostML) ||
      !Number.isFinite(postCostMax) ||
      postCostMin < 0 ||
      postCostML < 0 ||
      postCostMax < 0 ||
      postCostMin > postCostML ||
      postCostML > postCostMax
    ) {
      errors.push("Post-mitigation cost: min, most likely, and max required (≥0, min ≤ ML ≤ max)");
    }

    const postTimeMin = toInt(risk.postMitigationTimeMin);
    const postTimeML = toInt(risk.postMitigationTimeML);
    const postTimeMax = toInt(risk.postMitigationTimeMax);
    if (
      !Number.isFinite(postTimeMin) ||
      !Number.isFinite(postTimeML) ||
      !Number.isFinite(postTimeMax) ||
      postTimeMin < 0 ||
      postTimeML < 0 ||
      postTimeMax < 0 ||
      postTimeMin > postTimeML ||
      postTimeML > postTimeMax
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
