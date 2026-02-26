import { z } from "zod";

/**
 * Enums (tight + explicit = consistency everywhere)
 */
export const RiskStatusSchema = z.enum(["open", "monitoring", "closed"]);
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

  title: z.string().min(1),
  description: z.string().optional(),

  category: RiskCategorySchema,
  status: RiskStatusSchema,

  owner: z.string().optional(),

  mitigation: z.string().optional(),
  contingency: z.string().optional(),

  inherent: RiskRatingSchema,
  residual: RiskRatingSchema.optional(),

  dueDate: z.string().optional(), // YYYY-MM-DD (simple Day-1)
  costImpact: z.number().optional(),
  scheduleImpactDays: z.number().int().optional(),

  createdAt: z.string().min(1), // ISO datetime
  updatedAt: z.string().min(1), // ISO datetime
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