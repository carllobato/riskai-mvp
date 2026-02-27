/**
 * Day 6 – Composite scoring engine (pure functions only).
 * No UI, no selectors, no ranking.
 */

import type { DecisionConfig, DecisionScoreWeights } from "@/domain/decision/decision.types";
import { DEFAULT_SCORE_WEIGHTS } from "@/config/decisionDefaults";

const VELOCITY_SCALE = 1;
const VOLATILITY_CAP = 0.8;

// ——— 1) Utility helpers ———

export function clamp(n: number, min: number, max: number): number {
  const x = Number(n);
  if (Number.isNaN(x)) return min;
  return Math.max(min, Math.min(max, x));
}

export function safeNumber(n: unknown, fallback = 0): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

// ——— 2) Normalisation (all return 0..1) ———

/** triggerRate already 0..1; clamp to [0, 1]. */
export function normalizeTriggerRate(triggerRate: number): number {
  return clamp(triggerRate, 0, 1);
}

/** stabilityScore 0..100 → instability 0..1 (higher score = lower instability). */
export function normalizeInstability(stabilityScore: number): number {
  const instability = (100 - safeNumber(stabilityScore, 100)) / 100;
  return clamp(instability, 0, 1);
}

/** volatilityCV → 0..1 using cap (avoids Infinity/NaN from division by zero). */
export function normalizeVolatility(volatilityCV: number): number {
  const raw = safeNumber(volatilityCV, 0);
  const cap = VOLATILITY_CAP > 0 ? VOLATILITY_CAP : 0.8;
  const norm = raw / cap;
  return clamp(Number.isFinite(norm) ? norm : 0, 0, 1);
}

/** Positive acceleration increases score; negative → 0. Tanh scaling. */
export function normalizeVelocity(velocity: number): number {
  const accel = Math.tanh(safeNumber(velocity, 0) / VELOCITY_SCALE);
  return clamp(accel, 0, 1);
}

// ——— 3) Composite score ———

export type CompositeScoreMetrics = {
  triggerRate?: number;
  velocity?: number;
  volatility?: number;
  stabilityScore?: number;
};

export type CompositeScoreBreakdown = {
  trigger: number;
  velocity: number;
  volatility: number;
  instability: number;
  total: number;
};

export type CompositeScoreResult = {
  score: number;
  breakdown: CompositeScoreBreakdown;
};

function getWeights(config?: DecisionConfig | null): {
  trigger: number;
  velocity: number;
  volatility: number;
  stability: number;
} {
  const w: DecisionScoreWeights = config?.scoreWeights ?? DEFAULT_SCORE_WEIGHTS;
  const v = safeNumber(w.velocityWeight, 0);
  const vol = safeNumber(w.volatilityWeight, 0);
  const s = safeNumber(w.stabilityWeight, 0);
  const sum3 = v + vol + s;
  let trigger = 1 - sum3;
  let velocity = v;
  let volatility = vol;
  let stability = s;
  if (trigger < 0 && sum3 > 0) {
    trigger = 0;
    const scale = 1 / sum3;
    velocity = v * scale;
    volatility = vol * scale;
    stability = s * scale;
  }
  return { trigger, velocity, volatility, stability };
}

/**
 * Compute 0..100 composite score from metrics and config.
 * Uses DEFAULT_SCORE_WEIGHTS when config.scoreWeights is missing.
 * triggerWeight = 1 - (velocity + volatility + stability); if < 0, renormalize proportionally.
 * Never returns NaN; score and breakdown values clamped 0..100.
 */
export function computeCompositeScore(
  metrics: CompositeScoreMetrics,
  config?: DecisionConfig | null
): CompositeScoreResult {
  const weights = getWeights(config);

  const normTrigger = normalizeTriggerRate(metrics.triggerRate ?? 0);
  const normVelocity = normalizeVelocity(metrics.velocity ?? 0);
  const normVolatility = normalizeVolatility(metrics.volatility ?? 0);
  const normInstability = normalizeInstability(metrics.stabilityScore ?? 100);

  const trigger = clamp(normTrigger * weights.trigger * 100, 0, 100);
  const velocity = clamp(normVelocity * weights.velocity * 100, 0, 100);
  const volatility = clamp(normVolatility * weights.volatility * 100, 0, 100);
  const instability = clamp(normInstability * weights.stability * 100, 0, 100);

  const rawTotal = trigger + velocity + volatility + instability;
  const total = clamp(
    Number.isFinite(rawTotal) ? rawTotal : 0,
    0,
    100
  );
  const safeScore = Number.isFinite(total) ? total : 0;

  return {
    score: safeScore,
    breakdown: {
      trigger: safeNumber(trigger, 0),
      velocity: safeNumber(velocity, 0),
      volatility: safeNumber(volatility, 0),
      instability: safeNumber(instability, 0),
      total: safeNumber(safeScore, 0),
    },
  };
}
