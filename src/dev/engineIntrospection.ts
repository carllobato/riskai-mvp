/**
 * Dev-only engine introspection: builds debug payload for Health page.
 * Calls exposure engine with __introspect and returns structured payload.
 */

import { computeRiskExposureCurve } from "@/engine/forwardExposure/curve";
import { computePortfolioExposure } from "@/engine/forwardExposure/portfolio";
import { baselineRisks } from "@/dev/fixtures";

const HORIZON = 12;
const BASELINE_MULTIPLIERS = {
  neutral: {
    probability: 1,
    impact: 1,
    persistence: 1,
    sensitivity: 1,
  },
} as const;

export type IntrospectionPayload = {
  baselineMultipliers: typeof BASELINE_MULTIPLIERS;
  sampleRiskId: string;
  sampleCurve: {
    rawParams: unknown;
    adjustedParams: unknown;
    rawMultipliers: unknown;
    effectiveMultipliers: unknown;
    timeWeights: number[];
    mitigationByMonth: unknown[];
    total: number;
  };
  portfolioSample: {
    total: number;
    monthlyTotal: number[];
    topDriversCount: number;
  };
};

/**
 * Returns a deterministic introspection payload for the first baseline risk (neutral scenario).
 * Used by Engine Health page expandable JSON.
 */
export function buildIntrospectionPayload(): IntrospectionPayload {
  const risk = baselineRisks[0]!;
  const curve = computeRiskExposureCurve(risk, "neutral", HORIZON, { includeDebug: true, __introspect: true });
  const portfolio = computePortfolioExposure(baselineRisks.slice(0, 3), "neutral", HORIZON, { topN: 5, includeDebug: false });
  const debug = curve.debug as Record<string, unknown> | undefined;

  return {
    baselineMultipliers: BASELINE_MULTIPLIERS,
    sampleRiskId: risk.id,
    sampleCurve: {
      rawParams: debug?.rawParams,
      adjustedParams: curve.debug?.adjustedParams,
      rawMultipliers: debug?.rawMultipliers,
      effectiveMultipliers: debug?.effectiveMultipliers,
      timeWeights: curve.debug?.timeWeights ?? [],
      mitigationByMonth: curve.debug?.mitigationByMonth ?? [],
      total: curve.total,
    },
    portfolioSample: {
      total: portfolio.total,
      monthlyTotal: portfolio.monthlyTotal,
      topDriversCount: portfolio.topDrivers.length,
    },
  };
}
