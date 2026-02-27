import type { Risk } from "@/domain/risk/risk.schema";
import type { SimulationRiskSnapshot, SimulationSnapshot } from "@/domain/simulation/simulation.types";
import { makeId } from "@/lib/id";

const DEFAULT_ITERATIONS = 1000;
const DEFAULT_COST_SPREAD_PCT = 0.2;

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
  const perRiskSums = new Map<string, { costSum: number; daysSum: number }>();
  for (const risk of risks) {
    perRiskSums.set(risk.id, { costSum: 0, daysSum: 0 });
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

      const sums = perRiskSums.get(risk.id)!;
      if (costTriggers) sums.costSum += sampledCost;
      if (daysTriggers) sums.daysSum += sampledDays;
    }
    costSamples.push(totalCost);
    daysSamples.push(totalDays);
  }

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
    const sums = perRiskSums.get(risk.id)!;
    return {
      id: risk.id,
      title: risk.title,
      category: risk.category,
      expectedCost,
      expectedDays,
      simMeanCost: sums.costSum / iterations,
      simMeanDays: sums.daysSum / iterations,
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
  };
}
