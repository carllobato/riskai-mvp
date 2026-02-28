/**
 * Day 11 — Escalation Instability Index (EII) types.
 */

export type InstabilityInputs = {
  velocity: number;
  volatility: number;
  momentumStability: number; // 0..1
  scenarioSensitivity: number; // 0..1
  confidence: number; // 0..1
  historyDepth: number;
};

export type InstabilityBreakdown = {
  velocityScore: number;
  volatilityScore: number;
  sensitivityScore: number;
  confidencePenalty: number;
  momentumPenalty: number;
  weights: Record<string, number>;
};

/** EII trend vs previous run: derived from eiiDelta when previous EII exists. */
export type InstabilityMomentum = "Rising" | "Falling" | "Stable";

export type InstabilityResult = {
  index: number; // 0..100
  level: "Low" | "Moderate" | "High" | "Critical";
  breakdown: InstabilityBreakdown;
  recommendedScenario: "Conservative" | "Neutral" | "Aggressive";
  rationale: string[];
  flags: string[];
  /** EII trend: Rising (eiiDelta > 5), Falling (eiiDelta < -5), Stable otherwise. */
  momentum?: InstabilityMomentum;
};

export type ScenarioDeltaSummary = {
  neutralToConservative: number;
  neutralToAggressive: number;
  spread: number;
  normalizedSpread: number; // 0..1
};

/** Structural fragility: differentiates temporary instability from persistent structural fragility. */
export type FragilityLevel = "Stable" | "Watch" | "Structurally Fragile";

export type FragilityResult = {
  score: number; // 0..100
  level: FragilityLevel;
  eiiDelta?: number; // currentEII - previousEII when previous exists
};
