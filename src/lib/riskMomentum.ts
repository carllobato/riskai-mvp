/**
 * Momentum calculation from risk snapshot history (compositeScore over cycleIndex).
 */

import type { RiskSnapshot } from "@/domain/risk/risk-snapshot.types";

const MOMENTUM_CLAMP_MIN = -8;
const MOMENTUM_CLAMP_MAX = 8;
const MAX_POINTS_FOR_MOMENTUM = 5;
const VARIANCE_SCALE = 15; // divisor for stdDev to get penalty (0–1 range)

/**
 * Computes momentum and confidence from the last N snapshots (up to 5).
 * - momentumPerCycle: average delta per cycle (linear regression slope), clamped to [-8, +8].
 * - confidence: increases with more points, decreases with high variance; in [0, 1].
 */
export function computeMomentum(
  history: RiskSnapshot[]
): { momentumPerCycle: number; confidence: number } {
  const points = history.slice(-MAX_POINTS_FOR_MOMENTUM);
  if (points.length < 2) {
    return { momentumPerCycle: 0, confidence: 0 };
  }

  const n = points.length;
  const first = points[0];
  const last = points[n - 1];
  const cycleSpan = last.cycleIndex - first.cycleIndex;
  const scoreDelta = last.compositeScore - first.compositeScore;

  const momentumPerCycle =
    cycleSpan !== 0 ? scoreDelta / cycleSpan : 0;
  const clamped = Math.max(
    MOMENTUM_CLAMP_MIN,
    Math.min(MOMENTUM_CLAMP_MAX, momentumPerCycle)
  );

  const mean = points.reduce((s, p) => s + p.compositeScore, 0) / n;
  const variance =
    points.reduce((s, p) => s + (p.compositeScore - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const variancePenalty = Math.min(1, stdDev / VARIANCE_SCALE);
  const rawCount = Math.min(1, (n - 1) / 4);
  const confidence = Math.max(
    0,
    Math.min(1, rawCount * (1 - variancePenalty))
  );

  return { momentumPerCycle: clamped, confidence };
}
