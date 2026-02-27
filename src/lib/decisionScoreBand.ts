/**
 * Composite score band for consistent badge styling (0–39 low, 40–69 watch, 70–100 critical).
 */

export type ScoreBand = "low" | "watch" | "critical";

export function getScoreBand(score: number): ScoreBand {
  const s = Number(score);
  if (!Number.isFinite(s)) return "low";
  if (s >= 70) return "critical";
  if (s >= 40) return "watch";
  return "low";
}
