import { z } from "zod";

/**
 * Enums (tight + explicit = consistency everywhere)
 */
export const RiskStatusSchema = z.enum(["draft", "open", "monitoring", "mitigating", "closed"]);
export type RiskStatus = z.infer<typeof RiskStatusSchema>;

export const RiskCategorySchema = z.enum([
  "commercial",
  "programme",
  "design",
  "construction",
  "procurement",
  "hse",
  "authority",
  "operations",
  "other",
]);
export type RiskCategory = z.infer<typeof RiskCategorySchema>;

export const RiskLevelSchema = z.enum(["low", "medium", "high", "extreme"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

/** Whether risk impact applies to time, cost, or both. */
export const AppliesToSchema = z.enum(["time", "cost", "both"]);
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
  costImpact: z.number().optional(),
  scheduleImpactDays: z.number().int().optional(),

  /** User-facing: impact applies to Time, Cost, or Both. */
  appliesTo: AppliesToSchema.optional(),
  /** Pre-mitigation probability 0–100 %. */
  preMitigationProbabilityPct: z.number().min(0).max(100).optional(),
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
  /** Post-mitigation probability 0–100 %. */
  postMitigationProbabilityPct: z.number().min(0).max(100).optional(),
  /** Post-mitigation cost range ($). */
  postMitigationCostMin: z.number().min(0).optional(),
  postMitigationCostML: z.number().min(0).optional(),
  postMitigationCostMax: z.number().min(0).optional(),
  /** Post-mitigation time range (days). */
  postMitigationTimeMin: z.number().int().min(0).optional(),
  postMitigationTimeML: z.number().int().min(0).optional(),
  postMitigationTimeMax: z.number().int().min(0).optional(),

  /** Forward exposure: base cost impact (e.g. expected value basis). */
  baseCostImpact: z.number().optional(),
  /** Forward exposure: trigger probability 0..1 (distinct from inherent 1–5 scale). */
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