export type BenefitMetric = "p80CostReduction";

export type MitigationCurvePoint = {
  incrementalSpend: number;
  cumulativeSpend: number;
  marginalBenefit: number;
  cumulativeBenefit: number;
  benefitPerDollar: number;
};

export type MitigationOptimisationRiskResult = {
  riskId: string;
  riskName: string;
  leverageScore: number;
  bestROIBand: { from: number; to: number };
  topBandBenefitPerDollar: number;
  explanation: string;
  curve: MitigationCurvePoint[];
};

export type MitigationOptimisationResult = {
  baseline: { neutralP80: number };
  ranked: MitigationOptimisationRiskResult[];
  meta: {
    spendStepsUsed: number[];
    metricUsed: BenefitMetric;
    usedFallbackMaterialityCount: number;
    usedDefaultMitigationParamsCount: number;
  };
  budgetPlan?: {
    budgetCap: number;
    totalProjectedBenefit: number;
    allocations: Array<{
      riskId: string;
      riskName: string;
      band: { from: number; to: number };
      spend: number;
      marginalBenefit: number;
      benefitPerDollar: number;
    }>;
  };
};

export function computeMitigationOptimisation(args: {
  risks: any[];
  neutralSnapshot: any;
  spendSteps?: number[];
  benefitMetric?: BenefitMetric;
  budgetCap?: number;
}): MitigationOptimisationResult {
  const spendStepsUsed = args.spendSteps ?? [0, 25_000, 50_000, 100_000, 200_000];

  // For now: minimal safe stub, no snapshot parsing yet.
  // We will implement neutralP80 extraction in the next micro-step.
  const neutralP80 = 0;

  return {
    baseline: { neutralP80 },
    ranked: [],
    meta: {
      spendStepsUsed,
      metricUsed: args.benefitMetric ?? "p80CostReduction",
      usedFallbackMaterialityCount: 0,
      usedDefaultMitigationParamsCount: 0,
    },
  };
}
