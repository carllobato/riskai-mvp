import type { SimulationSnapshot } from "@/domain/simulation/simulation.types";
import { getNeutralP80Cost } from "./getNeutralP80Cost";
import type {
  BenefitMetric,
  MitigationCurvePoint,
  MitigationOptimisationResult,
  MitigationOptimisationRiskResult,
} from "./types";

/** Minimal risk shape for mitigation optimisation (avoids importing domain Risk). */
type RiskInput = {
  id: string;
  title: string;
  probability?: number;
  costImpact?: number;
  baseCostImpact?: number;
  inherentRating?: { probability?: number; consequence?: number };
  residualRating?: { probability?: number; consequence?: number };
  mitigationProfile?: { effectiveness?: number; confidence?: number };
  mitigationStrength?: number;
};

const DEFAULT_MAX_REDUCTION = 0.25;
const BASE_K = 1 / 100_000;

/** Probability 0–1: prefer risk.probability, else normalise 1–5 from rating. */
function getProbability(r: RiskInput): number {
  if (typeof r.probability === "number" && Number.isFinite(r.probability) && r.probability >= 0 && r.probability <= 1)
    return r.probability;
  const p = r.residualRating?.probability ?? r.inherentRating?.probability;
  const n = typeof p === "number" ? p : Number(p);
  if (!Number.isFinite(n)) return 0.2;
  if (n >= 0 && n <= 1) return n;
  if (n >= 1 && n <= 5) return n / 5;
  return 0.2;
}

/** Cost (consequence mapped to $): same logic as sim – costImpact, baseCostImpact, or consequence 1–5 map. */
function getCost(r: RiskInput): number {
  const explicit = r.costImpact ?? r.baseCostImpact;
  if (typeof explicit === "number" && Number.isFinite(explicit) && explicit > 0) return explicit;
  const c = r.residualRating?.consequence ?? r.inherentRating?.consequence;
  const n = typeof c === "number" ? c : Number(c);
  if (!Number.isFinite(n)) return 0;
  const cc = Math.max(1, Math.min(5, Math.round(n)));
  const map: Record<number, number> = {
    1: 25_000,
    2: 100_000,
    3: 300_000,
    4: 750_000,
    5: 1_500_000,
  };
  return map[cc] ?? 0;
}

/** Materiality weight: from snapshot.risks[].expectedCost if available, else p*c, normalised. */
function getMaterialityWeights(
  risks: RiskInput[],
  neutralSnapshot: SimulationSnapshot | null | undefined
): { riskId: string; w: number; usedFallback: boolean }[] {
  const hasPerRisk =
    neutralSnapshot?.risks?.length &&
    risks.every((r) => neutralSnapshot.risks.some((s) => s.id === r.id));

  if (hasPerRisk && neutralSnapshot) {
    const byId = new Map(neutralSnapshot.risks.map((s) => [s.id, s.expectedCost]));
    const total = risks.reduce((sum, r) => sum + (byId.get(r.id) ?? 0), 0);
    if (total > 0) {
      return risks.map((r) => ({
        riskId: r.id,
        w: (byId.get(r.id) ?? 0) / total,
        usedFallback: false,
      }));
    }
  }

  const materialities = risks.map((r) => {
    const p = getProbability(r);
    const c = getCost(r);
    return { riskId: r.id, m: p * c, usedFallback: true };
  });
  const sum = materialities.reduce((s, x) => s + x.m, 0);
  if (sum <= 0) {
    const n = risks.length;
    return risks.map((r) => ({ riskId: r.id, w: n ? 1 / n : 0, usedFallback: true }));
  }
  return materialities.map(({ riskId, m, usedFallback }) => ({
    riskId,
    w: m / sum,
    usedFallback,
  }));
}

/** reduction(spend) = maxReduction * (1 - exp(-k * spend)) */
function reduction(spend: number, maxReduction: number, k: number): number {
  if (spend <= 0) return 0;
  return maxReduction * (1 - Math.exp(-k * spend));
}

export function computeMitigationOptimisation(args: {
  risks: RiskInput[];
  neutralSnapshot: SimulationSnapshot | null | undefined;
  spendSteps?: number[];
  benefitMetric?: BenefitMetric;
  budgetCap?: number;
}): MitigationOptimisationResult {
  const spendStepsUsed = args.spendSteps ?? [0, 25_000, 50_000, 100_000, 200_000];
  const benefitMetricUsed = args.benefitMetric ?? "p80CostReduction";

  let neutralP80: number;
  try {
    neutralP80 = args.neutralSnapshot ? getNeutralP80Cost(args.neutralSnapshot) : 0;
  } catch {
    neutralP80 = 0;
  }

  const weights = getMaterialityWeights(args.risks, args.neutralSnapshot);
  const weightByRiskId = new Map(weights.map((x) => [x.riskId, x.w]));
  const usedFallbackCount = weights.filter((x) => x.usedFallback).length;

  let usedDefaultMitigationCount = 0;
  const results: MitigationOptimisationRiskResult[] = args.risks.map((risk) => {
    const w = weightByRiskId.get(risk.id) ?? 0;
    const maxReduction =
      typeof risk.mitigationProfile?.effectiveness === "number"
        ? Math.max(0, Math.min(1, risk.mitigationProfile.effectiveness))
        : typeof risk.mitigationStrength === "number"
          ? Math.max(0, Math.min(1, risk.mitigationStrength))
          : (usedDefaultMitigationCount++, DEFAULT_MAX_REDUCTION);
    const conf = risk.mitigationProfile?.confidence;
    const k =
      typeof conf === "number" && Number.isFinite(conf)
        ? BASE_K * (0.8 + 0.4 * Math.max(0, Math.min(1, conf)))
        : BASE_K;

    const benefitAt = (spend: number) => neutralP80 * w * reduction(spend, maxReduction, k);

    const curve: MitigationCurvePoint[] = [];
    let prevCumulative = 0;
    for (let i = 0; i < spendStepsUsed.length; i++) {
      const cumulativeSpend = spendStepsUsed[i];
      const incrementalSpend = i === 0 ? 0 : cumulativeSpend - spendStepsUsed[i - 1];
      const cumulativeBenefit = benefitAt(cumulativeSpend);
      const marginalBenefit = cumulativeBenefit - prevCumulative;
      const benefitPerDollar = incrementalSpend > 0 ? marginalBenefit / incrementalSpend : 0;
      curve.push({
        incrementalSpend,
        cumulativeSpend,
        marginalBenefit,
        cumulativeBenefit,
        benefitPerDollar,
      });
      prevCumulative = cumulativeBenefit;
    }

    const firstNonZeroBand = curve.findIndex((p) => p.incrementalSpend > 0);
    const topBandBenefitPerDollar =
      firstNonZeroBand >= 0 ? curve[firstNonZeroBand].benefitPerDollar : 0;
    const bestROIIndex = curve.reduce((best, p, i) => (p.benefitPerDollar > curve[best].benefitPerDollar ? i : best), 0);
    const bestROIBand = {
      from: bestROIIndex === 0 ? 0 : spendStepsUsed[bestROIIndex - 1],
      to: spendStepsUsed[bestROIIndex],
    };
    const leverageScore = topBandBenefitPerDollar * w;

    const defaultsUsed: string[] = [];
    if (maxReduction === DEFAULT_MAX_REDUCTION) defaultsUsed.push("default maxReduction 0.25");
    if (typeof conf !== "number") defaultsUsed.push("default k");
    const explanation =
      `Materiality weight ${w.toFixed(3)}; best ROI band $${bestROIBand.from.toLocaleString()}–$${bestROIBand.to.toLocaleString()} ($${topBandBenefitPerDollar.toFixed(2)} benefit per dollar).` +
      (defaultsUsed.length ? ` ${defaultsUsed.join("; ")}.` : "");

    return {
      riskId: risk.id,
      riskName: risk.title,
      leverageScore,
      bestROIBand,
      topBandBenefitPerDollar,
      explanation,
      curve,
    };
  });

  const ranked = [...results].sort((a, b) => {
    if (b.leverageScore !== a.leverageScore) return b.leverageScore - a.leverageScore;
    const wa = weightByRiskId.get(a.riskId) ?? 0;
    const wb = weightByRiskId.get(b.riskId) ?? 0;
    if (wb !== wa) return wb - wa;
    return a.riskName.localeCompare(b.riskName);
  });

  let budgetPlan: MitigationOptimisationResult["budgetPlan"] | undefined;
  if (args.budgetCap != null && args.budgetCap > 0) {
    type Band = {
      riskId: string;
      riskName: string;
      from: number;
      to: number;
      spend: number;
      marginalBenefit: number;
      benefitPerDollar: number;
    };
    const bands: Band[] = [];
    for (const r of ranked) {
      for (let i = 1; i < r.curve.length; i++) {
        const pt = r.curve[i];
        if (pt.incrementalSpend > 0 && pt.benefitPerDollar > 0)
          bands.push({
            riskId: r.riskId,
            riskName: r.riskName,
            from: r.curve[i - 1].cumulativeSpend,
            to: pt.cumulativeSpend,
            spend: pt.incrementalSpend,
            marginalBenefit: pt.marginalBenefit,
            benefitPerDollar: pt.benefitPerDollar,
          });
      }
    }
    bands.sort((a, b) => b.benefitPerDollar - a.benefitPerDollar);

    let remaining = args.budgetCap;
    const allocations: Band[] = [];
    for (const band of bands) {
      if (remaining <= 0) break;
      if (band.spend <= remaining) {
        allocations.push(band);
        remaining -= band.spend;
      }
    }
    const totalProjectedBenefit = allocations.reduce((s, a) => s + a.marginalBenefit, 0);
    budgetPlan = {
      budgetCap: args.budgetCap,
      totalProjectedBenefit,
      allocations: allocations.map((a) => ({
        riskId: a.riskId,
        riskName: a.riskName,
        band: { from: a.from, to: a.to },
        spend: a.spend,
        marginalBenefit: a.marginalBenefit,
        benefitPerDollar: a.benefitPerDollar,
      })),
    };
  }

  return {
    baseline: { neutralP80 },
    ranked,
    meta: {
      spendStepsUsed: [...spendStepsUsed],
      metricUsed: benefitMetricUsed,
      usedFallbackMaterialityCount: usedFallbackCount,
      usedDefaultMitigationParamsCount: usedDefaultMitigationCount,
    },
    ...(budgetPlan && { budgetPlan }),
  };
}
