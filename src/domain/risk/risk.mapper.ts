import type { Risk, RiskDraft, RiskStatus } from "./risk.schema";
import { buildRating } from "./risk.logic";
import { makeId } from "@/lib/id";
import { nowIso } from "@/lib/time";

const DEFAULT_STATUS: RiskStatus = "open";

/**
 * Convert an AI draft into a full production Risk object.
 * - deterministic scoring happens here
 * - id + timestamps controlled by app, not AI
 */
export function draftToRisk(draft: RiskDraft): Risk {
  const createdAt = nowIso();

  const inherentRating = buildRating(draft.probability, draft.consequence);
  // Day-1 choice: set residual initially equal to inherent so UI always has values
  const residualRating = inherentRating;

  return {
    id: makeId(),
    title: draft.title,
    description: undefined,

    category: draft.category,
    status: draft.status ?? DEFAULT_STATUS,

    owner: draft.owner,
    mitigation: draft.mitigation,
    contingency: undefined,

    inherentRating,
    residualRating,

    dueDate: undefined,
    costImpact: undefined,
    scheduleImpactDays: undefined,

    baseCostImpact: undefined,
    probability: undefined,
    escalationPersistence: undefined,
    sensitivity: undefined,
    timeProfile: undefined,
    mitigationProfile: undefined,

    createdAt,
    updatedAt: createdAt,
  };
}

export function draftsToRisks(drafts: RiskDraft[]): Risk[] {
  return drafts.map(draftToRisk);
}