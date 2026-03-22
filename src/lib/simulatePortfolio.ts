import type { Risk } from "@/domain/risk/risk.schema";
import { probability01FromScale } from "@/domain/risk/risk.logic";
import type { SimulationRiskSnapshot, SimulationSnapshot } from "@/domain/simulation/simulation.types";
import { makeId } from "@/lib/id";
import type { ProjectionProfile } from "@/lib/projectionProfiles";

const DEFAULT_ITERATIONS = 10000;
const DEFAULT_COST_SPREAD_PCT = 0.2;

/** Schedule impact (days) is clamped to 0–30 for simulation. */
const SCHEDULE_IMPACT_DAYS_CAP = 30;

/** Spread multiplier by profile (same Day 10 intent: conservative = more uncertainty/wider spread, aggressive = tighter). 0.5–1.5x of neutral. */
function costSpreadMultiplier(profile: ProjectionProfile): number {
  const map: Record<ProjectionProfile, number> = {
    conservative: 1.25,
    neutral: 1,
    aggressive: 0.85,
  };
  return map[profile];
}

/** Sample from triangular distribution (min, mode, max). Returns mode if min === max. */
function triangular(min: number, mode: number, max: number): number {
  if (min === max) return mode;
  const u = Math.random();
  const c = (mode - min) / (max - min);
  if (u <= c) return min + Math.sqrt(u * (max - min) * (mode - min));
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

/** Probability for simulation: prefer risk.probability (0–1, scenario-adjusted) when present; else 1–5 scale from ratings. */
function getSimProbability(risk: Risk): number {
  if (typeof risk.probability === "number" && Number.isFinite(risk.probability) && risk.probability >= 0 && risk.probability <= 1)
    return risk.probability;
  const scale = risk.residualRating?.probability ?? risk.inherentRating?.probability ?? 3;
  return probability01FromScale(scale);
}

/** Cost for simulation: post ML if mitigated and set, else pre ML, else consequence mapping. */
function getSimCostML(risk: Risk): number {
  const hasMitigation = Boolean(risk.mitigation?.trim());
  const post = risk.postMitigationCostML;
  const pre = risk.preMitigationCostML;
  if (hasMitigation && typeof post === "number" && Number.isFinite(post) && post > 0) return post;
  if (typeof pre === "number" && Number.isFinite(pre) && pre > 0) return pre;
  return costFromConsequence(
    risk.residualRating?.consequence ?? risk.inherentRating?.consequence
  );
}

function scheduleDaysMLFromRisk(risk: Risk): number {
  const hasMitigation = Boolean(risk.mitigation?.trim());
  const rawDays =
    hasMitigation && typeof risk.postMitigationTimeML === "number" && Number.isFinite(risk.postMitigationTimeML)
      ? risk.postMitigationTimeML
      : typeof risk.preMitigationTimeML === "number" && Number.isFinite(risk.preMitigationTimeML)
        ? risk.preMitigationTimeML
        : 0;
  return Math.min(SCHEDULE_IMPACT_DAYS_CAP, Math.max(0, rawDays));
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
  /** When set, uses same Day 10 profile to scale cost spread (conservative = wider, aggressive = tighter). */
  profile?: ProjectionProfile;
};

/**
 * Monte Carlo-style portfolio simulation. No UI; returns a SimulationSnapshot.
 * When options.profile is set, cost spread is scaled by the same Day 10 projection profile (one engine, scenario changes parameters).
 */
export function simulatePortfolio(
  risks: Risk[],
  iterations: number = DEFAULT_ITERATIONS,
  options: SimulatePortfolioOptions = {}
): SimulationSnapshot {
  const baseSpread = options.costSpreadPct ?? DEFAULT_COST_SPREAD_PCT;
  const spread = options.profile
    ? baseSpread * costSpreadMultiplier(options.profile)
    : baseSpread;

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
      const probability = getSimProbability(risk);
      const costML = getSimCostML(risk);
      const scheduleDaysML = scheduleDaysMLFromRisk(risk);

      const costMin = costML * (1 - spread);
      const costMax = costML * (1 + spread);
      const sampledCost = triangular(costMin, costML, costMax);

      const daysMin = Math.max(0, scheduleDaysML * (1 - spread));
      const daysMax = Math.min(SCHEDULE_IMPACT_DAYS_CAP, scheduleDaysML * (1 + spread));
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
  const p20 = costSamples[Math.floor(iterations * 0.2)] ?? 0;
  const p50 = costSamples[Math.floor(iterations * 0.5)] ?? 0;
  const p80 = costSamples[Math.floor(iterations * 0.8)] ?? 0;
  const p90 = costSamples[Math.floor(iterations * 0.9)] ?? 0;

  const riskSnapshots: SimulationRiskSnapshot[] = risks.map((risk) => {
    const probability = getSimProbability(risk);
    const costML = getSimCostML(risk);
    const scheduleDaysML = scheduleDaysMLFromRisk(risk);
    const expectedCost = probability * costML;
    const expectedDays = probability * scheduleDaysML;
    const acc = perRiskSums.get(risk.id)!;
    const variance = acc.welfordN > 0 ? acc.welfordM2 / acc.welfordN : 0;
    const simStdDev = Math.sqrt(variance);
    const triggerRate = acc.triggeredCount / iterations;
    return {
      id: risk.id,
      title: risk.title,
      category: risk.category,
      status: risk.status,
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
    p20Cost: p20,
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
