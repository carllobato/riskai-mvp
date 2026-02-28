/**
 * Project context: baseline project attributes used to interpret risk outputs.
 * Persisted in localStorage under key PROJECT_CONTEXT_STORAGE_KEY.
 * Optional server sync via POST /api/project-context (see getProjectContext.ts).
 */

export type RiskAppetite =
  | "P10"
  | "P20"
  | "P30"
  | "P40"
  | "P50"
  | "P60"
  | "P70"
  | "P80"
  | "P90";

export type ProjectCurrency = "AUD" | "USD" | "GBP";

export type FinancialUnit = "THOUSANDS" | "MILLIONS" | "BILLIONS";

export type ProjectContext = {
  projectName: string;
  location?: string;
  plannedDuration_months: number;
  targetCompletionDate: string; // ISO date
  scheduleContingency_weeks: number;
  riskAppetite: RiskAppetite;
  currency: ProjectCurrency;
  /** Unit for project value and contingency inputs. */
  financialUnit: FinancialUnit;
  /** Raw project value as entered by user in the selected unit. */
  projectValue_input: number;
  /** Raw contingency value as entered by user in the selected unit. */
  contingencyValue_input: number;
  /** Derived project value in $m for downstream use. */
  projectValue_m: number;
  /** Derived contingency value in $m. */
  contingencyValue_m: number;
  /** Derived approved budget in $m = projectValue_m + contingencyValue_m. */
  approvedBudget_m: number;
};

const PROJECT_CONTEXT_STORAGE_KEY = "riskai_project_context_v1";

const RISK_APPETITE_VALUES: RiskAppetite[] = [
  "P10",
  "P20",
  "P30",
  "P40",
  "P50",
  "P60",
  "P70",
  "P80",
  "P90",
];
const CURRENCY_VALUES: ProjectCurrency[] = ["AUD", "USD", "GBP"];
const FINANCIAL_UNIT_VALUES: FinancialUnit[] = ["THOUSANDS", "MILLIONS", "BILLIONS"];

function isNonNegativeNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

function isNonNegativeInteger(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0;
}

function isIsoDateString(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

/**
 * Convert input in given unit to $m.
 * THOUSANDS: input is $k => value_m = input / 1000
 * MILLIONS: input is $m => value_m = input
 * BILLIONS: input is $b => value_m = input * 1000
 */
export function computeValueM(input: number, unit: FinancialUnit): number {
  if (!Number.isFinite(input) || input < 0) return 0;
  switch (unit) {
    case "THOUSANDS":
      return input / 1000;
    case "MILLIONS":
      return input;
    case "BILLIONS":
      return input * 1000;
    default:
      return input;
  }
}

/** @deprecated Use computeValueM. Kept for backward compatibility. */
export const computeProjectValueM = computeValueM;

/** Validates raw object; returns validated ProjectContext or null. Handles legacy migration. */
export function parseProjectContext(raw: unknown): ProjectContext | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const projectName = typeof o.projectName === "string" ? o.projectName.trim() : "";
  const location =
    o.location !== undefined && o.location !== null && typeof o.location === "string"
      ? o.location.trim()
      : undefined;
  const plannedDuration_months = isNonNegativeInteger(o.plannedDuration_months) ? o.plannedDuration_months : 0;
  const targetCompletionDate =
    typeof o.targetCompletionDate === "string" && isIsoDateString(o.targetCompletionDate)
      ? o.targetCompletionDate
      : "";
  const scheduleContingency_weeks = isNonNegativeNumber(o.scheduleContingency_weeks)
    ? o.scheduleContingency_weeks
    : 0;
  const riskAppetite =
    typeof o.riskAppetite === "string" && RISK_APPETITE_VALUES.includes(o.riskAppetite as RiskAppetite)
      ? (o.riskAppetite as RiskAppetite)
      : "P80";
  const currency =
    typeof o.currency === "string" && CURRENCY_VALUES.includes(o.currency as ProjectCurrency)
      ? (o.currency as ProjectCurrency)
      : "AUD";

  const financialUnit =
    typeof o.financialUnit === "string" && FINANCIAL_UNIT_VALUES.includes(o.financialUnit as FinancialUnit)
      ? (o.financialUnit as FinancialUnit)
      : "MILLIONS";

  // Migration: prefer new fields; fall back to legacy baseCost_m / approvedContingency_m
  const hasLegacyBase = isNonNegativeNumber(o.baseCost_m);
  const hasLegacyContingency = isNonNegativeNumber(o.approvedContingency_m);
  const hasNewProjectValue = isNonNegativeNumber(o.projectValue_input);
  const hasNewContingencyValue = isNonNegativeNumber(o.contingencyValue_input);

  let projectValue_input: number;
  let contingencyValue_input: number;

  if (hasNewProjectValue) {
    projectValue_input = o.projectValue_input as number;
  } else if (hasLegacyBase) {
    projectValue_input = o.baseCost_m as number;
    // Legacy was stored in $m, so unit was effectively MILLIONS
  } else {
    projectValue_input = 0;
  }

  if (hasNewContingencyValue) {
    contingencyValue_input = o.contingencyValue_input as number;
  } else if (hasLegacyContingency) {
    contingencyValue_input = o.approvedContingency_m as number;
  } else {
    contingencyValue_input = 0;
  }

  const projectValue_m = computeValueM(projectValue_input, financialUnit);
  const contingencyValue_m = computeValueM(contingencyValue_input, financialUnit);
  const approvedBudget_m = projectValue_m + contingencyValue_m;

  return {
    projectName,
    location,
    plannedDuration_months,
    targetCompletionDate,
    scheduleContingency_weeks,
    riskAppetite,
    currency,
    financialUnit,
    projectValue_input,
    contingencyValue_input,
    projectValue_m,
    contingencyValue_m,
    approvedBudget_m,
  };
}

/** Whether the context has the minimum required fields filled for "complete" (required to proceed to Risk Register). */
export function isProjectContextComplete(ctx: ProjectContext | null): boolean {
  if (!ctx) return false;
  return (
    ctx.projectName.trim().length > 0 &&
    !!ctx.currency &&
    ctx.financialUnit != null &&
    ctx.projectValue_input > 0 &&
    ctx.contingencyValue_input >= 0 &&
    ctx.plannedDuration_months > 0 &&
    (ctx.targetCompletionDate?.trim?.()?.length ?? 0) > 0
  );
}

/** Tab indices: 0 Overview, 1 Financial, 2 Schedule, 3 Import (optional). Returns first tab that is incomplete. */
export function getFirstIncompleteTabIndex(ctx: ProjectContext | null): number {
  if (!ctx) return 0;
  if (!ctx.projectName.trim() || !ctx.currency) return 0;
  if (
    ctx.financialUnit == null ||
    ctx.projectValue_input <= 0 ||
    ctx.contingencyValue_input < 0
  )
    return 1;
  if (ctx.plannedDuration_months <= 0 || !ctx.targetCompletionDate?.trim()) return 2;
  return 3;
}

/** Contingency as % of project value (guard divide-by-zero). */
export function getContingencyPercent(ctx: ProjectContext): number | null {
  if (ctx.projectValue_m <= 0) return null;
  return (ctx.contingencyValue_m / ctx.projectValue_m) * 100;
}

/**
 * Format value stored in millions as $Xm or $X.Xbn (e.g. 217 → $217m, 1000 → $1.0bn).
 */
export function formatMoneyMillions(m: number): string {
  if (!Number.isFinite(m)) return "—";
  if (m >= 1000) {
    const bn = m / 1000;
    return bn >= 10 || bn % 1 === 0 ? `$${bn.toFixed(0)}bn` : `$${bn.toFixed(1)}bn`;
  }
  return m % 1 === 0 ? `$${m.toFixed(0)}m` : `$${m.toFixed(1)}m`;
}

/** Load from localStorage. Returns null if missing or invalid. Applies migration for legacy schema. */
export function loadProjectContext(): ProjectContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROJECT_CONTEXT_STORAGE_KEY);
    if (!raw) return null;
    return parseProjectContext(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Save to localStorage. Validates and computes derived values before save. */
export function saveProjectContext(ctx: ProjectContext): boolean {
  if (typeof window === "undefined") return false;
  const parsed = parseProjectContext(ctx);
  if (!parsed) return false;
  try {
    window.localStorage.setItem(PROJECT_CONTEXT_STORAGE_KEY, JSON.stringify(parsed));
    return true;
  } catch {
    return false;
  }
}

/** Clear the stored project context from localStorage. */
export function clearProjectContext(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PROJECT_CONTEXT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export { PROJECT_CONTEXT_STORAGE_KEY };
