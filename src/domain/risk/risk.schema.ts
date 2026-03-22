import { z } from "zod";

/**
 * Stored on `risks.status` as free text; UI options come from `riskai_risk_statuses.name`.
 */
export const RiskStatusSchema = z.string().min(1);
export type RiskStatus = z.infer<typeof RiskStatusSchema>;

/** Stored on `risks.category` as free text; UI options come from `riskai_risk_categories.name`. Empty allowed for in-register drafts before the user picks a category. */
export const RiskCategorySchema = z.string();
export type RiskCategory = z.infer<typeof RiskCategorySchema>;

export const RiskLevelSchema = z.enum(["low", "medium", "high", "extreme"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

/** Stored on `risks.applies_to` as free text; UI options come from `riskai_risk_applies_to.name`. */
export const AppliesToSchema = z.string().min(1);
export type AppliesTo = z.infer<typeof AppliesToSchema>;

/**
 * Forward exposure: time profile — either named profile or weights by month.
 */
export const TimeProfileKindSchema = z.enum(["front", "mid", "back"]);
export type TimeProfileKind = z.infer<typeof TimeProfileKindSchema>;
export const TimeProfileSchema = z.union([
  TimeProfileKindSchema,
  z.array(z.number()), // weights by month
]);
export type TimeProfile = z.infer<typeof TimeProfileSchema>;

/**
 * Forward exposure: structured mitigation (status, effectiveness, lag).
 */
export const MitigationStatusSchema = z.enum(["none", "planned", "active", "completed"]);
export type MitigationStatus = z.infer<typeof MitigationStatusSchema>;
export const MitigationProfileSchema = z.object({
  status: MitigationStatusSchema,
  effectiveness: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  reduces: z.number().min(0).max(1), // fraction of impact reduced
  lagMonths: z.number().int().min(0),
});
export type MitigationProfile = z.infer<typeof MitigationProfileSchema>;

/**
 * Scales (Day-1: 1–5)
 */
export const RiskScoreValueSchema = z.number().int().min(1).max(5);

/**
 * Deterministic rating object (score/level computed in code)
 */
export const RiskRatingSchema = z.object({
  probability: RiskScoreValueSchema,
  consequence: RiskScoreValueSchema,
  score: z.number().int().min(1).max(25),
  level: RiskLevelSchema,
});
export type RiskRating = z.infer<typeof RiskRatingSchema>;

/**
 * Production Risk schema (Day-1)
 * - enough for commercial use
 * - easy to extend later
 */
export const RiskSchema = z.object({
  id: z.string().min(1),
  /** Stable display ID (e.g. 001, 002); assigned on creation and never changed. */
  riskNumber: z.number().int().min(1).optional(),

  title: z.string().min(1),
  description: z.string().optional(),

  category: RiskCategorySchema,
  status: RiskStatusSchema,

  owner: z.string().optional(),

  mitigation: z.string().optional(),
  contingency: z.string().optional(),

  /** Strength of mitigation effect on score momentum (0 = none, 1 = full). Used for stress-test forecasts. */
  mitigationStrength: z.number().min(0).max(1).optional(),

  /** Timestamp (ms) of last edit to mitigation or contingency. */
  lastMitigationUpdate: z.number().optional(),

  inherentRating: RiskRatingSchema,
  residualRating: RiskRatingSchema,

  dueDate: z.string().optional(), // YYYY-MM-DD (simple Day-1)

  /** User-facing: impact applies to Time, Cost, or Both. */
  appliesTo: AppliesToSchema.optional(),
  /** Pre-mitigation cost range ($). */
  preMitigationCostMin: z.number().min(0).optional(),
  preMitigationCostML: z.number().min(0).optional(),
  preMitigationCostMax: z.number().min(0).optional(),
  /** Pre-mitigation time range (days). */
  preMitigationTimeMin: z.number().int().min(0).optional(),
  preMitigationTimeML: z.number().int().min(0).optional(),
  preMitigationTimeMax: z.number().int().min(0).optional(),
  /** Mitigation cost ($). */
  mitigationCost: z.number().min(0).optional(),
  /** Post-mitigation cost range ($). */
  postMitigationCostMin: z.number().min(0).optional(),
  postMitigationCostML: z.number().min(0).optional(),
  postMitigationCostMax: z.number().min(0).optional(),
  /** Post-mitigation time range (days). */
  postMitigationTimeMin: z.number().int().min(0).optional(),
  postMitigationTimeML: z.number().int().min(0).optional(),
  postMitigationTimeMax: z.number().int().min(0).optional(),

  /** Forward exposure / scenario: trigger probability 0..1 (computed in app, not a DB column). */
  probability: z.number().min(0).max(1).optional(),
  /** Forward exposure: how much escalation persists over time (0..1). */
  escalationPersistence: z.number().min(0).max(1).optional(),
  /** Forward exposure: sensitivity to drivers (0..1). */
  sensitivity: z.number().min(0).max(1).optional(),
  /** Forward exposure: timing — 'front'|'mid'|'back' or weights array by month. */
  timeProfile: TimeProfileSchema.optional(),
  /** Forward exposure: structured mitigation (status, effectiveness, lag). */
  mitigationProfile: MitigationProfileSchema.optional(),

  createdAt: z.string().min(1), // ISO datetime
  updatedAt: z.string().min(1), // ISO datetime

  /** Snapshot history for composite score over time (optional for backward compatibility). */
  scoreHistory: z
    .array(z.object({ timestamp: z.number(), compositeScore: z.number() }))
    .optional(),

  /** Audit: risk IDs that were merged into this risk (AI Review). */
  mergedFromRiskIds: z.array(z.string()).optional(),
  /** Audit: cluster ID from AI merge review. */
  aiMergeClusterId: z.string().optional(),
});
export type Risk = z.infer<typeof RiskSchema>;

/**
 * What the AI is allowed to return (draft fields only).
 * We do NOT allow AI to set: id, timestamps, score, level.
 */
export const RiskDraftSchema = z.object({
  title: z.string().min(1),
  category: RiskCategorySchema,
  probability: RiskScoreValueSchema,
  consequence: RiskScoreValueSchema,
  status: RiskStatusSchema.optional(),
  owner: z.string().optional(),
  mitigation: z.string().optional(),
});
export type RiskDraft = z.infer<typeof RiskDraftSchema>;

export const RiskDraftResponseSchema = z.object({
  risks: z.array(RiskDraftSchema),
});
export type RiskDraftResponse = z.infer<typeof RiskDraftResponseSchema>;

/** Normalise appliesTo from AI; known words map to lowercase, else keep trimmed text. */
const appliesToIntelligent = z.union([z.string(), z.number()]).transform((raw) => {
  const s = String(raw ?? "").trim();
  if (!s) return "both";
  const lower = s.toLowerCase();
  if (lower === "time" || lower === "cost" || lower === "both") return lower;
  return s;
});

const categoryIntelligent = z
  .union([z.string(), z.number()])
  .transform((s) => {
    const t = String(s ?? "").trim();
    return t.length > 0 ? t : "other";
  });

function numCoerce(minVal = 0): z.ZodType<number> {
  return z.union([z.number(), z.string()]).transform((v) => {
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? Math.max(minVal, n) : minVal;
  });
}
function intCoerce(minVal = 0): z.ZodType<number> {
  return z.union([z.number(), z.string()]).transform((v) => {
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? Math.max(minVal, Math.floor(n)) : minVal;
  });
}

/**
 * Single-risk intelligent extraction draft (Generate AI Risk from free text).
 * All numeric fields are required; use 0 when impact type does not apply.
 * Post-mitigation fields: when mitigation is detected, AI must populate; otherwise omit and mapper uses pre-values.
 */
export const IntelligentExtractDraftSchema = z.object({
  title: z.string().min(1).transform((s) => s.trim()),
  description: z.string().optional().transform((s) => (s != null && String(s).trim() !== "" ? String(s).trim() : undefined)),
  category: categoryIntelligent,
  owner: z
    .union([z.string(), z.number(), z.undefined(), z.null()])
    .optional()
    .transform((s) => {
      const t = String(s ?? "").trim();
      return t.length > 0 ? t : undefined;
    }),
  probability: z.union([z.number(), z.string()]).transform((v) => {
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 50;
  }),
  costMin: numCoerce(0),
  costMostLikely: numCoerce(0),
  costMax: numCoerce(0),
  timeMin: intCoerce(0),
  timeMostLikely: intCoerce(0),
  timeMax: intCoerce(0),
  appliesTo: appliesToIntelligent,
  mitigation: z.string().optional().transform((s) => (s != null && String(s).trim() !== "" ? String(s).trim() : undefined)),
  contingency: z.string().optional().transform((s) => (s != null && String(s).trim() !== "" ? String(s).trim() : undefined)),
  /** Mitigation cost ($). Extracted from phrases like "at a cost of $250k". */
  mitigationCost: z.union([z.number(), z.string()]).optional().transform((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }),
  /** Post-mitigation probability 0–100. Never higher than pre; 0 if mitigation eliminates risk. */
  postProbability: z.union([z.number(), z.string()]).optional().transform((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : undefined;
  }),
  postCostMin: z.union([z.number(), z.string()]).optional().transform((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? Math.max(0, n) : undefined;
  }),
  postCostMostLikely: z.union([z.number(), z.string()]).optional().transform((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? Math.max(0, n) : undefined;
  }),
  postCostMax: z.union([z.number(), z.string()]).optional().transform((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? Math.max(0, n) : undefined;
  }),
  postTimeMin: z.union([z.number(), z.string()]).optional().transform((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : undefined;
  }),
  postTimeMostLikely: z.union([z.number(), z.string()]).optional().transform((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : undefined;
  }),
  postTimeMax: z.union([z.number(), z.string()]).optional().transform((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : undefined;
  }),
});
export type IntelligentExtractDraft = z.infer<typeof IntelligentExtractDraftSchema>;