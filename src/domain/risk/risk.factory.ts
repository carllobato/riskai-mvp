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
    title: partial?.title ?? "Sample risk: Long lead switchgear",
    description: partial?.description,

    category,
    status,

    owner: partial?.owner ?? "Unassigned",
    mitigation: partial?.mitigation ?? "Confirm lead times, place early order, consider alternates",
    contingency: partial?.contingency,

    inherentRating,
    residualRating,

    dueDate: partial?.dueDate,
    costImpact: partial?.costImpact,
    scheduleImpactDays: partial?.scheduleImpactDays,

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