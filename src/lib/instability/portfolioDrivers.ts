/**
 * Portfolio instability drivers — explain WHY portfolio instability exists.
 * Counts risks that exceed thresholds on volatility, confidence, sensitivity, velocity;
 * returns top contributors by EII.
 */

import type { InstabilityResult } from "@/types/instability";

const VOLATILITY_THRESHOLD = 0.6;
const CONFIDENCE_PENALTY_THRESHOLD = 0.5;
const SENSITIVITY_THRESHOLD = 0.6;
const VELOCITY_THRESHOLD = 0.6;
const TOP_CONTRIBUTORS_COUNT = 5;

export type RiskForDrivers = {
  id: string;
  title?: string;
  instability: InstabilityResult;
};

export type InstabilityDriverContributor = {
  riskId: string;
  title: string;
  eii: number;
  level: InstabilityResult["level"];
};

export type InstabilityDriversResult = {
  highVolatilityCount: number;
  lowConfidenceCount: number;
  highSensitivityCount: number;
  highVelocityCount: number;
  topContributors: InstabilityDriverContributor[];
};

/**
 * For each risk, reads instability.breakdown and counts risks above thresholds.
 * Returns driver counts and top 5 risks by EII (desc).
 */
export function calculateInstabilityDrivers(risks: RiskForDrivers[]): InstabilityDriversResult {
  let highVolatilityCount = 0;
  let lowConfidenceCount = 0;
  let highSensitivityCount = 0;
  let highVelocityCount = 0;

  for (const risk of risks) {
    const b = risk.instability?.breakdown;
    if (!b) continue;
    if (b.volatilityScore > VOLATILITY_THRESHOLD) highVolatilityCount++;
    if (b.confidencePenalty > CONFIDENCE_PENALTY_THRESHOLD) lowConfidenceCount++;
    if (b.sensitivityScore > SENSITIVITY_THRESHOLD) highSensitivityCount++;
    if (b.velocityScore > VELOCITY_THRESHOLD) highVelocityCount++;
  }

  const topContributors = [...risks]
    .filter((r) => r.instability != null)
    .sort((a, b) => (b.instability.index ?? 0) - (a.instability.index ?? 0))
    .slice(0, TOP_CONTRIBUTORS_COUNT)
    .map((r) => ({
      riskId: r.id,
      title: r.title ?? "—",
      eii: r.instability.index ?? 0,
      level: r.instability.level,
    }));

  return {
    highVolatilityCount,
    lowConfidenceCount,
    highSensitivityCount,
    highVelocityCount,
    topContributors,
  };
}
