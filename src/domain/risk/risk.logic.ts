import type { Risk, RiskLevel, RiskRating } from "./risk.schema";
import { clamp } from "@/domain/decision/decision.score";

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

/** Map probability % (0–100) to 1–5 scale. */
export function probabilityPctToScale(pct: number): number {
  if (pct <= 0) return 1;
  if (pct <= 20) return 1;
  if (pct <= 40) return 2;
  if (pct <= 60) return 3;
  if (pct <= 80) return 4;
  return 5;
}

/** Map cost $ to consequence 1–5 scale (rough bands). */
export function costToConsequenceScale(cost: number): number {
  if (cost <= 0) return 1;
  if (cost <= 50_000) return 1;
  if (cost <= 200_000) return 2;
  if (cost <= 500_000) return 3;
  if (cost <= 1_500_000) return 4;
  return 5;
}

/** Map time (days) to consequence 1–5 scale. */
export function timeDaysToConsequenceScale(days: number): number {
  if (days <= 0) return 1;
  if (days <= 7) return 1;
  if (days <= 30) return 2;
  if (days <= 90) return 3;
  if (days <= 180) return 4;
  return 5;
}

/**
 * Appends a composite-score snapshot to the risk's scoreHistory.
 * Keeps only the last maxSnapshots entries. Returns a new Risk; does not mutate.
 */
export function appendScoreSnapshot(
  risk: Risk,
  compositeScore: number,
  maxSnapshots = 10
): Risk {
  const snapshot = { timestamp: Date.now(), compositeScore };
  const history = (risk.scoreHistory ?? []).concat(snapshot);
  const trimmed = history.slice(-maxSnapshots);
  return { ...risk, scoreHistory: trimmed };
}

export type MomentumResult = {
  shortDelta: number;
  mediumDelta: number;
  momentumScore: number;
};

/**
 * Computes momentum from scoreHistory: short (last vs prev) and medium (last vs 4th-last) deltas,
 * then a weighted momentumScore clamped to [-10, 10]. Returns zeros if history has fewer than 2 entries.
 */
export function calculateMomentum(risk: Risk): MomentumResult {
  const history = risk.scoreHistory ?? [];
  if (history.length < 2) {
    return { shortDelta: 0, mediumDelta: 0, momentumScore: 0 };
  }
  const current = history[history.length - 1].compositeScore;
  const prev = history[history.length - 2].compositeScore;
  const shortDelta = current - prev;

  let mediumDelta = 0;
  if (history.length >= 4) {
    const mediumBase = history[history.length - 4].compositeScore;
    mediumDelta = current - mediumBase;
  }

  const rawMomentum = shortDelta * 0.6 + mediumDelta * 0.4;
  const momentumScore = clamp(rawMomentum, -10, 10);

  return {
    shortDelta: Math.round(shortDelta * 10) / 10,
    mediumDelta: Math.round(mediumDelta * 10) / 10,
    momentumScore: Math.round(momentumScore * 10) / 10,
  };
}

export type TrajectoryState = "ESCALATING" | "STABILISING" | "VOLATILE" | "NEUTRAL";

/**
 * Detects trajectory state from scoreHistory: ESCALATING (all last 3 deltas > 0 or mediumDelta > 8),
 * STABILISING (all last 3 deltas <= 0), VOLATILE (>= 3 sign flips in last 5 deltas), else NEUTRAL.
 * Returns NEUTRAL if history has fewer than 4 entries.
 */
export function detectTrajectoryState(risk: Risk): TrajectoryState {
  const history = risk.scoreHistory ?? [];
  if (history.length < 4) return "NEUTRAL";

  const deltas: number[] = [];
  for (let i = 0; i < history.length - 1; i++) {
    deltas.push(history[i + 1].compositeScore - history[i].compositeScore);
  }
  const last3 = deltas.slice(-3);

  if (last3.every((d) => d > 0) || calculateMomentum(risk).mediumDelta > 8) return "ESCALATING";
  if (last3.every((d) => d <= 0)) return "STABILISING";

  const last5 = deltas.slice(-5);
  let flips = 0;
  for (let i = 0; i < last5.length - 1; i++) {
    const a = last5[i];
    const b = last5[i + 1];
    if (a === 0 || b === 0) continue;
    if ((a > 0 && b < 0) || (a < 0 && b > 0)) flips++;
  }
  if (flips >= 3) return "VOLATILE";

  return "NEUTRAL";
}

/**
 * Returns true if mitigation appears ineffective: user has updated mitigation, there are
 * at least 2 score snapshots after that update, and momentum score is > 3.
 */
export function isMitigationIneffective(risk: Risk): boolean {
  const lastUpdate = risk.lastMitigationUpdate;
  if (lastUpdate == null) return false;
  const history = risk.scoreHistory ?? [];
  const count = history.filter((s) => s.timestamp > lastUpdate).length;
  if (count < 2) return false;
  const momentum = calculateMomentum(risk).momentumScore;
  return momentum > 3;
}

export type PortfolioPressure = "NORMAL" | "ELEVATED" | "SYSTEMIC";

export type PortfolioMomentumSummary = {
  escalatingCount: number;
  positiveMomentumCount: number;
  portfolioPressure: PortfolioPressure;
  escalatingPct: number;
  positiveMomentumPct: number;
};

/**
 * Portfolio-level momentum summary: counts of escalating and positive-momentum risks,
 * percentages (0..1), and pressure band (NORMAL / ELEVATED / SYSTEMIC).
 * Returns zeros and NORMAL when risks.length === 0.
 */
export function portfolioMomentumSummary(risks: Risk[]): PortfolioMomentumSummary {
  if (risks.length === 0) {
    return {
      escalatingCount: 0,
      positiveMomentumCount: 0,
      portfolioPressure: "NORMAL",
      escalatingPct: 0,
      positiveMomentumPct: 0,
    };
  }
  let escalatingCount = 0;
  let positiveMomentumCount = 0;
  for (const risk of risks) {
    if (detectTrajectoryState(risk) === "ESCALATING") escalatingCount++;
    if (calculateMomentum(risk).momentumScore > 3) positiveMomentumCount++;
  }
  const n = risks.length;
  const escalatingPct = n > 0 ? escalatingCount / n : 0;
  const positiveMomentumPct = n > 0 ? positiveMomentumCount / n : 0;

  let portfolioPressure: PortfolioPressure = "NORMAL";
  if (escalatingPct > 0.3) portfolioPressure = "SYSTEMIC";
  else if (positiveMomentumPct > 0.2) portfolioPressure = "ELEVATED";

  return {
    escalatingCount,
    positiveMomentumCount,
    portfolioPressure,
    escalatingPct,
    positiveMomentumPct,
  };
}