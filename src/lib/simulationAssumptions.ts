/**
 * Simulation Assumptions — input quality checks for Monte Carlo readiness.
 * Counts risks in the run snapshot by range presence, variability, mitigation change, and profile.
 * Used by the run-data diagnostic page only; does not mutate simulation logic.
 */

import type { Risk } from "@/domain/risk/risk.schema";
import { appliesToExcludesCost, appliesToExcludesTime } from "@/domain/risk/riskFieldSemantics";
import { probabilityScaleToDisplayPct } from "@/domain/risk/risk.logic";

function isFiniteNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

/** Pre probability: inherent 1–5 scale or explicit probability (0–1). */
function hasPreProbability(r: Risk): boolean {
  const p = r.inherentRating?.probability;
  if (typeof p === "number" && Number.isInteger(p) && p >= 1 && p <= 5) return true;
  if (isFiniteNum(r.probability) && r.probability >= 0 && r.probability <= 1) return true;
  return false;
}

/** Post probability: when mitigated, residual 1–5 scale. */
function hasPostProbability(r: Risk): boolean {
  if (!r.mitigation?.trim()) return true;
  const p = r.residualRating?.probability;
  return typeof p === "number" && Number.isInteger(p) && p >= 1 && p <= 5;
}

/** Cost range exists: pre or post min/max both finite and max > min. */
function hasCostRange(r: Risk): boolean {
  const preOk =
    isFiniteNum(r.preMitigationCostMin) &&
    isFiniteNum(r.preMitigationCostMax) &&
    r.preMitigationCostMax > r.preMitigationCostMin;
  const postOk =
    isFiniteNum(r.postMitigationCostMin) &&
    isFiniteNum(r.postMitigationCostMax) &&
    r.postMitigationCostMax > r.postMitigationCostMin;
  return preOk || postOk;
}

/** Schedule range exists: pre or post min/max both finite and max > min. */
function hasScheduleRange(r: Risk): boolean {
  const preOk =
    isFiniteNum(r.preMitigationTimeMin) &&
    isFiniteNum(r.preMitigationTimeMax) &&
    r.preMitigationTimeMax > r.preMitigationTimeMin;
  const postOk =
    isFiniteNum(r.postMitigationTimeMin) &&
    isFiniteNum(r.postMitigationTimeMax) &&
    r.postMitigationTimeMax > r.postMitigationTimeMin;
  return preOk || postOk;
}

/** Min = max cost: a cost min/max pair exists but min === max (pre or post). */
function hasMinEqualsMaxCost(r: Risk): boolean {
  const preBoth = isFiniteNum(r.preMitigationCostMin) && isFiniteNum(r.preMitigationCostMax);
  const postBoth = isFiniteNum(r.postMitigationCostMin) && isFiniteNum(r.postMitigationCostMax);
  const preFlat = preBoth && r.preMitigationCostMin === r.preMitigationCostMax;
  const postFlat = postBoth && r.postMitigationCostMin === r.postMitigationCostMax;
  return preFlat || postFlat;
}

/** Min = max schedule: a schedule min/max pair exists but min === max (pre or post). */
function hasMinEqualsMaxSchedule(r: Risk): boolean {
  const preBoth = isFiniteNum(r.preMitigationTimeMin) && isFiniteNum(r.preMitigationTimeMax);
  const postBoth = isFiniteNum(r.postMitigationTimeMin) && isFiniteNum(r.postMitigationTimeMax);
  const preFlat = preBoth && r.preMitigationTimeMin === r.preMitigationTimeMax;
  const postFlat = postBoth && r.postMitigationTimeMin === r.postMitigationTimeMax;
  return preFlat || postFlat;
}

/** Unchanged mitigation: pre and post display %, cost ML, and time ML all equal (including both missing). */
function hasUnchangedMitigation(r: Risk): boolean {
  const preProb = probabilityScaleToDisplayPct(r.inherentRating.probability);
  const postProb = probabilityScaleToDisplayPct(r.residualRating.probability);
  const preCost = r.preMitigationCostML;
  const postCost = r.postMitigationCostML;
  const preTime = r.preMitigationTimeML;
  const postTime = r.postMitigationTimeML;
  return (
    preProb === postProb &&
    preCost === postCost &&
    preTime === postTime
  );
}

/** Cost impact > 0 (pre): same canonical logic as run-data Risk Register Snapshot. */
function hasPreCost(r: Risk): boolean {
  return !appliesToExcludesCost(r.appliesTo) && isFiniteNum(r.preMitigationCostML) && r.preMitigationCostML > 0;
}

/** Time impact > 0 (pre): same canonical logic as run-data Risk Register Snapshot. */
function hasPreTime(r: Risk): boolean {
  return !appliesToExcludesTime(r.appliesTo) && isFiniteNum(r.preMitigationTimeML) && r.preMitigationTimeML > 0;
}

export type SimulationAssumptionCounts = {
  totalInRun: number;
  withCostRange: number;
  withScheduleRange: number;
  withBothRanges: number;
  withNoVariability: number;
  withMinEqualsMaxCost: number;
  withMinEqualsMaxSchedule: number;
  missingPreProbability: number;
  missingPostProbability: number;
  unchangedMitigation: number;
  costOnlyProfile: number;
  scheduleOnlyProfile: number;
  costAndScheduleProfile: number;
};

/**
 * Compute assumption counts for the set of risks that were in the run.
 * Uses live risk fields (min/max, probability scale, ML) for input quality checks.
 */
export function computeSimulationAssumptionCounts(risksInRun: Risk[]): SimulationAssumptionCounts {
  const totalInRun = risksInRun.length;
  let withCostRange = 0;
  let withScheduleRange = 0;
  let withBothRanges = 0;
  let withNoVariability = 0;
  let withMinEqualsMaxCost = 0;
  let withMinEqualsMaxSchedule = 0;
  let missingPreProbability = 0;
  let missingPostProbability = 0;
  let unchangedMitigation = 0;
  let costOnlyProfile = 0;
  let scheduleOnlyProfile = 0;
  let costAndScheduleProfile = 0;

  for (const r of risksInRun) {
    const costRange = hasCostRange(r);
    const scheduleRange = hasScheduleRange(r);
    const preCost = hasPreCost(r);
    const preTime = hasPreTime(r);
    if (costRange) withCostRange += 1;
    if (scheduleRange) withScheduleRange += 1;
    if (costRange && scheduleRange) withBothRanges += 1;
    if (!costRange && !scheduleRange) withNoVariability += 1;
    if (hasMinEqualsMaxCost(r) && preTime) withMinEqualsMaxCost += 1;
    if (hasMinEqualsMaxSchedule(r) && preCost) withMinEqualsMaxSchedule += 1;
    if (!hasPreProbability(r)) missingPreProbability += 1;
    if (!hasPostProbability(r)) missingPostProbability += 1;
    if (hasUnchangedMitigation(r)) unchangedMitigation += 1;

    if (preCost && preTime) costAndScheduleProfile += 1;
    else if (preCost) costOnlyProfile += 1;
    else if (preTime) scheduleOnlyProfile += 1;
  }

  return {
    totalInRun,
    withCostRange,
    withScheduleRange,
    withBothRanges,
    withNoVariability,
    withMinEqualsMaxCost,
    withMinEqualsMaxSchedule,
    missingPreProbability,
    missingPostProbability,
    unchangedMitigation,
    costOnlyProfile,
    scheduleOnlyProfile,
    costAndScheduleProfile,
  };
}
