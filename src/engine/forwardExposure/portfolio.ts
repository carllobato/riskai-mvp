/**
 * Portfolio-level exposure (pure, deterministic).
 * Sanitizes inputs when includeDebug; returns debugWarnings in Diagnostic mode only.
 */

import type { Risk } from "@/domain/risk/risk.schema";
import type { Scenario } from "./types";
import type { PortfolioExposure, TopDriver, Concentration } from "./types";
import { computeRiskExposureCurve } from "./curve";
import { sanitizeRiskForExposure } from "./validate";

const DEFAULT_TOP_DRIVERS_N = 10;
const TOP_N_CONCENTRATION = 3;

function computeConcentration(
  total: number,
  byCategory: Record<string, number>,
  curves: Array<{ curve: { total: number } }>
): Concentration {
  if (total <= 0 || !Number.isFinite(total)) return { top3Share: 0, hhi: 0 };

  const categoryEntries = Object.entries(byCategory).filter(([, v]) => Number.isFinite(v) && v > 0);
  if (categoryEntries.length > 0) {
    const shares = categoryEntries.map(([, v]) => v / total);
    shares.sort((a, b) => b - a);
    const top3Share = Math.min(1, shares.slice(0, TOP_N_CONCENTRATION).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0));
    const hhi = Math.min(1, shares.reduce((s, v) => s + (Number.isFinite(v) ? v * v : 0), 0));
    return { top3Share: Number.isFinite(top3Share) ? top3Share : 0, hhi: Number.isFinite(hhi) ? hhi : 0 };
  }

  const riskShares = curves.map((c) => (Number.isFinite(c.curve.total) ? c.curve.total / total : 0)).filter((s) => s > 0);
  riskShares.sort((a, b) => b - a);
  const top3Share = Math.min(1, riskShares.slice(0, TOP_N_CONCENTRATION).reduce((s, v) => s + v, 0));
  const hhi = Math.min(1, riskShares.reduce((s, v) => s + v * v, 0));
  return { top3Share: Number.isFinite(top3Share) ? top3Share : 0, hhi: Number.isFinite(hhi) ? hhi : 0 };
}

/**
 * Aggregates exposure across risks: monthly totals, by category, top drivers, concentration.
 * When includeDebug, sanitizes each risk and returns debugWarnings.
 */
export function computePortfolioExposure(
  risks: Risk[],
  scenario: Scenario,
  horizonMonths: number,
  options?: { topN?: number; includeDebug?: boolean }
): PortfolioExposure {
  const topN = options?.topN ?? DEFAULT_TOP_DRIVERS_N;
  const includeDebug = options?.includeDebug ?? false;

  const allWarnings: string[] = [];
  const risksToUse = risks.map((risk) => {
    const { sanitized, warnings } = sanitizeRiskForExposure(risk);
    if (includeDebug) allWarnings.push(...warnings);
    return sanitized;
  });

  const curves = risksToUse.map((risk) => ({
    risk,
    curve: computeRiskExposureCurve(risk, scenario, horizonMonths, { includeDebug: false }),
  }));

  const monthlyTotal: number[] = Array(horizonMonths).fill(0);
  for (const { curve } of curves) {
    for (let m = 0; m < horizonMonths; m++) {
      monthlyTotal[m] = (monthlyTotal[m] ?? 0) + (curve.monthlyExposure[m] ?? 0);
    }
  }

  const total = curves.reduce((s, { curve }) => s + curve.total, 0);

  const byCategory: Record<string, number> = {};
  for (const { risk, curve } of curves) {
    const cat = risk.category ?? "other";
    const add = Number.isFinite(curve.total) ? curve.total : 0;
    byCategory[cat] = (byCategory[cat] ?? 0) + add;
  }

  const sorted = [...curves].sort((a, b) => b.curve.total - a.curve.total);
  const topDrivers: TopDriver[] = sorted.slice(0, topN).map(({ risk, curve }) => ({
    riskId: risk.id,
    category: risk.category ?? "other",
    total: curve.total,
  }));

  const concentration = computeConcentration(total, byCategory, curves);

  const result: PortfolioExposure = {
    monthlyTotal,
    total,
    byCategory,
    topDrivers,
    concentration,
  };

  if (includeDebug) {
    result.debugWarnings = allWarnings.length > 0 ? allWarnings : undefined;
    result.debug = {
      riskCurves: curves.map(({ risk, curve }) => ({
        riskId: risk.id,
        total: curve.total,
        monthlyExposure: curve.monthlyExposure.map((v) => (Number.isFinite(v) ? v : 0)),
      })),
    };
  }

  result.monthlyTotal = result.monthlyTotal.map((v) => (Number.isFinite(v) ? v : 0));
  result.total = Number.isFinite(result.total) ? result.total : 0;

  return result;
}
