import type { DecisionConfig, DecisionScoreWeights, DecisionThresholds } from "@/domain/decision/decision.types";

/** Default thresholds for alert rules (tunable). */
export const DEFAULT_DECISION_THRESHOLDS: DecisionThresholds = {
  criticalScoreAbove: 80,
  acceleratingVelocityMin: 5000,
  volatileCoeffAbove: 0.4,
  unstableStabilityBelow: 30,
  improvingStabilityAbove: 75,
  emergingNewRiskWindowDays: 7,
};

/** Default weights for composite score (velocity, volatility, stability). */
export const DEFAULT_SCORE_WEIGHTS: DecisionScoreWeights = {
  velocityWeight: 0.35,
  volatilityWeight: 0.35,
  stabilityWeight: 0.3,
};

/** Default decision config (thresholds + score weights). */
export const DEFAULT_DECISION_CONFIG: DecisionConfig = {
  thresholds: DEFAULT_DECISION_THRESHOLDS,
  scoreWeights: DEFAULT_SCORE_WEIGHTS,
};
