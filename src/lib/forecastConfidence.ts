/**
 * Forecast confidence score (0–100) derived only from snapshot history.
 * Contextual layer: depth, momentum stability, volatility. Does not change projection math.
 */

import type { RiskSnapshot } from "@/domain/risk/risk-snapshot.types";
import type { ConfidenceBand } from "@/domain/risk/risk-forecast.types";

export type ConfidenceBreakdown = {
  depthScore: number;
  stabilityScore: number;
  volatilityPenalty: number;
  window: number;
};

export type ForecastConfidenceResult = {
  score: number;
  band: ConfidenceBand;
  breakdown?: ConfidenceBreakdown;
};

export type { ConfidenceBand };

const MAX_WINDOW = 6;
const DEPTH_MAP: Record<number, number> = {
  1: 10,
  2: 25,
  3: 40,
  4: 55,
  5: 65,
  6: 80,
};
const DEPTH_MAX = 85;

/** Band thresholds: low < 40, medium 40–69, high ≥ 70 */
function bandFromScore(score: number): ConfidenceBand {
  if (score < 40) return "low";
  if (score < 70) return "medium";
  return "high";
}

/**
 * Depth score 0–100: more snapshots = higher confidence.
 * 1→10, 2→25, 3→40, 4→55, 5→65, 6+→75–85.
 */
function depthScore(windowSize: number): number {
  if (windowSize <= 0) return 0;
  if (windowSize >= 7) return DEPTH_MAX;
  if (windowSize === 6) return 80;
  return DEPTH_MAP[windowSize as keyof typeof DEPTH_MAP] ?? 10;
}

/**
 * Stability score 0–100: consistent direction of consecutive deltas = higher.
 * Uses sign consistency of step-to-step deltas in the window.
 */
function stabilityScore(scores: number[]): number {
  if (scores.length < 2) return 0;
  const deltas: number[] = [];
  for (let i = 1; i < scores.length; i++) {
    deltas.push(scores[i]! - scores[i - 1]!);
  }
  const sameSign = deltas.every((d) => d >= 0) || deltas.every((d) => d <= 0);
  if (sameSign) return 100;
  const positiveCount = deltas.filter((d) => d > 0).length;
  const negativeCount = deltas.filter((d) => d < 0).length;
  const majoritySame = Math.max(positiveCount, negativeCount);
  return Math.round((100 * majoritySame) / deltas.length);
}

/**
 * Volatility penalty 0–100: higher std dev of deltas = higher penalty (lower confidence contribution).
 */
function volatilityPenalty(scores: number[]): number {
  if (scores.length < 2) return 0;
  const deltas: number[] = [];
  for (let i = 1; i < scores.length; i++) {
    deltas.push(scores[i]! - scores[i - 1]!);
  }
  const n = deltas.length;
  const mean = deltas.reduce((s, d) => s + d, 0) / n;
  const variance = deltas.reduce((s, d) => s + (d - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const penalty = Math.min(100, stdDev * 10);
  return Math.round(penalty);
}

export type ComputeForecastConfidenceOptions = {
  /** When true, include breakdown in result (dev/debug only). */
  includeBreakdown?: boolean;
};

/**
 * Computes forecast confidence (0–100 integer) from a risk's snapshot history only.
 * Uses depth, momentum stability, and volatility. Combined with weights:
 * 0.35*depth + 0.40*stability + 0.25*(100 - volatilityPenalty); clamped and rounded.
 */
export function computeForecastConfidence(
  history: RiskSnapshot[],
  options?: ComputeForecastConfidenceOptions
): ForecastConfidenceResult {
  const window = Math.min(MAX_WINDOW, history.length);
  if (history.length < 2) {
    const score = 15;
    const result: ForecastConfidenceResult = {
      score,
      band: bandFromScore(score),
    };
    if (options?.includeBreakdown) {
      result.breakdown = {
        depthScore: depthScore(history.length),
        stabilityScore: 0,
        volatilityPenalty: 0,
        window: history.length,
      };
    }
    return result;
  }

  const points = history.slice(-window);
  const scores = points.map((p) => p.compositeScore);
  const depth = depthScore(points.length);
  const stability = stabilityScore(scores);
  const volPenalty = volatilityPenalty(scores);
  const raw =
    0.35 * depth + 0.4 * stability + 0.25 * (100 - volPenalty);
  const score = Math.round(Math.max(0, Math.min(100, raw)));
  const result: ForecastConfidenceResult = {
    score,
    band: bandFromScore(score),
  };
  if (options?.includeBreakdown) {
    result.breakdown = {
      depthScore: depth,
      stabilityScore: stability,
      volatilityPenalty: volPenalty,
      window: points.length,
    };
  }
  return result;
}
