/**
 * Day 11 — Escalation Instability Index (EII) calculator.
 * Pure functions; no side effects.
 */

import type {
  InstabilityInputs,
  InstabilityBreakdown,
  InstabilityResult,
  ScenarioDeltaSummary,
  FragilityResult,
  FragilityLevel,
} from "@/types/instability";

/** Clamp value to [0, 1] after normalizing from [min, max]. */
export function normalize01(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  const t = (value - min) / (max - min);
  return Math.max(0, Math.min(1, t));
}

/** TTC values; null means does not cross within horizon (treat as 90 for spread math). */
export type ScenarioTTCInput = {
  conservativeTTC: number | null;
  neutralTTC: number | null;
  aggressiveTTC: number | null;
};

const TTC_NULL_PLACEHOLDER = 90;

export function calcScenarioDeltaSummary(input: ScenarioTTCInput): ScenarioDeltaSummary {
  const conservativeTTC = input.conservativeTTC ?? TTC_NULL_PLACEHOLDER;
  const neutralTTC = input.neutralTTC ?? TTC_NULL_PLACEHOLDER;
  const aggressiveTTC = input.aggressiveTTC ?? TTC_NULL_PLACEHOLDER;

  const neutralToConservative = Math.abs(neutralTTC - conservativeTTC);
  const neutralToAggressive = Math.abs(neutralTTC - aggressiveTTC);
  const spread = Math.abs(conservativeTTC - aggressiveTTC);
  const normalizedSpread = normalize01(spread, 0, 90);

  return {
    neutralToConservative,
    neutralToAggressive,
    spread,
    normalizedSpread,
  };
}

const VELOCITY_REASONABLE_MAX = 10;
const VOLATILITY_REASONABLE_MAX = 5;

const WEIGHTS = {
  velocity: 0.25,
  volatility: 0.2,
  sensitivity: 0.25,
  confidencePenalty: 0.2,
  momentumPenalty: 0.1,
} as const;

export function calcInstabilityIndex(inputs: InstabilityInputs): InstabilityResult {
  const velocityScore = normalize01(Math.abs(inputs.velocity), 0, VELOCITY_REASONABLE_MAX);
  const volatilityScore = normalize01(inputs.volatility, 0, VOLATILITY_REASONABLE_MAX);
  const sensitivityScore = inputs.scenarioSensitivity;
  const confidencePenalty = 1 - inputs.confidence;
  const momentumPenalty = 1 - inputs.momentumStability;

  const breakdown: InstabilityBreakdown = {
    velocityScore,
    volatilityScore,
    sensitivityScore,
    confidencePenalty,
    momentumPenalty,
    weights: { ...WEIGHTS },
  };

  const raw =
    WEIGHTS.velocity * velocityScore +
    WEIGHTS.volatility * volatilityScore +
    WEIGHTS.sensitivity * sensitivityScore +
    WEIGHTS.confidencePenalty * confidencePenalty +
    WEIGHTS.momentumPenalty * momentumPenalty;
  const index = Math.round(raw * 100);

  let level: InstabilityResult["level"];
  if (index <= 24) level = "Low";
  else if (index <= 49) level = "Moderate";
  else if (index <= 74) level = "High";
  else level = "Critical";

  const rationale: string[] = [];
  if (inputs.confidence < 0.45 || volatilityScore > 0.7) {
    rationale.push("Conservative: low confidence or high volatility.");
  } else if (
    velocityScore > 0.7 &&
    sensitivityScore > 0.6 &&
    inputs.confidence > 0.65
  ) {
    rationale.push("Aggressive: high velocity, high sensitivity, and sufficient confidence.");
  } else {
    rationale.push("Neutral: default scenario.");
  }

  let recommendedScenario: InstabilityResult["recommendedScenario"];
  if (inputs.confidence < 0.45 || volatilityScore > 0.7) {
    recommendedScenario = "Conservative";
  } else if (
    velocityScore > 0.7 &&
    sensitivityScore > 0.6 &&
    inputs.confidence > 0.65
  ) {
    recommendedScenario = "Aggressive";
  } else {
    recommendedScenario = "Neutral";
  }

  const flags: string[] = [];
  const confidenceMinHistoryThreshold = 2;
  if (inputs.historyDepth < confidenceMinHistoryThreshold) {
    flags.push("LowHistory");
  }
  if (inputs.confidence < 0.45) {
    flags.push("LowConfidence");
  }
  if (inputs.scenarioSensitivity > 0.7) {
    flags.push("HighScenarioSpread");
  }

  return {
    index,
    level,
    breakdown,
    recommendedScenario,
    rationale,
    flags,
  };
}

const EII_DELTA_MIN = -20;
const EII_DELTA_MAX = 20;

/**
 * Structural fragility: differentiates temporary instability from persistent structural fragility.
 * Uses current EII, EII delta vs previous run, and confidence penalty.
 */
export function calcFragility(params: {
  currentEii: number;
  previousEii?: number;
  confidencePenalty: number; // 0..1 from instability breakdown
}): FragilityResult {
  const { currentEii, previousEii, confidencePenalty } = params;
  const eiiDelta =
    previousEii !== undefined ? currentEii - previousEii : 0;
  const deltaNorm = normalize01(eiiDelta, EII_DELTA_MIN, EII_DELTA_MAX);
  const raw =
    currentEii * 0.6 +
    deltaNorm * 20 * 0.3 +
    confidencePenalty * 100 * 0.1;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  let level: FragilityLevel;
  if (score <= 39) level = "Stable";
  else if (score <= 69) level = "Watch";
  else level = "Structurally Fragile";
  return {
    score,
    level,
    ...(previousEii !== undefined ? { eiiDelta } : {}),
  };
}
