/**
 * Monte Carlo simulation engine — pure, testable, no UI.
 * Runs N iterations across all risks; produces cost/time samples and summary stats.
 * Uses seeded RNG when seed is provided for deterministic runs.
 */

import type { Risk } from "@/domain/risk/risk.schema";
import type {
  SimulationRiskSnapshot,
  SimulationSnapshot,
} from "./simulation.types";

export type SimulationResult = {
  costSamples: number[];
  timeSamples: number[];
  summary: {
    meanCost: number;
    p50Cost: number;
    p80Cost: number;
    p90Cost: number;
    minCost: number;
    maxCost: number;
    meanTime: number;
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

/** Probability 0–1 for simulation (scenario-adjusted risk.probability or rating fallback). */
function getProbability(risk: Risk): number {
  if (
    typeof risk.probability === "number" &&
    Number.isFinite(risk.probability) &&
    risk.probability >= 0 &&
    risk.probability <= 1
  )
    return risk.probability;
  return normalizeProbability(
    risk.residualRating?.probability ?? risk.inherentRating?.probability
  );
}

/** Most likely cost (scenario-adjusted costImpact/baseCostImpact or consequence fallback). */
function getCostML(risk: Risk): number {
  const explicit =
    typeof risk.costImpact === "number"
      ? risk.costImpact
      : Number(risk.costImpact);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const base =
    typeof risk.baseCostImpact === "number" &&
    Number.isFinite(risk.baseCostImpact) &&
    risk.baseCostImpact > 0
      ? risk.baseCostImpact
      : 0;
  if (base > 0) return base;
  const c =
    risk.residualRating?.consequence ?? risk.inherentRating?.consequence;
  const cons = typeof c === "number" ? c : Number(c);
  if (!Number.isFinite(cons)) return 0;
  const cc = Math.max(1, Math.min(5, Math.round(cons)));
  const map: Record<number, number> = {
    1: 25_000,
    2: 100_000,
    3: 300_000,
    4: 750_000,
    5: 1_500_000,
  };
  return map[cc] ?? 0;
}

/** Most likely time (days). */
function getTimeML(risk: Risk): number {
  const days = risk.scheduleImpactDays ?? 0;
  return Number.isFinite(days) && days >= 0 ? days : 0;
}

/** Safe percentile index: no .at(); index = floor((p/100) * length). */
function percentileIndex(samples: number[], percentile: number): number {
  if (samples.length === 0) return 0;
  const idx = Math.floor((percentile / 100) * samples.length);
  return Math.min(idx, samples.length - 1);
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
    p50Cost: costSorted[percentileIndex(costSorted, 50)] ?? 0,
    p80Cost: costSorted[percentileIndex(costSorted, 80)] ?? 0,
    p90Cost: costSorted[percentileIndex(costSorted, 90)] ?? 0,
    minCost: costSorted[0] ?? 0,
    maxCost: costSorted[n - 1] ?? 0,
    meanTime: mean(timeSamples),
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
 * Returns costSamples, timeSamples, and computed summary (mean, p50, p80, p90, min, max).
 */
export function runMonteCarloSimulation(
  options: RunMonteCarloOptions
): SimulationResult {
  const { risks, iterations = 10000, seed } = options;
  const n = Math.max(0, Math.floor(iterations));
  const random = seed != null ? seededRandom(seed) : () => Math.random();

  const costSamples: number[] = [];
  const timeSamples: number[] = [];

  for (let i = 0; i < n; i++) {
    let totalCost = 0;
    let totalTime = 0;
    for (const risk of risks) {
      const probability = getProbability(risk);
      const costML = getCostML(risk);
      const timeML = getTimeML(risk);
      const trigger = random() < probability;
      if (trigger) {
        totalCost += costML;
        totalTime += timeML;
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
 * Caller supplies id and timestampIso to form a full SimulationSnapshot.
 */
export function buildSimulationSnapshotFromResult(
  result: SimulationResult,
  risks: Risk[],
  iterations: number
): Omit<SimulationSnapshot, "id" | "timestampIso"> {
  const riskSnapshots: SimulationRiskSnapshot[] = risks.map((risk) => {
    const probability = getProbability(risk);
    const costML = getCostML(risk);
    const timeML = getTimeML(risk);
    const expectedCost = probability * costML;
    const expectedDays = probability * timeML;
    return {
      id: risk.id,
      title: risk.title,
      category: risk.category,
      expectedCost,
      expectedDays,
      simMeanCost: expectedCost,
      simMeanDays: expectedDays,
    };
  });
  return {
    iterations,
    p50Cost: result.summary.p50Cost,
    p80Cost: result.summary.p80Cost,
    p90Cost: result.summary.p90Cost,
    totalExpectedCost: result.summary.meanCost,
    totalExpectedDays: result.summary.meanTime,
    risks: riskSnapshots,
  };
}
