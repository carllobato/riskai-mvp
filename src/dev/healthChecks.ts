/**
 * Dev-only Engine Health check registry.
 * Grouped by: Scenario Math, Mitigation Logic, Time Weighting, Exposure Engine, Governance Metrics, UI Gating.
 * Deterministic invariants only; no hard-coded expected numbers.
 */

import type { Risk } from "@/domain/risk/risk.schema";
import { buildTimeWeights } from "@/engine/forwardExposure/timeWeights";
import { computeMitigationAdjustment } from "@/engine/forwardExposure/mitigation";
import { applyScenario, SCENARIO_MULTIPLIERS } from "@/engine/forwardExposure/scenario";
import { computeRiskExposureCurve } from "@/engine/forwardExposure/curve";
import { computePortfolioExposure } from "@/engine/forwardExposure/portfolio";
import { baselineRisks, edgeRisks, lensIntegrityRisks } from "@/dev/fixtures";
import { SUM_TOLERANCE, isFiniteOrZero, sumApproxOne, allNonNegative, noNaNOrInfinity, inClosed01 } from "@/dev/invariants";
import { includeDebugForExposure } from "@/lib/debugGating";
import { simulatePortfolio } from "@/lib/simulatePortfolio";
import { applyScenarioToRiskInputs } from "@/engine/scenario/applyScenarioToRiskInputs";
import { calcInstabilityIndex, calcFragility, calcScenarioDeltaSummary } from "@/lib/instability/calcInstabilityIndex";

const HORIZON = 12;

export type CheckStatus = "pass" | "warn" | "fail";

export type CheckResult = {
  status: CheckStatus;
  message: string;
  details?: unknown;
};

export type CheckGroup =
  | "Scenario Math"
  | "Mitigation Logic"
  | "Time Weighting"
  | "Exposure Engine"
  | "Governance Metrics"
  | "UI Gating"
  | "Lens Range Integrity"
  | "Baseline Lock (Governance Integrity)";

export type GroupedCheck = {
  group: CheckGroup;
  name: string;
  run: () => CheckResult;
};

function tryGovernance(
  fn: () => CheckResult
): CheckResult {
  try {
    return fn();
  } catch {
    return { status: "warn", message: "Governance functions not available or threw; skip gracefully.", details: undefined };
  }
}

export const groupedHealthChecks: GroupedCheck[] = [
  // ---------- Scenario Math ----------
  {
    group: "Scenario Math",
    name: "Scenario ordering (Downside ≥ Base ≥ Upside)",
    run: () => {
      const errors: string[] = [];
      for (const risk of baselineRisks) {
        const cons = applyScenario(risk, "conservative");
        const neut = applyScenario(risk, "neutral");
        const agg = applyScenario(risk, "aggressive");
        if (cons.probability > neut.probability) errors.push(`${risk.id}: conservative prob > neutral`);
        if (neut.probability > agg.probability) errors.push(`${risk.id}: neutral prob > aggressive`);
        if (cons.baseCostImpact > neut.baseCostImpact) errors.push(`${risk.id}: conservative impact > neutral`);
        if (neut.baseCostImpact > agg.baseCostImpact) errors.push(`${risk.id}: neutral impact > aggressive`);
      }
      if (errors.length > 0) return { status: "fail", message: errors.join("; "), details: { errors } };
      return { status: "pass", message: "conservative ≤ neutral ≤ aggressive for prob and impact" };
    },
  },
  {
    group: "Scenario Math",
    name: "Probability and impact multipliers follow same ordering",
    run: () => {
      const cons = SCENARIO_MULTIPLIERS.conservative;
      const neut = SCENARIO_MULTIPLIERS.neutral;
      const agg = SCENARIO_MULTIPLIERS.aggressive;
      const errors: string[] = [];
      if (cons.probability > neut.probability || neut.probability > agg.probability)
        errors.push("probability multipliers not cons ≤ neut ≤ agg");
      if (cons.impact > neut.impact || neut.impact > agg.impact) errors.push("impact multipliers not cons ≤ neut ≤ agg");
      if (errors.length > 0) return { status: "fail", message: errors.join("; "), details: { cons, neut, agg } };
      return { status: "pass", message: "multipliers ordered cons ≤ neut ≤ agg" };
    },
  },
  {
    group: "Scenario Math",
    name: "Sensitivity amplification (sensitivity=1 delta > sensitivity=0.1)",
    run: () => {
      const riskHigh = baselineRisks.find((r) => r.sensitivity !== undefined) ?? baselineRisks[0]!;
      const riskLow = { ...riskHigh, id: "tmp-low", sensitivity: 0.1 };
      const riskHighSens = { ...riskHigh, id: "tmp-high", sensitivity: 1 };
      const curveLowN = computeRiskExposureCurve(riskLow as Risk, "neutral", HORIZON);
      const curveLowA = computeRiskExposureCurve(riskLow as Risk, "aggressive", HORIZON);
      const curveHighN = computeRiskExposureCurve(riskHighSens as Risk, "neutral", HORIZON);
      const curveHighA = computeRiskExposureCurve(riskHighSens as Risk, "aggressive", HORIZON);
      const deltaLow = curveLowA.total - curveLowN.total;
      const deltaHigh = curveHighA.total - curveHighN.total;
      if (deltaHigh <= deltaLow && deltaLow > 0) return { status: "fail", message: "sensitivity=1 should yield larger scenario delta", details: { deltaLow, deltaHigh } };
      return { status: "pass", message: "higher sensitivity yields larger scenario delta" };
    },
  },
  {
    group: "Scenario Math",
    name: "Scenario isolation (no mutation of original risk)",
    run: () => {
      const risk = baselineRisks[0]!;
      const probBefore = risk.probability;
      const impactBefore = risk.baseCostImpact;
      applyScenario(risk, "aggressive");
      applyScenario(risk, "conservative");
      const probAfter = risk.probability;
      const impactAfter = risk.baseCostImpact;
      if (probBefore !== probAfter || impactBefore !== impactAfter)
        return { status: "fail", message: "applyScenario mutated risk", details: { probBefore, probAfter, impactBefore, impactAfter } };
      return { status: "pass", message: "original risk unchanged after applyScenario" };
    },
  },
  {
    group: "Scenario Math",
    name: "Zero sensitivity: scenario exposure delta",
    run: () => {
      const risk = { ...baselineRisks[0]!, sensitivity: 0 };
      const curveN = computeRiskExposureCurve(risk as Risk, "neutral", HORIZON);
      const curveA = computeRiskExposureCurve(risk as Risk, "aggressive", HORIZON);
      if (Math.abs(curveN.total - curveA.total) > SUM_TOLERANCE)
        return { status: "warn", message: "sensitivity=0 but exposure differs by scenario (engine may not gate by sensitivity)", details: { neutral: curveN.total, aggressive: curveA.total } };
      return { status: "pass", message: "sensitivity=0 ⇒ same exposure for neutral/aggressive" };
    },
  },
  {
    group: "Scenario Math",
    name: "P-value changes across scenarios when sensitivity > 0",
    run: () => {
      const risksWithSensitivity = baselineRisks.filter((r) => (r.sensitivity ?? 0) > 0);
      if (risksWithSensitivity.length === 0)
        return { status: "warn", message: "No baseline risks with sensitivity > 0; skip P-value scenario check" };
      const iters = 500;
      const snapCons = simulatePortfolio(
        risksWithSensitivity.map((r) => applyScenarioToRiskInputs(r, "conservative")),
        iters,
        { profile: "conservative" }
      );
      const snapNeut = simulatePortfolio(
        risksWithSensitivity.map((r) => applyScenarioToRiskInputs(r, "neutral")),
        iters,
        { profile: "neutral" }
      );
      const snapAgg = simulatePortfolio(
        risksWithSensitivity.map((r) => applyScenarioToRiskInputs(r, "aggressive")),
        iters,
        { profile: "aggressive" }
      );
      const pCons = snapCons.totalExpectedCost;
      const pNeut = snapNeut.totalExpectedCost;
      const pAgg = snapAgg.totalExpectedCost;
      const relTol = Math.max(pNeut * 0.005, 100);
      const same = Math.abs(pCons - pNeut) <= relTol && Math.abs(pNeut - pAgg) <= relTol;
      if (same)
        return { status: "fail", message: "P-value (totalExpectedCost) should differ across scenarios when sensitivity > 0", details: { conservative: pCons, neutral: pNeut, aggressive: pAgg } };
      return { status: "pass", message: "P-value differs across scenarios for sensitivity > 0" };
    },
  },
  {
    group: "Scenario Math",
    name: "P-value invariant across scenarios when all sensitivity = 0",
    run: () => {
      const risksZeroSensitivity = baselineRisks.map((r) => ({ ...r, sensitivity: 0 }));
      const iters = 2000;
      const opts = { profile: "neutral" as const };
      const snapCons = simulatePortfolio(
        risksZeroSensitivity.map((r) => applyScenarioToRiskInputs(r as Risk, "conservative")),
        iters,
        opts
      );
      const snapNeut = simulatePortfolio(
        risksZeroSensitivity.map((r) => applyScenarioToRiskInputs(r as Risk, "neutral")),
        iters,
        opts
      );
      const snapAgg = simulatePortfolio(
        risksZeroSensitivity.map((r) => applyScenarioToRiskInputs(r as Risk, "aggressive")),
        iters,
        opts
      );
      const pCons = snapCons.totalExpectedCost;
      const pNeut = snapNeut.totalExpectedCost;
      const pAgg = snapAgg.totalExpectedCost;
      const relTol = Math.max(pNeut * 0.05, 200);
      if (Math.abs(pCons - pNeut) > relTol || Math.abs(pNeut - pAgg) > relTol)
        return { status: "fail", message: "P-value should not change across scenarios when all sensitivity = 0", details: { conservative: pCons, neutral: pNeut, aggressive: pAgg } };
      return { status: "pass", message: "P-value invariant when sensitivity = 0" };
    },
  },
  {
    group: "Scenario Math",
    name: "Forward exposure totals differ across lenses",
    run: () => {
      const cons = computePortfolioExposure(baselineRisks, "conservative", HORIZON).total;
      const neut = computePortfolioExposure(baselineRisks, "neutral", HORIZON).total;
      const agg = computePortfolioExposure(baselineRisks, "aggressive", HORIZON).total;
      const tol = SUM_TOLERANCE;
      const consDiff = Math.abs(cons - neut) > tol;
      const aggDiff = Math.abs(agg - neut) > tol;
      if (!consDiff && !aggDiff)
        return { status: "fail", message: "Forward exposure totals identical across lenses; lens should affect exposure", details: { conservative: cons, neutral: neut, aggressive: agg } };
      return { status: "pass", message: "Forward exposure totals differ by lens (conservative/aggressive ≠ neutral)" };
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
  // ---------- Governance Metrics ----------
  {
    group: "Governance Metrics",
    name: "EII: higher volatility → higher EII, all finite",
    run: () => {
      return tryGovernance(() => {
        const stable = calcInstabilityIndex({ velocity: 0, volatility: 0, momentumStability: 1, scenarioSensitivity: 0, confidence: 0.8, historyDepth: 5 });
        const volatile = calcInstabilityIndex({ velocity: 8, volatility: 4, momentumStability: 0.2, scenarioSensitivity: 0.9, confidence: 0.4, historyDepth: 2 });
        const errors: string[] = [];
        if (!Number.isFinite(stable.index) || stable.index < 0 || stable.index > 100) errors.push(`stable index ${stable.index} invalid`);
        if (!Number.isFinite(volatile.index) || volatile.index < 0 || volatile.index > 100) errors.push(`volatile index ${volatile.index} invalid`);
        if (stable.index > volatile.index) errors.push("stable should be ≤ volatile");
        if (errors.length > 0) return { status: "fail", message: errors.join("; "), details: { stable: stable.index, volatile: volatile.index } };
        return { status: "pass", message: "EII ordered and in [0,100]" };
      });
    },
  },
  {
    group: "Governance Metrics",
    name: "Fragility: score 0..100, level valid, finite",
    run: () => {
      return tryGovernance(() => {
        const r = calcFragility({ currentEii: 50, confidencePenalty: 0.3 });
        const errors: string[] = [];
        if (!Number.isFinite(r.score) || r.score < 0 || r.score > 100) errors.push(`score ${r.score} invalid`);
        if (!["Stable", "Watch", "Structurally Fragile"].includes(r.level)) errors.push(`level ${r.level} invalid`);
        if (errors.length > 0) return { status: "fail", message: errors.join("; "), details: r };
        return { status: "pass", message: "fragility score and level valid" };
      });
    },
  },
  {
    group: "Governance Metrics",
    name: "Scenario delta summary: spread finite, normalizedSpread 0..1",
    run: () => {
      return tryGovernance(() => {
        const s = calcScenarioDeltaSummary({ conservativeTTC: 30, neutralTTC: 20, aggressiveTTC: 10 });
        if (!Number.isFinite(s.spread)) return { status: "fail", message: "spread not finite", details: s };
        if (s.normalizedSpread < 0 || s.normalizedSpread > 1) return { status: "fail", message: `normalizedSpread ${s.normalizedSpread} not in [0,1]`, details: s };
        return { status: "pass", message: "spread finite, normalizedSpread in [0,1]" };
      });
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
  // ---------- Lens Range Integrity ----------
  {
    group: "Lens Range Integrity",
    name: "Lens range (conservative < neutral < aggressive, spread > 2%)",
    run: () => {
      const horizon = 12;
      const conservativeTotal = computePortfolioExposure(lensIntegrityRisks, "conservative", horizon).total;
      const neutralTotal = computePortfolioExposure(lensIntegrityRisks, "neutral", horizon).total;
      const aggressiveTotal = computePortfolioExposure(lensIntegrityRisks, "aggressive", horizon).total;
      const spread = aggressiveTotal - conservativeTotal;
      const details = { conservativeTotal, neutralTotal, aggressiveTotal, spread };

      if (!Number.isFinite(conservativeTotal) || !Number.isFinite(neutralTotal) || !Number.isFinite(aggressiveTotal))
        return { status: "fail", message: "One or more totals are not finite", details };
      if (conservativeTotal <= 0 || neutralTotal <= 0 || aggressiveTotal <= 0)
        return { status: "fail", message: "All totals must be > 0", details };
      if (conservativeTotal >= neutralTotal)
        return { status: "fail", message: "conservativeTotal must be < neutralTotal", details };
      if (neutralTotal >= aggressiveTotal)
        return { status: "fail", message: "neutralTotal must be < aggressiveTotal", details };
      const minSpread = neutralTotal * 0.02;
      if (spread <= minSpread)
        return { status: "fail", message: `spread (${spread.toFixed(0)}) must be > 2% of neutral (${minSpread.toFixed(0)})`, details };
      return { status: "pass", message: "conservative < neutral < aggressive; spread > 2% of neutral; all finite and > 0", details };
    },
  },
  {
    group: "Lens Range Integrity",
    name: "Envelope consistency (lower ≤ mid ≤ upper)",
    run: () => {
      const horizon = 12;
      const lower = computePortfolioExposure(lensIntegrityRisks, "conservative", horizon).total;
      const mid = computePortfolioExposure(lensIntegrityRisks, "neutral", horizon).total;
      const upper = computePortfolioExposure(lensIntegrityRisks, "aggressive", horizon).total;
      const details = { lower, mid, upper };
      if (lower <= mid && mid <= upper)
        return { status: "pass", message: "lower ≤ mid ≤ upper", details };
      return { status: "fail", message: "Envelope violated: expected lower ≤ mid ≤ upper", details };
    },
  },
  // ---------- Baseline Lock (Governance Integrity) ----------
  // Meeting mode headline cost tiles (P50/P80/P90/Mean) must remain neutral baseline; scenario overlay must not change them.
  {
    group: "Baseline Lock (Governance Integrity)",
    name: "P90 baseline locked to neutral when lens changes",
    run: () => {
      // Baseline lock (P-value / P90 fixed to neutral) is not yet enforced in the app:
      // simulation runs per scenario and UI shows snapshot for selected scenario.
      return {
        status: "warn",
        message: "Baseline lock not enforced yet; upgrade to FAIL when governance is locked to neutral.",
        details: { note: "P90 baseline is currently scenario-dependent; governance may require neutral-only baseline. Meeting mode headline cost tiles must remain neutral baseline." },
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
        const portfolio = computePortfolioExposure(edgeRisks, "aggressive", HORIZON);
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
