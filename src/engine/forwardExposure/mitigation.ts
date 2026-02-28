/**
 * Mitigation adjustment by month (pure, deterministic).
 * Clamps profile 0..1 fields and guards against NaN/Infinity.
 */

import type { Risk } from "@/domain/risk/risk.schema";
import type { MitigationAdjustment } from "./types";
import { safeNum, clamp01, clampNonNegativeInt } from "./validate";

const DEFAULT_IMPACT_MULTIPLIER = 1;
const DEFAULT_PROB_MULTIPLIER = 1;

/**
 * Returns probability and impact multipliers for a given month based on mitigation profile.
 * Before lagMonths: no reduction. After lagMonths and status active/completed: impact reduced by (reduces * effectiveness).
 */
export function computeMitigationAdjustment(
  risk: Risk,
  monthIndex: number
): MitigationAdjustment {
  const profile = risk.mitigationProfile;
  if (!profile) {
    return { probMultiplier: DEFAULT_PROB_MULTIPLIER, impactMultiplier: DEFAULT_IMPACT_MULTIPLIER };
  }

  const lagMonths = clampNonNegativeInt(profile.lagMonths, 0);
  const applies = monthIndex >= lagMonths && (profile.status === "active" || profile.status === "completed");
  if (!applies) {
    return { probMultiplier: DEFAULT_PROB_MULTIPLIER, impactMultiplier: DEFAULT_IMPACT_MULTIPLIER };
  }

  const effectiveness = clamp01(safeNum(profile.effectiveness, 0.5));
  const reduces = clamp01(safeNum(profile.reduces, 0));
  const impactMultiplier = Math.max(0, Math.min(1, 1 - reduces * effectiveness));
  const probMultiplier = Math.max(0, Math.min(1, 1 - effectiveness * 0.5));
  return {
    probMultiplier: Number.isFinite(probMultiplier) ? probMultiplier : DEFAULT_PROB_MULTIPLIER,
    impactMultiplier: Number.isFinite(impactMultiplier) ? impactMultiplier : DEFAULT_IMPACT_MULTIPLIER,
  };
}
