/**
 * Validation and clamping for forward exposure inputs.
 * Ensures 0..1 fields are clamped, time weights sum to 1, missing fields have defaults, no NaN/Infinity.
 */

import type { Risk } from "@/domain/risk/risk.schema";
import type { MitigationStatus } from "@/domain/risk/risk.schema";

const MITIGATION_STATUSES: MitigationStatus[] = ["none", "planned", "active", "completed"];

/** Returns defaultVal if x is not a finite number. */
export function safeNum(x: unknown, defaultVal: number): number {
  if (typeof x !== "number" || !Number.isFinite(x)) return defaultVal;
  return x;
}

/** Clamps value to [0, 1]. */
export function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

/** Clamps value to non-negative finite number. */
export function clampNonNegative(x: number, defaultVal: number): number {
  const n = safeNum(x, defaultVal);
  return n < 0 ? 0 : n;
}

/** Non-negative integer (e.g. lagMonths). */
export function clampNonNegativeInt(x: unknown, defaultVal: number): number {
  const n = safeNum(x as number, defaultVal);
  const i = Math.floor(n);
  return i < 0 ? 0 : i;
}

/**
 * Sanitizes a risk for forward exposure: defaults, clamp 0..1 fields, normalize time weights, prevent NaN/Infinity.
 * Returns a sanitized risk (shallow copy with overrides) and a list of warning messages.
 */
export function sanitizeRiskForExposure(risk: Risk): { sanitized: Risk; warnings: string[] } {
  const warnings: string[] = [];
  const id = risk.id ?? "unknown";

  const probability = clamp01(safeNum(risk.probability, 0.5));
  if (risk.probability !== undefined && (risk.probability !== probability || !Number.isFinite(risk.probability)))
    warnings.push(`[${id}] probability clamped to 0..1`);

  const baseCostImpact = clampNonNegative(risk.baseCostImpact ?? 100_000, 100_000);
  if (risk.baseCostImpact !== undefined && (risk.baseCostImpact !== baseCostImpact || !Number.isFinite(risk.baseCostImpact as number)))
    warnings.push(`[${id}] baseCostImpact clamped to non-negative`);

  const escalationPersistence = clamp01(safeNum(risk.escalationPersistence, 0.5));
  if (risk.escalationPersistence !== undefined && (risk.escalationPersistence !== escalationPersistence || !Number.isFinite(risk.escalationPersistence as number)))
    warnings.push(`[${id}] escalationPersistence clamped to 0..1`);

  const sensitivity = clamp01(safeNum(risk.sensitivity, 0.5));
  if (risk.sensitivity !== undefined && (risk.sensitivity !== sensitivity || !Number.isFinite(risk.sensitivity as number)))
    warnings.push(`[${id}] sensitivity clamped to 0..1`);

  let timeProfile: Risk["timeProfile"] = risk.timeProfile;
  if (Array.isArray(timeProfile) && timeProfile.length > 0) {
    const safe = timeProfile.map((v) => (Number.isFinite(v) ? Math.max(0, v) : 0));
    const sum = safe.reduce((a, b) => a + b, 0);
    if (sum <= 0) {
      timeProfile = "mid";
      warnings.push(`[${id}] timeProfile array had non-positive sum, defaulted to "mid"`);
    } else {
      timeProfile = safe.map((v) => v / sum);
    }
  } else if (timeProfile !== undefined && timeProfile !== "front" && timeProfile !== "mid" && timeProfile !== "back") {
    timeProfile = "mid";
    warnings.push(`[${id}] timeProfile invalid, defaulted to "mid"`);
  } else if (timeProfile === undefined) {
    timeProfile = "mid";
  }

  let mitigationProfile = risk.mitigationProfile;
  if (mitigationProfile != null) {
    const status = MITIGATION_STATUSES.includes(mitigationProfile.status) ? mitigationProfile.status : "none";
    const effectiveness = clamp01(safeNum(mitigationProfile.effectiveness, 0.5));
    const confidence = clamp01(safeNum(mitigationProfile.confidence, 0.5));
    const reduces = clamp01(safeNum(mitigationProfile.reduces, 0));
    const lagMonths = clampNonNegativeInt(mitigationProfile.lagMonths, 0);
    if (
      mitigationProfile.status !== status ||
      mitigationProfile.effectiveness !== effectiveness ||
      mitigationProfile.confidence !== confidence ||
      mitigationProfile.reduces !== reduces ||
      mitigationProfile.lagMonths !== lagMonths
    ) {
      warnings.push(`[${id}] mitigationProfile fields clamped/defaulted`);
    }
    mitigationProfile = { status, effectiveness, confidence, reduces, lagMonths };
  }

  const sanitized: Risk = {
    ...risk,
    probability,
    baseCostImpact,
    escalationPersistence,
    sensitivity,
    timeProfile,
    mitigationProfile: mitigationProfile ?? risk.mitigationProfile,
  };

  return { sanitized, warnings };
}
