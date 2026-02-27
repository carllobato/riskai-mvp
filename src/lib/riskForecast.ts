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

const DEFAULT_HORIZON = 5;
const CONFIDENCE_DECAY = 0.92;

export type ProjectForwardParams = {
  currentScore: number;
  momentumPerCycle: number;
  confidence: number;
  horizon?: number;
  clampMin?: number;
  clampMax?: number;
  momentumDecay?: number;
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
  } = params;

  const points: ForecastPoint[] = [];
  let score = currentScore;
  let momentum = momentumPerCycle;
  let conf = Math.max(0, Math.min(1, confidence));

  for (let step = 1; step <= horizon; step++) {
    score = clamp(score + momentum, clampMin, clampMax);
    momentum = momentum * momentumDecay;
    conf = conf * CONFIDENCE_DECAY;

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
 */
function buildForecastFromMomentum(
  riskId: string,
  currentScore: number,
  momentumPerCycle: number,
  confidence: number,
  horizon: number
): RiskForecast {
  const points = projectForward({
    currentScore,
    momentumPerCycle,
    confidence,
    horizon,
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
 */
export function buildRiskForecast(
  riskId: string,
  latestSnapshot: RiskSnapshot | null,
  history: RiskSnapshot[]
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
    horizon
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
 */
export function buildMitigationStressForecast(
  riskId: string,
  latestSnapshot: RiskSnapshot | null,
  history: RiskSnapshot[],
  mitigationStrength?: number | null
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
    horizon
  );
  const mitigatedForecast = buildForecastFromMomentum(
    riskId,
    currentScore,
    effectiveMomentum,
    confidence,
    horizon
  );

  const timeToCriticalBaseline = baselineForecast.timeToCritical;
  const timeToCriticalMitigated = mitigatedForecast.timeToCritical;
  const mitigationInsufficient = timeToCriticalMitigated !== null;

  return {
    riskId,
    baselineForecast,
    mitigatedForecast,
    mitigationInsufficient,
    timeToCriticalBaseline,
    timeToCriticalMitigated,
  };
}
