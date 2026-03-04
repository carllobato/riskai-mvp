/**
 * Monte Carlo simulation engine — pure, testable, no UI.
 * Runs N iterations across all risks; produces cost/time samples and summary stats.
 * Uses seeded RNG when seed is provided for deterministic runs.
 *
 * Data lineage (Analysis):
 * - Risks with status "closed" or "archived" are excluded from all calculations.
 * - Probability, cost and time impacts use: post-mitigation if present, else pre-mitigation.
 * - "Present" = defined, finite, and (for numerics) non-negative where applicable.
 */

import type { Risk } from "@/domain/risk/risk.schema";
import type {
  SimulationRiskSnapshot,
  SimulationSnapshot,
} from "./simulation.types";

/** Effective inputs for one risk (post if present else pre). null => exclude from analysis (e.g. closed). */
export type EffectiveRiskInputs = {
  sourceUsed: "post" | "pre";
  probability: number;
  costML: number;
  timeML: number;
};

function isPresentNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

function isPresentPct(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100;
}

/**
 * Single source of truth for Analysis/simulation inputs.
 * - Excludes closed and archived risks (returns null).
 * - Uses post-mitigation values when present, else fallback to pre-mitigation (per field).
 * - Probability in 0–1; cost and time in dollars and days respectively.
 */
export function getEffectiveRiskInputs(risk: Risk): EffectiveRiskInputs | null {
  if (risk.status === "closed" || risk.status === "archived") return null;

  const postProbPct = risk.postMitigationProbabilityPct;
  const preProbPct = risk.preMitigationProbabilityPct;
  const postCost = risk.postMitigationCostML;
  const preCost = risk.preMitigationCostML;
  const postTime = risk.postMitigationTimeML;
  const preTime = risk.preMitigationTimeML;

  const probPct = isPresentPct(postProbPct) ? postProbPct : (isPresentPct(preProbPct) ? preProbPct : null);
  const probability =
    probPct != null
      ? Math.max(0, Math.min(1, probPct / 100))
      : typeof risk.probability === "number" && Number.isFinite(risk.probability) && risk.probability >= 0 && risk.probability <= 1
        ? risk.probability
        : normalizeProbability(risk.residualRating?.probability ?? risk.inherentRating?.probability);

  const costML = getCostMLFromPrePost(risk, postCost, preCost);
  const timeML = getTimeMLFromPrePost(risk, postTime, preTime);

  const sourceUsed =
    isPresentPct(postProbPct) && isPresentNum(postCost) && isPresentNum(postTime) ? "post" : "pre";

  return { sourceUsed, probability, costML, timeML };
}

function getCostMLFromPrePost(risk: Risk, postCost: number | undefined, preCost: number | undefined): number {
  if (isPresentNum(postCost)) return postCost;
  if (isPresentNum(preCost)) return preCost;
  const explicit = typeof risk.costImpact === "number" ? risk.costImpact : Number(risk.costImpact);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const base = typeof risk.baseCostImpact === "number" && Number.isFinite(risk.baseCostImpact) && risk.baseCostImpact > 0 ? risk.baseCostImpact : 0;
  if (base > 0) return base;
  const c = risk.residualRating?.consequence ?? risk.inherentRating?.consequence;
  const cons = typeof c === "number" ? c : Number(c);
  if (!Number.isFinite(cons)) return 0;
  const cc = Math.max(1, Math.min(5, Math.round(cons)));
  const map: Record<number, number> = { 1: 25_000, 2: 100_000, 3: 300_000, 4: 750_000, 5: 1_500_000 };
  return map[cc] ?? 0;
}

/** Maximum schedule impact (days) used in simulation; range is 0–30 days. */
const SCHEDULE_IMPACT_DAYS_CAP = 30;

function getTimeMLFromPrePost(risk: Risk, postTime: number | undefined, preTime: number | undefined): number {
  if (isPresentNum(postTime)) return Math.min(postTime, SCHEDULE_IMPACT_DAYS_CAP);
  if (isPresentNum(preTime)) return Math.min(preTime, SCHEDULE_IMPACT_DAYS_CAP);
  const days = risk.scheduleImpactDays ?? 0;
  const raw = Number.isFinite(days) && days >= 0 ? days : 0;
  return Math.min(raw, SCHEDULE_IMPACT_DAYS_CAP);
}

export type SimulationResult = {
  costSamples: number[];
  timeSamples: number[];
  summary: {
    meanCost: number;
    p20Cost: number;
    p50Cost: number;
    p80Cost: number;
    p90Cost: number;
    minCost: number;
    maxCost: number;
    meanTime: number;
    p20Time: number;
    p50Time: number;
    p80Time: number;
    p90Time: number;
    minTime: number;
    maxTime: number;
  };
};

export type SimulationReport = {
  iterationCount: number;
  averageCost: number;
  averageTime: number;
  costVolatility?: number;
  p50Cost: number;
  p80Cost: number;
  p90Cost: number;
  minCost: number;
  maxCost: number;
};

/** Seeded PRNG (mulberry32) for deterministic runs. Returns 0–1. */
function seededRandom(seed: number): () => number {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizeProbability(p: unknown): number {
  const n = typeof p === "number" ? p : Number(p);
  if (!Number.isFinite(n)) return 0;
  if (n >= 0 && n <= 1) return n;
  if (n > 1 && n <= 100) return n / 100;
  if (n >= 1 && n <= 5) return n / 5;
  if (n >= 1 && n <= 10) return n / 10;
  return 0;
}

/**
 * Percentile index for sorted data: 0-based nearest-rank with endpoints aligned.
 * idx = floor((p/100) * (n - 1)) so p=0 -> first element, p=100 -> last element.
 * Must match src/lib/simulationDisplayUtils.ts percentileFromSorted for consistent P50/P80/P90.
 */
function percentileIndex(samples: number[], percentile: number): number {
  if (samples.length === 0) return 0;
  const n = samples.length;
  const idx = Math.floor((percentile / 100) * (n - 1));
  return Math.min(idx, n - 1);
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length === 0) return 0;
  const m = mean(arr);
  const sumSq = arr.reduce((s, x) => s + (x - m) ** 2, 0);
  return Math.sqrt(sumSq / arr.length);
}

function computeSummary(
  costSamples: number[],
  timeSamples: number[],
  n: number
): SimulationResult["summary"] {
  const costSorted = costSamples.slice().sort((a, b) => a - b);
  const timeSorted = timeSamples.slice().sort((a, b) => a - b);

  return {
    meanCost: mean(costSamples),
    p20Cost: costSorted[percentileIndex(costSorted, 20)] ?? 0,
    p50Cost: costSorted[percentileIndex(costSorted, 50)] ?? 0,
    p80Cost: costSorted[percentileIndex(costSorted, 80)] ?? 0,
    p90Cost: costSorted[percentileIndex(costSorted, 90)] ?? 0,
    minCost: costSorted[0] ?? 0,
    maxCost: costSorted[n - 1] ?? 0,
    meanTime: mean(timeSamples),
    p20Time: timeSorted[percentileIndex(timeSorted, 20)] ?? 0,
    p50Time: timeSorted[percentileIndex(timeSorted, 50)] ?? 0,
    p80Time: timeSorted[percentileIndex(timeSorted, 80)] ?? 0,
    p90Time: timeSorted[percentileIndex(timeSorted, 90)] ?? 0,
    minTime: timeSorted[0] ?? 0,
    maxTime: timeSorted[n - 1] ?? 0,
  };
}

export type RunMonteCarloOptions = {
  risks: Risk[];
  iterations?: number;
  seed?: number;
};

/**
 * Runs Monte Carlo simulation: for each iteration, for each risk,
 * decide if risk triggers (random < probability); if so add most likely cost and time.
 * Closed risks are excluded. Uses post-mitigation inputs when present, else pre-mitigation.
 * Returns costSamples, timeSamples, and computed summary (mean, p50, p80, p90, min, max).
 */
export function runMonteCarloSimulation(
  options: RunMonteCarloOptions
): SimulationResult {
  const { risks, iterations = 10000, seed } = options;
  const effective = risks.map((r) => getEffectiveRiskInputs(r)).filter((x): x is EffectiveRiskInputs => x != null);
  const n = Math.max(0, Math.floor(iterations));
  const random = seed != null ? seededRandom(seed) : () => Math.random();

  const costSamples: number[] = [];
  const timeSamples: number[] = [];

  for (let i = 0; i < n; i++) {
    let totalCost = 0;
    let totalTime = 0;
    for (const inp of effective) {
      const trigger = random() < inp.probability;
      if (trigger) {
        totalCost += inp.costML;
        totalTime += inp.timeML;
      }
    }
    costSamples.push(totalCost);
    timeSamples.push(totalTime);
  }

  const summary = computeSummary(costSamples, timeSamples, n);

  return {
    costSamples,
    timeSamples,
    summary,
  };
}

/**
 * Builds a report object from a simulation result for storage/display.
 */
export function buildSimulationReport(
  result: SimulationResult,
  iterationCount: number
): SimulationReport {
  const costVolatility = stdDev(result.costSamples);
  return {
    iterationCount,
    averageCost: result.summary.meanCost,
    averageTime: result.summary.meanTime,
    costVolatility,
    p50Cost: result.summary.p50Cost,
    p80Cost: result.summary.p80Cost,
    p90Cost: result.summary.p90Cost,
    minCost: result.summary.minCost,
    maxCost: result.summary.maxCost,
  };
}

/**
 * Builds snapshot fields from Monte Carlo result + risks for backward compatibility.
 * Closed risks are excluded. Uses same effective inputs (post/pre) as runMonteCarloSimulation.
 * Caller supplies id and timestampIso to form a full SimulationSnapshot.
 */
export function buildSimulationSnapshotFromResult(
  result: SimulationResult,
  risks: Risk[],
  iterations: number
): Omit<SimulationSnapshot, "id" | "timestampIso"> {
  const riskSnapshots: SimulationRiskSnapshot[] = [];
  for (const risk of risks) {
    const inp = getEffectiveRiskInputs(risk);
    if (!inp) continue;
    const expectedCost = inp.probability * inp.costML;
    const expectedDays = inp.probability * inp.timeML;
    riskSnapshots.push({
      id: risk.id,
      title: risk.title,
      category: risk.category,
      expectedCost,
      expectedDays,
      simMeanCost: expectedCost,
      simMeanDays: expectedDays,
    });
  }
  return {
    iterations,
    p20Cost: result.summary.p20Cost,
    p50Cost: result.summary.p50Cost,
    p80Cost: result.summary.p80Cost,
    p90Cost: result.summary.p90Cost,
    totalExpectedCost: result.summary.meanCost,
    totalExpectedDays: result.summary.meanTime,
    risks: riskSnapshots,
  };
}
