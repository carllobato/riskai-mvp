import type { Risk, RiskDraft, RiskStatus } from "./risk.schema";
import { buildRating, probabilityPctToScale, costToConsequenceScale, timeDaysToConsequenceScale } from "./risk.logic";
import { makeId } from "@/lib/id";
import { nowIso } from "@/lib/time";
import type { MergeRiskDraft } from "./risk-merge.types";

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

/**
 * Convert an AI merge draft into a full Risk for the register.
 * Derives inherent/residual rating from pre/post mitigation % and cost/time ML when present.
 */
export function mergeDraftToRisk(
  draft: MergeRiskDraft,
  options: { mergedFromRiskIds: string[]; aiMergeClusterId: string; riskNumber?: number }
): Risk {
  const createdAt = nowIso();
  const prePct = draft.preMitigationProbabilityPct ?? 50;
  const postPct = draft.postMitigationProbabilityPct ?? draft.preMitigationProbabilityPct ?? 50;
  const preCost = draft.preMitigationCostML ?? 0;
  const preTime = draft.preMitigationTimeML ?? 0;
  const postCost = draft.postMitigationCostML ?? preCost;
  const postTime = draft.postMitigationTimeML ?? preTime;

  const probPre = probabilityPctToScale(prePct);
  const probPost = probabilityPctToScale(postPct);
  const consPre = Math.max(
    costToConsequenceScale(preCost),
    timeDaysToConsequenceScale(preTime),
    1
  );
  const consPost = Math.max(
    costToConsequenceScale(postCost),
    timeDaysToConsequenceScale(postTime),
    1
  );

  const inherentRating = buildRating(probPre, consPre);
  const residualRating = buildRating(probPost, consPost);

  return {
    id: makeId(),
    riskNumber: options.riskNumber,
    title: draft.title,
    description: draft.description,
    category: draft.category,
    status: draft.status ?? "open",
    owner: draft.owner?.trim() || undefined,
    mitigation: draft.mitigation,
    contingency: draft.contingency,
    inherentRating,
    residualRating,
    appliesTo: draft.appliesTo,
    preMitigationProbabilityPct: draft.preMitigationProbabilityPct,
    preMitigationCostMin: draft.preMitigationCostMin,
    preMitigationCostML: draft.preMitigationCostML,
    preMitigationCostMax: draft.preMitigationCostMax,
    preMitigationTimeMin: draft.preMitigationTimeMin,
    preMitigationTimeML: draft.preMitigationTimeML,
    preMitigationTimeMax: draft.preMitigationTimeMax,
    mitigationCost: draft.mitigationCost,
    postMitigationProbabilityPct: draft.postMitigationProbabilityPct,
    postMitigationCostMin: draft.postMitigationCostMin,
    postMitigationCostML: draft.postMitigationCostML,
    postMitigationCostMax: draft.postMitigationCostMax,
    postMitigationTimeMin: draft.postMitigationTimeMin,
    postMitigationTimeML: draft.postMitigationTimeML,
    postMitigationTimeMax: draft.postMitigationTimeMax,
    mergedFromRiskIds: options.mergedFromRiskIds,
    aiMergeClusterId: options.aiMergeClusterId,
    createdAt,
    updatedAt: createdAt,
  };
}