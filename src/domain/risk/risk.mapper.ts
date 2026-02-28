import type { Risk, RiskDraft, RiskStatus } from "./risk.schema";
import { buildRating } from "./risk.logic";
import { makeId } from "@/lib/id";
import { nowIso } from "@/lib/time";

/** AI-generated risks start as draft; user must review and save to move to open. */
const AI_DRAFT_STATUS: RiskStatus = "draft";

/**
 * Convert an AI draft into a full production Risk object.
 * - deterministic scoring happens here
 * - id + timestamps controlled by app, not AI
 * - status is always "draft" so user must review and save to open
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
    status: AI_DRAFT_STATUS,

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