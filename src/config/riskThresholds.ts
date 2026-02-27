/**
 * Central threshold config for projected escalation (score bands).
 * Separate from decisionScoreBand (styling); used for forecast and escalation logic.
 */

import type { ForecastPoint } from "@/domain/risk/risk-forecast.types";

/** Score bands for escalation: normal < 50, watch 50–64, high 65–79, critical >= 80. */
export type EscalationBand = "normal" | "watch" | "high" | "critical";

export const riskThresholds = {
  /** normal: score < 50 */
  normalMax: 49,
  /** watch: 50–64 */
  watchMin: 50,
  watchMax: 64,
  /** high: 65–79 */
  highMin: 65,
  highMax: 79,
  /** critical: >= 80 */
  criticalMin: 80,
} as const;

/**
 * Returns the escalation band for a given composite score (0–100).
 */
export function getBand(score: number): EscalationBand {
  const s = Number(score);
  if (!Number.isFinite(s)) return "normal";
  if (s >= riskThresholds.criticalMin) return "critical";
  if (s >= riskThresholds.highMin && s <= riskThresholds.highMax) return "high";
  if (s >= riskThresholds.watchMin && s <= riskThresholds.watchMax) return "watch";
  return "normal";
}

/**
 * True if any projected point enters the given band within the window.
 */
export function crossesBandWithin(
  points: ForecastPoint[],
  band: EscalationBand
): boolean {
  return timeToBand(points, band) !== null;
}

/**
 * First step (1-based) at which projected score is in the given band, or null if never.
 */
export function timeToBand(
  points: ForecastPoint[],
  band: EscalationBand
): number | null {
  for (const p of points) {
    if (getBand(p.projectedScore) === band) return p.step;
  }
  return null;
}
