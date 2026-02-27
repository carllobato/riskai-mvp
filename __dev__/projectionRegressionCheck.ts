/**
 * Day 10 projection regression safeguards & ordering guardrails.
 * Part 1: Neutral baseline lock (legacy call === neutral).
 * Part 2: Scenario ordering (aggressive ≥ neutral ≥ conservative for pressure; TtC ordering).
 * Part 3: Confidence stability across profiles; weighted pressure ≤ raw (unless 100% conf).
 * Part 4: Defensive caps are in projectionProfiles.ts (getProjectionParams throws if out of bounds).
 * Run from repo root: npx tsx __dev__/projectionRegressionCheck.ts
 */

import type { RiskSnapshot } from "../src/domain/risk/risk-snapshot.types";
import { runForwardProjection } from "../src/lib/riskForecast";
import { computePortfolioForwardPressure } from "../src/lib/portfolioForwardPressure";
import { getProjectionParams } from "../src/lib/projectionProfiles";

/** Deterministic fixture: 3 risks, 5–6 snapshots each. */
function buildFixture(): { riskId: string; latest: RiskSnapshot; history: RiskSnapshot[] }[] {
  // Stable upward trend (smooth escalation)
  const stableUp: RiskSnapshot[] = [
    { riskId: "stableUp", cycleIndex: 0, timestamp: "2025-01-01T00:00:00Z", compositeScore: 30 },
    { riskId: "stableUp", cycleIndex: 1, timestamp: "2025-01-02T00:00:00Z", compositeScore: 38 },
    { riskId: "stableUp", cycleIndex: 2, timestamp: "2025-01-03T00:00:00Z", compositeScore: 46 },
    { riskId: "stableUp", cycleIndex: 3, timestamp: "2025-01-04T00:00:00Z", compositeScore: 54 },
    { riskId: "stableUp", cycleIndex: 4, timestamp: "2025-01-05T00:00:00Z", compositeScore: 62 },
    { riskId: "stableUp", cycleIndex: 5, timestamp: "2025-01-06T00:00:00Z", compositeScore: 70 },
  ];
  // Noisy/volatile (up-down-up)
  const noisy: RiskSnapshot[] = [
    { riskId: "noisy", cycleIndex: 0, timestamp: "2025-01-01T00:00:00Z", compositeScore: 50 },
    { riskId: "noisy", cycleIndex: 1, timestamp: "2025-01-02T00:00:00Z", compositeScore: 65 },
    { riskId: "noisy", cycleIndex: 2, timestamp: "2025-01-03T00:00:00Z", compositeScore: 48 },
    { riskId: "noisy", cycleIndex: 3, timestamp: "2025-01-04T00:00:00Z", compositeScore: 72 },
    { riskId: "noisy", cycleIndex: 4, timestamp: "2025-01-05T00:00:00Z", compositeScore: 55 },
    { riskId: "noisy", cycleIndex: 5, timestamp: "2025-01-06T00:00:00Z", compositeScore: 68 },
  ];
  // Flat/stable (no trend)
  const flat: RiskSnapshot[] = [
    { riskId: "flat", cycleIndex: 0, timestamp: "2025-01-01T00:00:00Z", compositeScore: 45 },
    { riskId: "flat", cycleIndex: 1, timestamp: "2025-01-02T00:00:00Z", compositeScore: 45 },
    { riskId: "flat", cycleIndex: 2, timestamp: "2025-01-03T00:00:00Z", compositeScore: 46 },
    { riskId: "flat", cycleIndex: 3, timestamp: "2025-01-04T00:00:00Z", compositeScore: 45 },
    { riskId: "flat", cycleIndex: 4, timestamp: "2025-01-05T00:00:00Z", compositeScore: 45 },
  ];
  return [
    { riskId: "stableUp", latest: stableUp[stableUp.length - 1]!, history: stableUp },
    { riskId: "noisy", latest: noisy[noisy.length - 1]!, history: noisy },
    { riskId: "flat", latest: flat[flat.length - 1]!, history: flat },
  ];
}

function run(): number {
  const fixture = buildFixture();
  const risks = fixture.map(({ riskId }) => ({ id: riskId, mitigationStrength: 0 as number | undefined }));
  const getLatestSnapshot = (id: string) => fixture.find((f) => f.riskId === id)?.latest ?? null;
  const getRiskHistory = (id: string) => fixture.find((f) => f.riskId === id)?.history ?? [];

  let failed = false;

  // ---------- Part 1: Neutral baseline lock ----------
  const legacy = runForwardProjection(risks, getLatestSnapshot, getRiskHistory);
  const neutral = runForwardProjection(risks, getLatestSnapshot, getRiskHistory, { profile: "neutral" });

  for (const risk of risks) {
    const l = legacy.riskForecastsById[risk.id];
    const n = neutral.riskForecastsById[risk.id];
    if (!l || !n) {
      console.error(`[projectionRegressionCheck] Part 1 FAIL: missing forecast for ${risk.id}`);
      failed = true;
      continue;
    }
    if (l.baselineForecast.projectedCritical !== n.baselineForecast.projectedCritical) {
      console.error(`[projectionRegressionCheck] Part 1 FAIL: ${risk.id} projectedCritical legacy=${l.baselineForecast.projectedCritical} neutral=${n.baselineForecast.projectedCritical}`);
      failed = true;
    }
    if (l.baselineForecast.timeToCritical !== n.baselineForecast.timeToCritical) {
      console.error(`[projectionRegressionCheck] Part 1 FAIL: ${risk.id} timeToCritical legacy=${l.baselineForecast.timeToCritical} neutral=${n.baselineForecast.timeToCritical}`);
      failed = true;
    }
    if (l.mitigationInsufficient !== n.mitigationInsufficient) {
      console.error(`[projectionRegressionCheck] Part 1 FAIL: ${risk.id} mitigationInsufficient legacy=${l.mitigationInsufficient} neutral=${n.mitigationInsufficient}`);
      failed = true;
    }
  }

  const rawLegacy = {
    totalRisks: legacy.forwardPressure.totalRisks,
    projectedCriticalCount: legacy.forwardPressure.projectedCriticalCount,
    mitigationInsufficientCount: legacy.forwardPressure.mitigationInsufficientCount,
    pctProjectedCritical: legacy.forwardPressure.pctProjectedCritical,
    pctMitigationInsufficient: legacy.forwardPressure.pctMitigationInsufficient,
    pressureClass: legacy.forwardPressure.pressureClass,
  };
  const rawNeutral = {
    totalRisks: neutral.forwardPressure.totalRisks,
    projectedCriticalCount: neutral.forwardPressure.projectedCriticalCount,
    mitigationInsufficientCount: neutral.forwardPressure.mitigationInsufficientCount,
    pctProjectedCritical: neutral.forwardPressure.pctProjectedCritical,
    pctMitigationInsufficient: neutral.forwardPressure.pctMitigationInsufficient,
    pressureClass: neutral.forwardPressure.pressureClass,
  };
  if (JSON.stringify(rawLegacy) !== JSON.stringify(rawNeutral)) {
    console.error("[projectionRegressionCheck] Part 1 FAIL: forwardPressureRaw (legacy) !== (neutral).", { rawLegacy, rawNeutral });
    failed = true;
  }

  if (!failed) console.log("[projectionRegressionCheck] Part 1 OK: Neutral baseline lock (projectedCritical, TtC, forwardPressureRaw, mitigation flags).");

  // ---------- Part 2: Scenario ordering guardrails ----------
  const conservative = runForwardProjection(risks, getLatestSnapshot, getRiskHistory, { profile: "conservative" });
  const aggressive = runForwardProjection(risks, getLatestSnapshot, getRiskHistory, { profile: "aggressive" });

  const neutralF = neutral.riskForecastsById;
  const conservativeF = conservative.riskForecastsById;
  const aggressiveF = aggressive.riskForecastsById;

  for (const risk of risks) {
    const n = neutralF[risk.id]?.baselineForecast.timeToCritical;
    const c = conservativeF[risk.id]?.baselineForecast.timeToCritical;
    const a = aggressiveF[risk.id]?.baselineForecast.timeToCritical;
    if (n != null) {
      if (a != null && a > n) {
        console.error(`[projectionRegressionCheck] Part 2 FAIL: ${risk.id} aggressive TtC (${a}) > neutral (${n}).`);
        failed = true;
      }
      if (c != null && c < n) {
        console.error(`[projectionRegressionCheck] Part 2 FAIL: ${risk.id} conservative TtC (${c}) < neutral (${n}).`);
        failed = true;
      }
    }
  }

  const pctN = neutral.forwardPressure.pctProjectedCritical;
  const pctC = conservative.forwardPressure.pctProjectedCritical;
  const pctA = aggressive.forwardPressure.pctProjectedCritical;
  if (pctA < pctN) {
    console.error(`[projectionRegressionCheck] Part 2 FAIL: aggressive forwardPressure (${pctA}) < neutral (${pctN}).`);
    failed = true;
  }
  if (pctC > pctN) {
    console.error(`[projectionRegressionCheck] Part 2 FAIL: conservative forwardPressure (${pctC}) > neutral (${pctN}).`);
    failed = true;
  }

  if (!failed) console.log("[projectionRegressionCheck] Part 2 OK: Scenario ordering (TtC and portfolio pressure).");

  // ---------- Part 3: Confidence stability ----------
  for (const risk of risks) {
    const confLegacy = legacy.riskForecastsById[risk.id]?.forecastConfidence;
    const confNeutral = neutral.riskForecastsById[risk.id]?.forecastConfidence;
    const confCons = conservative.riskForecastsById[risk.id]?.forecastConfidence;
    const confAgg = aggressive.riskForecastsById[risk.id]?.forecastConfidence;
    if (confLegacy !== confNeutral || confNeutral !== confCons || confCons !== confAgg) {
      console.error(`[projectionRegressionCheck] Part 3 FAIL: ${risk.id} forecastConfidence differs across profiles. legacy=${confLegacy} neutral=${confNeutral} conservative=${confCons} aggressive=${confAgg}`);
      failed = true;
    }
  }

  const list = Object.values(neutral.riskForecastsById);
  const rawPressure = computePortfolioForwardPressure(list, "neutral");
  const rawPct = rawPressure.pctProjectedCritical;
  const weightedPressure = rawPressure.forwardPressureWeighted;
  const weightedPct = weightedPressure?.pctProjectedCritical;
  const all100 = list.length > 0 && list.every((f) => f.forecastConfidence >= 99.5);
  if (weightedPct != null && !all100 && weightedPct > rawPct) {
    console.error(`[projectionRegressionCheck] Part 3 FAIL: confidenceWeightedPressure (${weightedPct}) > rawForwardPressure (${rawPct}) without 100% confidence.`);
    failed = true;
  }

  if (!failed) console.log("[projectionRegressionCheck] Part 3 OK: Confidence stable across profiles; weighted ≤ raw (unless 100% conf).");

  // ---------- Part 4: Defensive caps (validated in projectionProfiles.ts at module load) ----------
  const neutralParams = getProjectionParams("neutral");
  const consParams = getProjectionParams("conservative");
  const aggParams = getProjectionParams("aggressive");
  const minM = neutralParams.momentumDecay * 0.5;
  const maxM = neutralParams.momentumDecay * 1.5;
  const minC = neutralParams.confidenceDecay * 0.5;
  const maxC = neutralParams.confidenceDecay * 1.5;
  if (consParams.momentumDecay < minM || consParams.momentumDecay > maxM || aggParams.momentumDecay < minM || aggParams.momentumDecay > maxM) {
    console.error("[projectionRegressionCheck] Part 4 FAIL: momentumDecay outside 0.5x–1.5x of neutral.");
    failed = true;
  }
  if (consParams.confidenceDecay < minC || consParams.confidenceDecay > maxC || aggParams.confidenceDecay < minC || aggParams.confidenceDecay > maxC) {
    console.error("[projectionRegressionCheck] Part 4 FAIL: confidenceDecay outside 0.5x–1.5x of neutral.");
    failed = true;
  }
  if (!failed) console.log("[projectionRegressionCheck] Part 4 OK: Decay multipliers within safe bounds (0.5x–1.5x of neutral).");

  if (failed) {
    console.error("[projectionRegressionCheck] One or more checks failed.");
    return 1;
  }
  console.log("[projectionRegressionCheck] All regression safeguards passed.");
  return 0;
}

process.exit(run());
