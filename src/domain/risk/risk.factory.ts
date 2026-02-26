import type { Risk, RiskCategory, RiskStatus } from "./risk.schema";
import { buildRating } from "./risk.logic";
import { makeId } from "@/lib/id";
import { nowIso } from "@/lib/time";

export function createRisk(partial?: Partial<Risk>): Risk {
  const createdAt = nowIso();

  const category: RiskCategory = partial?.category ?? "commercial";
  const status: RiskStatus = partial?.status ?? "open";

  const inherent = partial?.inherent ?? buildRating(3, 3);

  return {
    id: partial?.id ?? makeId(),
    title: partial?.title ?? "Sample risk: Long lead switchgear",
    description: partial?.description,

    category,
    status,

    owner: partial?.owner ?? "Unassigned",
    mitigation: partial?.mitigation ?? "Confirm lead times, place early order, consider alternates",
    contingency: partial?.contingency,

    inherent,
    residual: partial?.residual ?? inherent,

    dueDate: partial?.dueDate,
    costImpact: partial?.costImpact,
    scheduleImpactDays: partial?.scheduleImpactDays,

    createdAt: partial?.createdAt ?? createdAt,
    updatedAt: partial?.updatedAt ?? createdAt,
  };
}