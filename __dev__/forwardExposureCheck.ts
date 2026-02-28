/**
 * Dev harness for forward exposure engine (pure functions).
 * Run from repo root: npx tsx __dev__/forwardExposureCheck.ts
 */

import { createRisk } from "../src/domain/risk/risk.factory";
import type { Risk } from "../src/domain/risk/risk.schema";
import {
  computeMitigationAdjustment,
  applyScenario,
  buildTimeWeights,
  computeRiskExposureCurve,
  computePortfolioExposure,
} from "../src/engine/forwardExposure";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assert failed: ${message}`);
}

function assertApprox(actual: number, expected: number, tolerance: number, label: string): void {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (!ok) throw new Error(`${label}: expected ≈ ${expected}, got ${actual}`);
}

function runTests(): void {
  const horizonMonths = 12;

  // --- computeMitigationAdjustment
  const riskWithMitigation = createRisk({
    mitigationProfile: {
      status: "active",
      effectiveness: 0.6,
      confidence: 0.7,
      reduces: 0.5,
      lagMonths: 3,
    },
  });
  const adjBefore = computeMitigationAdjustment(riskWithMitigation, 1);
  const adjAfter = computeMitigationAdjustment(riskWithMitigation, 5);
  assert(adjBefore.probMultiplier === 1 && adjBefore.impactMultiplier === 1, "before lag: no reduction");
  assert(adjAfter.impactMultiplier < 1 && adjAfter.probMultiplier <= 1, "after lag: reduced");

  const riskNoMitigation = createRisk({
    mitigationProfile: { status: "none", effectiveness: 0, confidence: 0, reduces: 0, lagMonths: 0 },
  });
  const adjNone = computeMitigationAdjustment(riskNoMitigation, 10);
  assert(adjNone.probMultiplier === 1 && adjNone.impactMultiplier === 1, "status none: no adjustment");

  // --- applyScenario
  const r = createRisk({ probability: 0.5, baseCostImpact: 100_000 });
  const neutral = applyScenario(r, "neutral");
  const conservative = applyScenario(r, "conservative");
  const aggressive = applyScenario(r, "aggressive");
  assert(neutral.probability === 0.5 && neutral.baseCostImpact === 100_000, "neutral unchanged");
  assert(conservative.probability < 0.5 && conservative.baseCostImpact < 100_000, "conservative lower");
  assert(aggressive.probability > 0.5 && aggressive.baseCostImpact > 100_000, "aggressive higher");

  // --- buildTimeWeights
  const riskFront = createRisk({ timeProfile: "front" });
  const weightsFront = buildTimeWeights(riskFront, horizonMonths);
  const sumWeights = weightsFront.reduce((a, b) => a + b, 0);
  assertApprox(sumWeights, 1, 1e-9, "time weights sum to 1");
  assert(weightsFront.length === horizonMonths, "time weights length");
  assert(weightsFront[0]! > (weightsFront[horizonMonths - 1] ?? 0), "front-loaded: first > last");

  const riskArrayWeights = createRisk({ timeProfile: [1, 2, 3, 0, 0] });
  const weightsArray = buildTimeWeights(riskArrayWeights, 5);
  assertApprox(weightsArray.reduce((a, b) => a + b, 0), 1, 1e-9, "array weights sum to 1");
  assert(weightsArray[1]! > weightsArray[0]! && weightsArray[2]! > weightsArray[1]!, "array shape preserved");

  // --- computeRiskExposureCurve
  const curve = computeRiskExposureCurve(r, "neutral", horizonMonths, { includeDebug: true });
  assert(curve.monthlyExposure.length === horizonMonths, "curve length");
  assert(curve.total >= 0, "curve total non-negative");
  assert(curve.debug?.adjustedParams != null && curve.debug.timeWeights.length === horizonMonths, "debug present when requested");

  // --- computePortfolioExposure
  const risks: Risk[] = [
    createRisk({ id: "a", category: "commercial", baseCostImpact: 50_000 }),
    createRisk({ id: "b", category: "programme", baseCostImpact: 80_000 }),
    createRisk({ id: "c", category: "commercial", baseCostImpact: 30_000 }),
  ];
  const portfolio = computePortfolioExposure(risks, "neutral", horizonMonths, { topN: 2, includeDebug: true });
  assert(portfolio.monthlyTotal.length === horizonMonths, "portfolio monthly length");
  assert(portfolio.total >= 0, "portfolio total non-negative");
  assert(Object.keys(portfolio.byCategory).length >= 1, "byCategory has entries");
  assert(portfolio.topDrivers.length <= 2, "topDrivers capped at topN");
  assert(portfolio.topDrivers[0]!.total >= (portfolio.topDrivers[1]?.total ?? 0), "topDrivers sorted by total desc");
  assert(portfolio.debug?.riskCurves.length === 3, "debug riskCurves length");

  console.log("All forward exposure checks passed.");
}

runTests();
