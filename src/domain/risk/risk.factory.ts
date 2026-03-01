import type { Risk, RiskCategory, RiskStatus } from "./risk.schema";
import { buildRating } from "./risk.logic";
import { makeId } from "@/lib/id";
import { nowIso } from "@/lib/time";

const DEFAULT_MITIGATION_PROFILE = {
  status: "active" as const,
  effectiveness: 0.6,
  confidence: 0.7,
  reduces: 0.5,
  lagMonths: 3,
};

export function createRisk(partial?: Partial<Risk>): Risk {
  const createdAt = nowIso();

  const category: RiskCategory = partial?.category ?? "commercial";
  const status: RiskStatus = partial?.status ?? "open";

  const inherentRating = partial?.inherentRating ?? buildRating(3, 3);
  const residualRating = partial?.residualRating ?? inherentRating;

  return {
    id: partial?.id ?? makeId(),
    riskNumber: partial?.riskNumber,
    title: partial?.title ?? "Sample risk: Long lead switchgear",
    description: partial?.description,

    category,
    status,

    owner: partial?.owner,
    mitigation: partial?.mitigation ?? "Confirm lead times, place early order, consider alternates",
    contingency: partial?.contingency,

    inherentRating,
    residualRating,

    dueDate: partial?.dueDate,
    costImpact: partial?.costImpact,
    scheduleImpactDays: partial?.scheduleImpactDays,

    appliesTo: partial?.appliesTo ?? "both",
    preMitigationProbabilityPct: partial?.preMitigationProbabilityPct,
    preMitigationCostMin: partial?.preMitigationCostMin,
    preMitigationCostML: partial?.preMitigationCostML,
    preMitigationCostMax: partial?.preMitigationCostMax,
    preMitigationTimeMin: partial?.preMitigationTimeMin,
    preMitigationTimeML: partial?.preMitigationTimeML,
    preMitigationTimeMax: partial?.preMitigationTimeMax,
    mitigationCost: partial?.mitigationCost,
    postMitigationProbabilityPct: partial?.postMitigationProbabilityPct,
    postMitigationCostMin: partial?.postMitigationCostMin,
    postMitigationCostML: partial?.postMitigationCostML,
    postMitigationCostMax: partial?.postMitigationCostMax,
    postMitigationTimeMin: partial?.postMitigationTimeMin,
    postMitigationTimeML: partial?.postMitigationTimeML,
    postMitigationTimeMax: partial?.postMitigationTimeMax,

    baseCostImpact: partial?.baseCostImpact ?? 50_000,
    probability: partial?.probability ?? 0.4,
    escalationPersistence: partial?.escalationPersistence ?? 0.5,
    sensitivity: partial?.sensitivity ?? 0.5,
    timeProfile: partial?.timeProfile ?? "mid",
    mitigationProfile: partial?.mitigationProfile ?? DEFAULT_MITIGATION_PROFILE,

    createdAt: partial?.createdAt ?? createdAt,
    updatedAt: partial?.updatedAt ?? createdAt,
  };
}