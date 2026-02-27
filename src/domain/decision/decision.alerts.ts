/**
 * Day 6 – Rule-based alert tags (pure functions).
 * Uses DEFAULT_DECISION_THRESHOLDS; deterministic, no duplicates.
 * All numeric inputs: undefined/NaN → 0 except stabilityScore → 100 (stable).
 */

import type { AlertTag, DecisionThresholds } from "@/domain/decision/decision.types";

export type DeriveAlertTagsInput = {
  riskId: string;
  compositeScore: number;
  triggerRate?: number;
  velocity?: number;
  volatility?: number;
  stabilityScore?: number;
  triggerRateHistory?: number[];
  stabilityHistory?: number[];
};

const safe = (n: number | undefined, fallback: number) =>
  typeof n === "number" && Number.isFinite(n) ? n : fallback;

/**
 * Derives alert tags from metrics and thresholds. No duplicate tags.
 * EMERGING only when triggerRateHistory is provided and shows upward movement.
 */
export function deriveAlertTags(
  input: DeriveAlertTagsInput,
  thresholds: DecisionThresholds
): AlertTag[] {
  const tags: AlertTag[] = [];
  const add = (t: AlertTag) => {
    if (!tags.includes(t)) tags.push(t);
  };

  const score = safe(input.compositeScore, 0);
  const criticalAbove = safe(thresholds.criticalScoreAbove, 0);
  if (criticalAbove > 0 && score >= criticalAbove) add("CRITICAL");

  const velocity = safe(input.velocity, 0);
  const accelMin = safe(thresholds.acceleratingVelocityMin, 0);
  if (accelMin > 0 && velocity >= accelMin) add("ACCELERATING");

  const volatility = safe(input.volatility, 0);
  const volAbove = safe(thresholds.volatileCoeffAbove, 0);
  if (volAbove > 0 && volatility >= volAbove) add("VOLATILE");

  const stability = safe(input.stabilityScore, 100);
  const unstableBelow = safe(thresholds.unstableStabilityBelow, 100);
  if (unstableBelow < 100 && stability <= unstableBelow) add("UNSTABLE");

  const improvingAbove = safe(thresholds.improvingStabilityAbove, 0);
  if (
    improvingAbove > 0 &&
    stability >= improvingAbove &&
    typeof input.velocity === "number" &&
    Number.isFinite(input.velocity) &&
    input.velocity < 0
  ) {
    add("IMPROVING");
  }

  const hist = input.triggerRateHistory;
  if (Array.isArray(hist) && hist.length > 0) {
    const first = safe(hist[0], 0);
    const last = safe(hist[hist.length - 1], 0);
    if (last >= 0.2 && last - first >= 0.1) add("EMERGING");
  }

  return tags;
}
