/**
 * Day 6 decision types — UI-independent, selector-driven.
 * Keyed by stable riskId throughout.
 */

/** Alert tags for decision/priority signalling. */
export type AlertTag =
  | "CRITICAL"
  | "ACCELERATING"
  | "VOLATILE"
  | "UNSTABLE"
  | "EMERGING"
  | "IMPROVING";

/** Per-risk decision metrics (composite score, rank, alert tags). */
export type DecisionMetrics = {
  /** 0–100 composite score (higher = higher concern). */
  compositeScore: number;
  /** 1-based rank within portfolio (1 = highest concern). */
  rank: number;
  /** Applied alert tags from tunable rules. */
  alertTags: AlertTag[];
};

/** Tunable thresholds for alert rules. */
export type DecisionThresholds = {
  /** Composite score above this → consider CRITICAL. */
  criticalScoreAbove?: number;
  /** Velocity above this → consider ACCELERATING. */
  acceleratingVelocityMin?: number;
  /** Volatility above this → consider VOLATILE. */
  volatileCoeffAbove?: number;
  /** Stability below this → consider UNSTABLE. */
  unstableStabilityBelow?: number;
  /** Stability above this → consider IMPROVING. */
  improvingStabilityAbove?: number;
  /** New risk within this many days → consider EMERGING. */
  emergingNewRiskWindowDays?: number;
};

/** Weights for computing composite score from velocity/volatility/stability. */
export type DecisionScoreWeights = {
  velocityWeight?: number;
  volatilityWeight?: number;
  stabilityWeight?: number;
};

/** Full decision config: thresholds + score weights (tunable). */
export type DecisionConfig = {
  thresholds?: DecisionThresholds;
  scoreWeights?: DecisionScoreWeights;
};
