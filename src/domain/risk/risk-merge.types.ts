import { z } from "zod";

/** Coerce string or number to number; empty/null/undefined → undefined. Clamp to [min, max] when provided. */
function optionalNum(min = 0, max = Number.POSITIVE_INFINITY) {
  return z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .optional()
    .transform((s) => {
      if (s === undefined || s === null || s === "") return undefined;
      const n = Number(s);
      if (!Number.isFinite(n)) return undefined;
      return Math.max(min, Math.min(max, n));
    });
}

/** Coerce to integer for time fields. */
function optionalInt(min = 0, max = Number.POSITIVE_INFINITY) {
  return z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .optional()
    .transform((s) => {
      if (s === undefined || s === null || s === "") return undefined;
      const n = Number(s);
      if (!Number.isFinite(n)) return undefined;
      return Math.floor(Math.max(min, Math.min(max, n)));
    });
}

/** Any non-empty trimmed string from AI / editor; empty → undefined. */
const mergeAppliesToField = z
  .union([z.string(), z.null(), z.undefined()])
  .optional()
  .transform((s) => {
    if (s === undefined || s === null) return undefined;
    const t = String(s).trim();
    return t.length > 0 ? t : undefined;
  });

const mergeStatusField = z
  .union([z.string(), z.null(), z.undefined()])
  .optional()
  .transform((s) => {
    if (s === undefined || s === null) return undefined;
    const t = String(s).trim();
    return t.length > 0 ? t : undefined;
  });

/**
 * Draft shape for a merged risk returned by the AI merge-review API.
 * Same shape as Risk for display/apply, but id/createdAt/updatedAt/scoreHistory omitted.
 * Uses coercion so AI-returned string numbers and variant casing are accepted.
 */
export const MergeRiskDraftSchema = z.object({
  title: z.union([z.string(), z.number()]).transform((s) => String(s ?? "").trim()).refine((s) => s.length > 0, "title required"),
  description: z.union([z.string(), z.undefined(), z.null()]).optional().transform((s) => (s != null && String(s).trim() !== "" ? String(s).trim() : undefined)),
  category: z
    .union([z.string(), z.number()])
    .transform((s) => String(s ?? "").trim())
    .refine((s) => s.length > 0, "category required"),
  status: mergeStatusField,
  owner: z.union([z.string(), z.undefined(), z.null()]).optional().transform((s) => (s != null && String(s).trim() !== "" ? String(s).trim() : undefined)),

  mitigation: z.union([z.string(), z.undefined(), z.null()]).optional().transform((s) => (s != null && String(s).trim() !== "" ? String(s).trim() : undefined)),
  contingency: z.union([z.string(), z.undefined(), z.null()]).optional().transform((s) => (s != null && String(s).trim() !== "" ? String(s).trim() : undefined)),

  appliesTo: mergeAppliesToField,
  preMitigationProbabilityPct: optionalNum(0, 100),
  preMitigationCostMin: optionalNum(0),
  preMitigationCostML: optionalNum(0),
  preMitigationCostMax: optionalNum(0),
  preMitigationTimeMin: optionalInt(0),
  preMitigationTimeML: optionalInt(0),
  preMitigationTimeMax: optionalInt(0),
  mitigationCost: optionalNum(0),
  postMitigationProbabilityPct: optionalNum(0, 100),
  postMitigationCostMin: optionalNum(0),
  postMitigationCostML: optionalNum(0),
  postMitigationCostMax: optionalNum(0),
  postMitigationTimeMin: optionalInt(0),
  postMitigationTimeML: optionalInt(0),
  postMitigationTimeMax: optionalInt(0),
});
export type MergeRiskDraft = z.infer<typeof MergeRiskDraftSchema>;

const MERGE_TYPE_VALUES = ["duplicate", "overlap", "parallel", "do_not_merge"] as const;
export const MergeTypeSchema = z.enum(MERGE_TYPE_VALUES);
export type MergeType = z.infer<typeof MergeTypeSchema>;

/** Cluster from AI; mergedDraft optional for do_not_merge (we filter those out before returning). */
export const RiskMergeClusterSchema = z.object({
  clusterId: z.union([z.string(), z.number()]).transform(String),
  confidence: z.union([z.number(), z.string()]).transform((s) => Math.max(0, Math.min(1, Number(s)))),
  mergeType: z.union([MergeTypeSchema, z.string()]).transform((s) => {
    const lower = (s ?? "").toString().toLowerCase().trim();
    return MERGE_TYPE_VALUES.includes(lower as (typeof MERGE_TYPE_VALUES)[number]) ? (lower as (typeof MERGE_TYPE_VALUES)[number]) : "do_not_merge";
  }),
  rationale: z.union([z.string(), z.undefined(), z.null()]).transform((s) => String(s ?? "").trim()),
  riskIds: z.array(z.union([z.string(), z.number()]).transform(String)),
  mergedDraft: MergeRiskDraftSchema.optional(),
});
export type RiskMergeCluster = z.infer<typeof RiskMergeClusterSchema>;

export const RiskMergeReviewRequestSchema = z.object({
  projectId: z.string(),
  risks: z.array(z.unknown()), // validated as Risk[] at runtime
});
export type RiskMergeReviewRequest = z.infer<typeof RiskMergeReviewRequestSchema>;

export const RiskMergeReviewResponseSchema = z.object({
  clusters: z.array(RiskMergeClusterSchema),
});
export type RiskMergeReviewResponse = z.infer<typeof RiskMergeReviewResponseSchema>;
