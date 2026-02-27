import type { RiskLevel, RiskRating } from "./risk.schema";

export function computeRiskLevel(score: number): RiskLevel {
  if (score <= 4) return "low";
  if (score <= 9) return "medium";
  if (score <= 16) return "high";
  return "extreme";
}

/** Returns { probability, consequence, score, level }; score/level are derived here only. */
export function buildRating(
  probability: number,
  consequence: number
): RiskRating {
  const score = probability * consequence;

  return {
    probability,
    consequence,
    score,
    level: computeRiskLevel(score),
  };
}