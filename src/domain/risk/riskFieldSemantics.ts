/**
 * `risks.status` and `risks.applies_to` are free text (lookup table names; legacy lowercase values supported).
 * Use these helpers for simulation, validation, and analytics so casing and minor variants still work.
 */

/** Canonical `riskai_risk_statuses.name` for soft-deleted risks (`risks.status`). */
export const RISK_STATUS_ARCHIVED_LOOKUP = "Archived";

/** Default status when restoring an archived risk (first version; prior status not preserved). */
export const RISK_STATUS_OPEN_LOOKUP = "Open";

export function normalizeRiskStatusKey(status: string | undefined | null): string {
  return (status ?? "").toString().trim().toLowerCase();
}

/**
 * Preferred default status for newly created risks (matches `riskai_risk_statuses.name`, any casing).
 * Do not use `statuses[0]` — DB order-by-name yields `archived` first alphabetically.
 */
export function getDefaultNewRiskStatusName(rows: { name: string }[]): string {
  const draft = rows.find((r) => normalizeRiskStatusKey(r.name) === "draft");
  return draft?.name ?? "";
}

export function isRiskStatusDraft(status: string | undefined | null): boolean {
  return normalizeRiskStatusKey(status) === "draft";
}

export function isRiskStatusArchived(status: string | undefined | null): boolean {
  return normalizeRiskStatusKey(status) === "archived";
}

export function isRiskStatusClosed(status: string | undefined | null): boolean {
  return normalizeRiskStatusKey(status) === "closed";
}

/** Closed or archived risks are excluded from Monte Carlo inputs. */
export function isRiskStatusExcludedFromSimulation(status: string | undefined | null): boolean {
  return isRiskStatusClosed(status) || isRiskStatusArchived(status);
}

/**
 * Semantic kind for cost/time/both. Returns null when the stored text does not match those words (case-insensitive).
 * Callers typically treat null like "both" for consequence math and validation.
 */
export function normalizeAppliesToKey(appliesTo: string | undefined | null): "time" | "cost" | "both" | null {
  const raw = (appliesTo ?? "").toString().trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower === "time") return "time";
  if (lower === "cost") return "cost";
  if (lower === "both") return "both";
  return null;
}

export function appliesToAffectsCost(appliesTo: string | undefined | null): boolean {
  const k = normalizeAppliesToKey(appliesTo);
  return k === "cost" || k === "both" || k === null;
}

export function appliesToAffectsTime(appliesTo: string | undefined | null): boolean {
  const k = normalizeAppliesToKey(appliesTo);
  return k === "time" || k === "both" || k === null;
}

export function appliesToExcludesCost(appliesTo: string | undefined | null): boolean {
  return normalizeAppliesToKey(appliesTo) === "time";
}

export function appliesToExcludesTime(appliesTo: string | undefined | null): boolean {
  return normalizeAppliesToKey(appliesTo) === "cost";
}
