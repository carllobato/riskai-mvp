/**
 * Bounded forward projection for risk composite scores.
 */

import type {
  ForecastPoint,
  RiskForecast,
  RiskMitigationForecast,
} from "@/domain/risk/risk-forecast.types";
import type { RiskSnapshot } from "@/domain/risk/risk-snapshot.types";
import { getBand, timeToBand } from "@/config/riskThresholds";
import { computeMomentum } from "@/lib/riskMomentum";
import { getProjectionParams } from "@/lib/projectionProfiles";
import type { ProjectionProfile } from "@/lib/projectionProfiles";
import { computeForecastConfidence } from "@/lib/forecastConfidence";
import { DEBUG_FORWARD_PROJECTION } from "@/config/debug";
import {
  computePortfolioForwardPressure,
  type PortfolioForwardPressure,
} from "@/lib/portfolioForwardPressure";

const DEFAULT_HORIZON = 5;
const DEFAULT_CONFIDENCE_DECAY = 0.92;

export type ProjectForwardParams = {
  currentScore: number;
  momentumPerCycle: number;
  confidence: number;
  horizon?: number;
  clampMin?: number;
  clampMax?: number;
  momentumDecay?: number;
  confidenceDecay?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Projects composite score forward step-by-step with momentum decay.
 * Scores are clamped so they never exceed bounds and do not diverge.
 * Returns one ForecastPoint per step from 1 to horizon.
 */
export function projectForward(params: ProjectForwardParams): ForecastPoint[] {
  const {
    currentScore,
    momentumPerCycle,
    confidence,
    horizon = DEFAULT_HORIZON,
    clampMin = 0,
    clampMax = 100,
    momentumDecay = 0.85,
    confidenceDecay = DEFAULT_CONFIDENCE_DECAY,
  } = params;

  const points: ForecastPoint[] = [];
  let score = currentScore;
  let momentum = momentumPerCycle;
  let conf = Math.max(0, Math.min(1, confidence));

  for (let step = 1; step <= horizon; step++) {
    score = clamp(score + momentum, clampMin, clampMax);
    momentum = momentum * momentumDecay;
    conf = conf * confidenceDecay;

    points.push({
      step,
      projectedScore: score,
      projectedDeltaFromNow: score - currentScore,
      confidence: conf,
    });
  }

  return points;
}

/**
 * Builds a single RiskForecast from current score and momentum (used for baseline and mitigated).
 * Uses getProjectionParams(profile ?? "neutral") for decay/persistence; default "neutral" preserves prior behavior.
 */
function buildForecastFromMomentum(
  riskId: string,
  currentScore: number,
  momentumPerCycle: number,
  confidence: number,
  horizon: number,
  profile: ProjectionProfile = "neutral"
): RiskForecast {
  const { momentumDecay, confidenceDecay } = getProjectionParams(profile);
  const points = projectForward({
    currentScore,
    momentumPerCycle,
    confidence,
    horizon,
    momentumDecay,
    confidenceDecay,
  });
  const timeToCritical = timeToBand(points, "critical");
  const crossesCriticalWithinWindow = timeToCritical !== null;
  const currentBand = getBand(currentScore);
  const projectedCritical =
    currentBand !== "critical" && crossesCriticalWithinWindow;
  return {
    riskId,
    horizon,
    points,
    timeToCritical,
    crossesCriticalWithinWindow,
    projectedCritical,
  };
}

/**
 * Builds a full risk forecast from the latest snapshot and history.
 * Uses snapshot momentum or computes from history; confidence from computeMomentum(history).
 * Sets timeToCritical (first step crossing threshold) and crossesCriticalWithinWindow.
 * Optional profile defaults to "neutral" (no output change).
 */
export function buildRiskForecast(
  riskId: string,
  latestSnapshot: RiskSnapshot | null,
  history: RiskSnapshot[],
  profile: ProjectionProfile = "neutral"
): RiskForecast {
  const horizon = DEFAULT_HORIZON;
  const currentScore =
    latestSnapshot != null && Number.isFinite(latestSnapshot.compositeScore)
      ? latestSnapshot.compositeScore
      : 0;
  const { momentumPerCycle, confidence } = computeMomentum(history);
  const momentum =
    latestSnapshot != null &&
    typeof latestSnapshot.momentum === "number" &&
    Number.isFinite(latestSnapshot.momentum)
      ? latestSnapshot.momentum
      : momentumPerCycle;
  return buildForecastFromMomentum(
    riskId,
    currentScore,
    momentum,
    confidence,
    horizon,
    profile
  );
}

/** Safe 0..1 mitigation strength; missing/NaN/invalid → 0. */
function safeMitigationStrength(value: number | undefined | null): number {
  if (value == null || typeof value !== "number" || !Number.isFinite(value))
    return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * Builds baseline (no mitigation) and mitigated (momentum reduced by mitigationStrength) forecasts.
 * effectiveMomentum = momentumPerCycle * (1 - mitigationStrength). If mitigationStrength is missing, treated as 0 (mitigated = baseline).
 * Optional profile defaults to "neutral" (no output change).
 */
export function buildMitigationStressForecast(
  riskId: string,
  latestSnapshot: RiskSnapshot | null,
  history: RiskSnapshot[],
  mitigationStrength?: number | null,
  profile: ProjectionProfile = "neutral"
): RiskMitigationForecast {
  const horizon = DEFAULT_HORIZON;
  const currentScore =
    latestSnapshot != null && Number.isFinite(latestSnapshot.compositeScore)
      ? latestSnapshot.compositeScore
      : 0;
  const { momentumPerCycle, confidence } = computeMomentum(history);
  const momentum =
    latestSnapshot != null &&
    typeof latestSnapshot.momentum === "number" &&
    Number.isFinite(latestSnapshot.momentum)
      ? latestSnapshot.momentum
      : momentumPerCycle;
  const strength = safeMitigationStrength(mitigationStrength);
  const effectiveMomentum = momentum * (1 - strength);

  const baselineForecast = buildForecastFromMomentum(
    riskId,
    currentScore,
    momentum,
    confidence,
    horizon,
    profile
  );
  const mitigatedForecast = buildForecastFromMomentum(
    riskId,
    currentScore,
    effectiveMomentum,
    confidence,
    horizon,
    profile
  );

  const timeToCriticalBaseline = baselineForecast.timeToCritical;
  const timeToCriticalMitigated = mitigatedForecast.timeToCritical;
  const mitigationInsufficient = timeToCriticalMitigated !== null;

  const confidenceResult = computeForecastConfidence(history, {
    includeBreakdown: DEBUG_FORWARD_PROJECTION,
  });

  return {
    riskId,
    baselineForecast,
    mitigatedForecast,
    mitigationInsufficient,
    timeToCriticalBaseline,
    timeToCriticalMitigated,
    forecastConfidence: confidenceResult.score,
    confidenceBand: confidenceResult.band,
    ...(confidenceResult.breakdown && { confidenceBreakdown: confidenceResult.breakdown }),
    projectionProfileUsed: profile,
    insufficientHistory: history.length < 2,
  };
}

/** Minimal risk shape needed for forward projection (id + mitigationStrength). */
export type RiskForProjection = {
  id: string;
  mitigationStrength?: number | null;
};

export type RunForwardProjectionOptions = {
  profile?: ProjectionProfile;
};

export type RunForwardProjectionResult = {
  riskForecastsById: Record<string, RiskMitigationForecast>;
  forwardPressure: PortfolioForwardPressure;
  projectionProfileUsed: ProjectionProfile;
};

/**
 * Top-level orchestration: runs forward projection for all risks and portfolio aggregate.
 * Profile flows into the core bounded projection loop via getProjectionParams(profile).
 * Default profile "neutral" reproduces Day 8/9 outputs exactly.
 */
export function runForwardProjection(
  risks: RiskForProjection[],
  getLatestSnapshot: (riskId: string) => RiskSnapshot | null,
  getRiskHistory: (riskId: string) => RiskSnapshot[],
  options?: RunForwardProjectionOptions
): RunForwardProjectionResult {
  const profile = options?.profile ?? "neutral";
  const forecasts: RiskMitigationForecast[] = risks.map((risk) =>
    buildMitigationStressForecast(
      risk.id,
      getLatestSnapshot(risk.id),
      getRiskHistory(risk.id),
      risk.mitigationStrength,
      profile
    )
  );
  const riskForecastsById: Record<string, RiskMitigationForecast> = {};
  for (const f of forecasts) {
    riskForecastsById[f.riskId] = f;
  }
  const forwardPressure = computePortfolioForwardPressure(forecasts, profile);
  return {
    riskForecastsById,
    forwardPressure,
    projectionProfileUsed: profile,
  };
}

export type ScenarioSummary = {
  forwardPressure: PortfolioForwardPressure;
  projectedCriticalCount: number;
  medianTtC: number | null;
};

export type ScenarioComparisonResult = {
  conservative: ScenarioSummary;
  neutral: ScenarioSummary;
  aggressive: ScenarioSummary;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Runs forward projection under conservative, neutral, and aggressive; returns summary metrics per profile.
 * Uses existing engine only; does not mutate global state. Respects all guardrails.
 */
export function computeScenarioComparison(
  risks: RiskForProjection[],
  getLatestSnapshot: (riskId: string) => RiskSnapshot | null,
  getRiskHistory: (riskId: string) => RiskSnapshot[]
): ScenarioComparisonResult {
  const profiles: ProjectionProfile[] = ["conservative", "neutral", "aggressive"];
  const results = profiles.map((profile) => {
    const { riskForecastsById, forwardPressure } = runForwardProjection(
      risks,
      getLatestSnapshot,
      getRiskHistory,
      { profile }
    );
    const ttCs: number[] = [];
    for (const f of Object.values(riskForecastsById)) {
      const t = f.baselineForecast.timeToCritical;
      if (t !== null && Number.isFinite(t)) ttCs.push(t);
    }
    return {
      forwardPressure,
      projectedCriticalCount: forwardPressure.projectedCriticalCount,
      medianTtC: median(ttCs),
    };
  });
  return {
    conservative: results[0]!,
    neutral: results[1]!,
    aggressive: results[2]!,
  };
}
