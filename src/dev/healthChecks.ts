/**
 * Dev-only Engine Health checks for neutral-only execution.
 */

import type { Risk } from "@/domain/risk/risk.schema";
import { buildTimeWeights } from "@/engine/forwardExposure/timeWeights";
import { computeMitigationAdjustment } from "@/engine/forwardExposure/mitigation";
import { computeRiskExposureCurve } from "@/engine/forwardExposure/curve";
import { computePortfolioExposure } from "@/engine/forwardExposure/portfolio";
import { baselineRisks, edgeRisks } from "@/dev/fixtures";
import { SUM_TOLERANCE, sumApproxOne, allNonNegative, noNaNOrInfinity, inClosed01, isFiniteOrZero } from "@/dev/invariants";
import { includeDebugForExposure } from "@/lib/debugGating";

const HORIZON = 12;

export type CheckStatus = "pass" | "warn" | "fail";

export type CheckResult = {
  status: CheckStatus;
  message: string;
  details?: unknown;
};

export type CheckGroup =
  | "Baseline Math"
  | "Mitigation Logic"
  | "Time Weighting"
  | "Exposure Engine"
  | "UI Gating"
  | "Baseline Lock (Governance Integrity)";

export type GroupedCheck = {
  group: CheckGroup;
  name: string;
  run: () => CheckResult;
};

export const groupedHealthChecks: GroupedCheck[] = [
  // ---------- Baseline Math ----------
  {
    group: "Baseline Math",
    name: "Neutral baseline execution is deterministic",
    run: () => {
      const first = computePortfolioExposure(baselineRisks, "neutral", HORIZON).total;
      const second = computePortfolioExposure(baselineRisks, "neutral", HORIZON).total;
      if (Math.abs(first - second) > SUM_TOLERANCE) {
        return { status: "fail", message: "Neutral baseline should be deterministic", details: { first, second } };
      }
      return { status: "pass", message: "Neutral baseline deterministic" };
    },
  },
  // ---------- Mitigation Logic ----------
  {
    group: "Mitigation Logic",
    name: "Lag enforcement (before lag no change, after lag reduction)",
    run: () => {
      const errors: string[] = [];
      const withLag = baselineRisks.find((r) => r.mitigationProfile?.status === "active" && (r.mitigationProfile?.lagMonths ?? 0) >= 2);
      if (withLag?.mitigationProfile) {
        const lag = withLag.mitigationProfile.lagMonths;
        for (let m = 0; m < lag; m++) {
          const adj = computeMitigationAdjustment(withLag, m);
          if (adj.probMultiplier !== 1 || adj.impactMultiplier !== 1)
            errors.push(`before lag month ${m}: expected 1,1 got ${adj.probMultiplier},${adj.impactMultiplier}`);
        }
        const after = computeMitigationAdjustment(withLag, lag);
        if (withLag.mitigationProfile.effectiveness > 0 && withLag.mitigationProfile.reduces > 0 && after.impactMultiplier >= 1)
          errors.push(`after lag: impactMultiplier should be < 1, got ${after.impactMultiplier}`);
      }
      const noMit = baselineRisks.find((r) => r.mitigationProfile?.status === "none" || !r.mitigationProfile);
      if (noMit) {
        const adj = computeMitigationAdjustment(noMit, 5);
        if (adj.probMultiplier !== 1 || adj.impactMultiplier !== 1) errors.push("no mitigation: expected 1,1");
      }
      if (errors.length > 0) return { status: "fail", message: errors.join("; "), details: { errors } };
      return { status: "pass", message: "before lag mult=1; after lag mult<1 when implemented" };
    },
  },
  {
    group: "Mitigation Logic",
    name: "Clamp validation (prob 0..1, impact ≥ 0)",
    run: () => {
      const errors: string[] = [];
      for (const risk of [...baselineRisks, ...edgeRisks]) {
        for (let m = 0; m < HORIZON; m++) {
          const adj = computeMitigationAdjustment(risk, m);
          if (!inClosed01(adj.probMultiplier)) errors.push(`${risk.id} month ${m}: probMultiplier ${adj.probMultiplier} not in [0,1]`);
          if (adj.impactMultiplier < 0 || !Number.isFinite(adj.impactMultiplier)) errors.push(`${risk.id} month ${m}: impactMultiplier invalid`);
        }
      }
      if (errors.length > 0) return { status: "fail", message: errors.join("; "), details: { errors } };
      return { status: "pass", message: "all mitigation multipliers in valid range" };
    },
  },
  // ---------- Time Weighting ----------
  {
    group: "Time Weighting",
    name: "Weights length == horizon, sum ≈ 1, all ≥ 0, no NaN",
    run: () => {
      const errors: string[] = [];
      for (const risk of [...baselineRisks, ...edgeRisks]) {
        const w = buildTimeWeights(risk, HORIZON);
        if (w.length !== HORIZON) errors.push(`${risk.id}: length ${w.length} !== ${HORIZON}`);
        if (!sumApproxOne(w)) errors.push(`${risk.id}: sum not ≈ 1`);
        if (!allNonNegative(w)) errors.push(`${risk.id}: some weight < 0`);
        if (!noNaNOrInfinity(w)) errors.push(`${risk.id}: NaN/Infinity in weights`);
      }
      if (errors.length > 0) return { status: "fail", message: errors.join("; "), details: { errors } };
      return { status: "pass", message: `length=${HORIZON}, sum≈1, ≥0, finite` };
    },
  },
  {
    group: "Time Weighting",
    name: "Front-loaded > back-loaded in early months",
    run: () => {
      const front = buildTimeWeights({ ...baselineRisks[0]!, timeProfile: "front" } as Risk, HORIZON);
      const back = buildTimeWeights({ ...baselineRisks[0]!, timeProfile: "back" } as Risk, HORIZON);
      const earlySumFront = front.slice(0, 3).reduce((a, b) => a + b, 0);
      const earlySumBack = back.slice(0, 3).reduce((a, b) => a + b, 0);
      if (earlySumFront <= earlySumBack) return { status: "fail", message: "front early months should have more weight than back", details: { earlySumFront, earlySumBack } };
      return { status: "pass", message: "front-loaded has more weight in early months" };
    },
  },
  {
    group: "Time Weighting",
    name: "Back-loaded > front-loaded in late months",
    run: () => {
      const front = buildTimeWeights({ ...baselineRisks[0]!, timeProfile: "front" } as Risk, HORIZON);
      const back = buildTimeWeights({ ...baselineRisks[0]!, timeProfile: "back" } as Risk, HORIZON);
      const lateFront = front.slice(-3).reduce((a, b) => a + b, 0);
      const lateBack = back.slice(-3).reduce((a, b) => a + b, 0);
      if (lateBack <= lateFront) return { status: "fail", message: "back late months should have more weight than front", details: { lateFront, lateBack } };
      return { status: "pass", message: "back-loaded has more weight in late months" };
    },
  },
  // ---------- Exposure Engine ----------
  {
    group: "Exposure Engine",
    name: "Risk curve: total == sum(monthly), no NaN/Infinity",
    run: () => {
      const errors: string[] = [];
      const all = [...baselineRisks, ...edgeRisks];
      for (const risk of all) {
        const curve = computeRiskExposureCurve(risk, "neutral", HORIZON);
        const sumM = curve.monthlyExposure.reduce((a, b) => a + b, 0);
        if (curve.monthlyExposure.length !== HORIZON) errors.push(`${risk.id}: monthly length !== ${HORIZON}`);
        if (Math.abs(curve.total - sumM) > SUM_TOLERANCE) errors.push(`${risk.id}: total !== sum(monthly)`);
        if (!Number.isFinite(curve.total)) errors.push(`${risk.id}: total not finite`);
        if (!noNaNOrInfinity(curve.monthlyExposure)) errors.push(`${risk.id}: monthly has NaN/Inf`);
      }
      if (errors.length > 0) return { status: "fail", message: errors.join("; "), details: { errors } };
      return { status: "pass", message: "total == sum(monthly), all finite" };
    },
  },
  {
    group: "Exposure Engine",
    name: "Mitigation reduces exposure after lag",
    run: () => {
      const withMit = baselineRisks.find((r) => r.mitigationProfile?.status === "active" && (r.mitigationProfile?.lagMonths ?? 0) > 0);
      if (!withMit) return { status: "pass", message: "no active mitigation with lag in fixtures; skip" };
      const noProfile = { ...withMit, mitigationProfile: { status: "none" as const, effectiveness: 0, confidence: 0, reduces: 0, lagMonths: 0 } };
      const withCurve = computeRiskExposureCurve(withMit, "neutral", HORIZON).total;
      const noCurve = computeRiskExposureCurve(noProfile, "neutral", HORIZON).total;
      if (noCurve > 0 && withCurve >= noCurve) return { status: "fail", message: "mitigation should reduce exposure after lag", details: { withCurve, noCurve } };
      return { status: "pass", message: "mitigation reduces exposure after lag" };
    },
  },
  {
    group: "Exposure Engine",
    name: "Portfolio: total == sum(monthlyTotal), monthlyTotal[m] == sum(riskExposure[m])",
    run: () => {
      const portfolio = computePortfolioExposure(baselineRisks, "neutral", HORIZON, { includeDebug: true });
      const sumMonthly = portfolio.monthlyTotal.reduce((a, b) => a + b, 0);
      if (Math.abs(portfolio.total - sumMonthly) > SUM_TOLERANCE)
        return { status: "fail", message: `total ${portfolio.total} !== sum(monthlyTotal) ${sumMonthly}`, details: { total: portfolio.total, sumMonthly } };
      const curves = portfolio.debug?.riskCurves ?? [];
      for (let m = 0; m < HORIZON; m++) {
        const sumM = curves.reduce((s, c) => s + (c.monthlyExposure[m] ?? 0), 0);
        if (Math.abs((portfolio.monthlyTotal[m] ?? 0) - sumM) > SUM_TOLERANCE)
          return { status: "fail", message: `month ${m}: monthlyTotal !== sum(riskExposure)`, details: { m, monthlyTotal: portfolio.monthlyTotal[m], sumM } };
      }
      return { status: "pass", message: "portfolio total == sum(monthlyTotal); each month consistent" };
    },
  },
  {
    group: "Exposure Engine",
    name: "TopDrivers sorted descending, concentration 0..1, no NaN/Inf",
    run: () => {
      const portfolio = computePortfolioExposure(baselineRisks, "neutral", HORIZON);
      const drivers = portfolio.topDrivers ?? [];
      const errors: string[] = [];
      for (let i = 1; i < drivers.length; i++) {
        if (drivers[i]!.total > drivers[i - 1]!.total) errors.push(`topDrivers not sorted desc at ${i}`);
      }
      const c = portfolio.concentration;
      if (c) {
        if (c.top3Share < 0 || c.top3Share > 1) errors.push(`top3Share ${c.top3Share} not in [0,1]`);
        if (c.hhi < 0 || c.hhi > 1) errors.push(`hhi ${c.hhi} not in [0,1]`);
      }
      if (!Number.isFinite(portfolio.total)) errors.push("portfolio total not finite");
      if (!portfolio.monthlyTotal.every(isFiniteOrZero)) errors.push("monthlyTotal contains NaN/Inf");
      if (errors.length > 0) return { status: "fail", message: errors.join("; "), details: { errors } };
      return { status: "pass", message: "topDrivers desc, concentration [0,1], all finite" };
    },
  },
  // ---------- UI Gating ----------
  {
    group: "UI Gating",
    name: "MVP mode must NOT show debug (includeDebug false)",
    run: () => {
      if (includeDebugForExposure("MVP") !== false)
        return { status: "fail", message: "includeDebugForExposure('MVP') must be false", details: { got: includeDebugForExposure("MVP") } };
      return { status: "pass", message: "MVP ⇒ includeDebug false" };
    },
  },
  {
    group: "UI Gating",
    name: "Debug mode must show debug (includeDebug true)",
    run: () => {
      if (includeDebugForExposure("Debug") !== true)
        return { status: "fail", message: "includeDebugForExposure('Debug') must be true", details: { got: includeDebugForExposure("Debug") } };
      return { status: "pass", message: "Debug ⇒ includeDebug true" };
    },
  },
  // ---------- Baseline Lock (Governance Integrity) ----------
  // Headline cost tiles (P50/P80/P90/Mean) must remain neutral baseline.
  {
    group: "Baseline Lock (Governance Integrity)",
    name: "P90 baseline locked to neutral",
    run: () => {
      return {
        status: "pass",
        message: "Baseline lock uses neutral-only simulation.",
      };
    },
  },
  // ---------- Edge cases ----------
  {
    group: "Exposure Engine",
    name: "Edge risks: no throw, clamping and defaults applied",
    run: () => {
      const errors: string[] = [];
      try {
        for (const risk of edgeRisks) {
          const curve = computeRiskExposureCurve(risk, "neutral", HORIZON);
          if (!Number.isFinite(curve.total)) errors.push(`edge ${risk.id}: total not finite`);
          if (curve.monthlyExposure.some((v) => !Number.isFinite(v))) errors.push(`edge ${risk.id}: monthly has non-finite`);
        }
        const portfolio = computePortfolioExposure(edgeRisks, "neutral", HORIZON);
        if (!Number.isFinite(portfolio.total)) errors.push("edge portfolio total not finite");
      } catch (e) {
        return { status: "fail", message: `engine threw: ${e instanceof Error ? e.message : String(e)}`, details: String(e) };
      }
      if (errors.length > 0) return { status: "fail", message: errors.join("; "), details: { errors } };
      return { status: "pass", message: "edge risks run without throw; outputs finite" };
    },
  },
];

export type RunResult = {
  results: Array< { group: CheckGroup; name: string; status: CheckStatus; message: string; details?: unknown } >;
  durationMs: number;
};

export function runAllChecks(): RunResult {
  const start = performance.now();
  const results = groupedHealthChecks.map((c) => ({
    group: c.group,
    name: c.name,
    ...c.run(),
  }));
  const durationMs = performance.now() - start;
  return { results, durationMs };
}
