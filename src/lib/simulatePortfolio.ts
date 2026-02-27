import type { Risk } from "@/domain/risk/risk.schema";
import type { SimulationRiskSnapshot, SimulationSnapshot } from "@/domain/simulation/simulation.types";
import { makeId } from "@/lib/id";

const DEFAULT_ITERATIONS = 1000;
const DEFAULT_COST_SPREAD_PCT = 0.2;
const DEBUG_SIM = false;

/** Sample from triangular distribution (min, mode, max). Returns mode if min === max. */
function triangular(min: number, mode: number, max: number): number {
  if (min === max) return mode;
  const u = Math.random();
  const c = (mode - min) / (max - min);
  if (u <= c) return min + Math.sqrt(u * (max - min) * (mode - min));
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
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

function costFromConsequence(consequence: unknown): number {
  const c = typeof consequence === "number" ? consequence : Number(consequence);
  if (!Number.isFinite(c)) return 0;
  const cc = Math.max(1, Math.min(5, Math.round(c)));
  const map: Record<number, number> = {
    1: 25_000,
    2: 100_000,
    3: 300_000,
    4: 750_000,
    5: 1_500_000,
  };
  return map[cc] ?? 0;
}

const mean = (arr: number[]) =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

function stdDev(arr: number[]): number {
  if (arr.length === 0) return 0;
  const m = mean(arr);
  const sumSqDiff = arr.reduce((s, x) => s + (x - m) ** 2, 0);
  const variance = sumSqDiff / arr.length;
  return Math.sqrt(variance);
}

export type SimulatePortfolioOptions = {
  costSpreadPct?: number;
};

/**
 * Monte Carlo-style portfolio simulation. No UI; returns a SimulationSnapshot.
 */
export function simulatePortfolio(
  risks: Risk[],
  iterations: number = DEFAULT_ITERATIONS,
  options: SimulatePortfolioOptions = {}
): SimulationSnapshot {
  const spread = options.costSpreadPct ?? DEFAULT_COST_SPREAD_PCT;

  const costSamples: number[] = [];
  const daysSamples: number[] = [];
  let portfolioTriggeredCount = 0;
  type PerRiskAccum = {
    costSum: number;
    daysSum: number;
    triggeredCount: number;
    welfordN: number;
    welfordMean: number;
    welfordM2: number;
  };
  const perRiskSums = new Map<string, PerRiskAccum>();
  for (const risk of risks) {
    perRiskSums.set(risk.id, {
      costSum: 0,
      daysSum: 0,
      triggeredCount: 0,
      welfordN: 0,
      welfordMean: 0,
      welfordM2: 0,
    });
  }

  for (let i = 0; i < iterations; i++) {
    let totalCost = 0;
    let totalDays = 0;
    for (const risk of risks) {
      const probability = normalizeProbability(
        risk.residualRating?.probability ?? risk.inherentRating?.probability
      );
      const explicitCost =
        typeof risk.costImpact === "number" ? risk.costImpact : Number(risk.costImpact);
      const costML =
        (Number.isFinite(explicitCost) && explicitCost > 0 ? explicitCost : 0) ||
        costFromConsequence(
          risk.residualRating?.consequence ?? risk.inherentRating?.consequence
        );
      const scheduleDaysML = risk.scheduleImpactDays ?? 0;

      const costMin = costML * (1 - spread);
      const costMax = costML * (1 + spread);
      const sampledCost = triangular(costMin, costML, costMax);

      const daysMin = scheduleDaysML * (1 - spread);
      const daysMax = scheduleDaysML * (1 + spread);
      const sampledDays = triangular(daysMin, scheduleDaysML, daysMax);

      const costTriggers = Math.random() < probability;
      const daysTriggers = Math.random() < probability;
      if (costTriggers) totalCost += sampledCost;
      if (daysTriggers) totalDays += sampledDays;

      const acc = perRiskSums.get(risk.id)!;
      if (costTriggers) {
        acc.costSum += sampledCost;
        acc.triggeredCount += 1;
      }
      if (daysTriggers) acc.daysSum += sampledDays;
      const costContrib = costTriggers ? sampledCost : 0;
      const n = acc.welfordN + 1;
      const delta = costContrib - acc.welfordMean;
      acc.welfordMean += delta / n;
      acc.welfordM2 += delta * (costContrib - acc.welfordMean);
      acc.welfordN = n;
    }
    if (totalCost !== 0) portfolioTriggeredCount += 1;
    costSamples.push(totalCost);
    daysSamples.push(totalDays);
  }

  const portfolioSimStdDev = stdDev(costSamples);
  const portfolioTriggerRate =
    iterations > 0 ? portfolioTriggeredCount / iterations : undefined;

  costSamples.sort((a, b) => a - b);
  const p50 = costSamples[Math.floor(iterations * 0.5)] ?? 0;
  const p80 = costSamples[Math.floor(iterations * 0.8)] ?? 0;
  const p90 = costSamples[Math.floor(iterations * 0.9)] ?? 0;

  const riskSnapshots: SimulationRiskSnapshot[] = risks.map((risk) => {
    const probability = normalizeProbability(
      risk.residualRating?.probability ?? risk.inherentRating?.probability
    );
    const explicitCost =
      typeof risk.costImpact === "number" ? risk.costImpact : Number(risk.costImpact);
    const costML =
      (Number.isFinite(explicitCost) && explicitCost > 0 ? explicitCost : 0) ||
      costFromConsequence(
        risk.residualRating?.consequence ?? risk.inherentRating?.consequence
      );
    const scheduleDaysML = risk.scheduleImpactDays ?? 0;
    const expectedCost = probability * costML;
    const expectedDays = probability * scheduleDaysML;
    const acc = perRiskSums.get(risk.id)!;
    const variance = acc.welfordN > 0 ? acc.welfordM2 / acc.welfordN : 0;
    const simStdDev = Math.sqrt(variance);
    const triggerRate = acc.triggeredCount / iterations;
    if (DEBUG_SIM && risk.id === risks[0]?.id) {
      // eslint-disable-next-line no-console
      console.log("[DEBUG_SIM] per-risk sample", {
        riskId: risk.id,
        simMeanCost: acc.costSum / iterations,
        simStdDev,
        triggerRate,
      });
    }
    return {
      id: risk.id,
      title: risk.title,
      category: risk.category,
      expectedCost,
      expectedDays,
      simMeanCost: acc.costSum / iterations,
      simMeanDays: acc.daysSum / iterations,
      simStdDev,
      triggerRate,
    };
  });

  return {
    id: makeId("sim"),
    timestampIso: new Date().toISOString(),
    iterations,
    p50Cost: p50,
    p80Cost: p80,
    p90Cost: p90,
    totalExpectedCost: mean(costSamples),
    totalExpectedDays: mean(daysSamples),
    risks: riskSnapshots,
    simStdDev: portfolioSimStdDev,
    triggerRate: portfolioTriggerRate,
  };
}
