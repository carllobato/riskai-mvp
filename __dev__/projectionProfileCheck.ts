/**
 * Regression and ordering checks for projection profile pipeline.
 * 1) Neutral (explicit) === no-profile (baseline) for riskForecastsById and forwardPressure.
 * 2) Conservative: TtC >= Neutral (or null). Aggressive: TtC <= Neutral.
 *    Edge cases (already-critical, capped) excluded from ordering; see comments below.
 * Run from repo root: npx tsx __dev__/projectionProfileCheck.ts
 */

import type { RiskSnapshot } from "../src/domain/risk/risk-snapshot.types";
import { runForwardProjection } from "../src/lib/riskForecast";

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) return false;
  const keysA = Object.keys(a as object).sort();
  const keysB = Object.keys(b as object).sort();
  if (keysA.length !== keysB.length || keysA.some((k, i) => k !== keysB[i])) return false;
  return keysA.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** Deterministic fixture: 3 risks, 4–6 snapshots each (not already-critical; some cross into critical). */
function buildFixture(): { riskId: string; latest: RiskSnapshot; history: RiskSnapshot[] }[] {
  const r1: RiskSnapshot[] = [
    { riskId: "r1", cycleIndex: 0, timestamp: "2025-01-01T00:00:00Z", compositeScore: 30 },
    { riskId: "r1", cycleIndex: 1, timestamp: "2025-01-02T00:00:00Z", compositeScore: 40 },
    { riskId: "r1", cycleIndex: 2, timestamp: "2025-01-03T00:00:00Z", compositeScore: 52 },
    { riskId: "r1", cycleIndex: 3, timestamp: "2025-01-04T00:00:00Z", compositeScore: 58 },
    { riskId: "r1", cycleIndex: 4, timestamp: "2025-01-05T00:00:00Z", compositeScore: 65 },
  ];
  const r2: RiskSnapshot[] = [
    { riskId: "r2", cycleIndex: 0, timestamp: "2025-01-01T00:00:00Z", compositeScore: 70 },
    { riskId: "r2", cycleIndex: 1, timestamp: "2025-01-02T00:00:00Z", compositeScore: 72 },
    { riskId: "r2", cycleIndex: 2, timestamp: "2025-01-03T00:00:00Z", compositeScore: 75 },
    { riskId: "r2", cycleIndex: 3, timestamp: "2025-01-04T00:00:00Z", compositeScore: 76 },
  ];
  const r3: RiskSnapshot[] = [
    { riskId: "r3", cycleIndex: 0, timestamp: "2025-01-01T00:00:00Z", compositeScore: 10 },
    { riskId: "r3", cycleIndex: 1, timestamp: "2025-01-02T00:00:00Z", compositeScore: 15 },
    { riskId: "r3", cycleIndex: 2, timestamp: "2025-01-03T00:00:00Z", compositeScore: 18 },
    { riskId: "r3", cycleIndex: 3, timestamp: "2025-01-04T00:00:00Z", compositeScore: 20 },
    { riskId: "r3", cycleIndex: 4, timestamp: "2025-01-05T00:00:00Z", compositeScore: 22 },
    { riskId: "r3", cycleIndex: 5, timestamp: "2025-01-06T00:00:00Z", compositeScore: 25 },
  ];
  return [
    { riskId: "r1", latest: r1[r1.length - 1]!, history: r1 },
    { riskId: "r2", latest: r2[r2.length - 1]!, history: r2 },
    { riskId: "r3", latest: r3[r3.length - 1]!, history: r3 },
  ];
}

function run(): number {
  const fixture = buildFixture();
  const risks = fixture.map(({ riskId }) => ({ id: riskId, mitigationStrength: 0 as number | undefined }));
  const getLatestSnapshot = (id: string) => fixture.find((f) => f.riskId === id)?.latest ?? null;
  const getRiskHistory = (id: string) => fixture.find((f) => f.riskId === id)?.history ?? [];

  let failed = false;

  // 1) Neutral === baseline (no-profile)
  const baseline = runForwardProjection(risks, getLatestSnapshot, getRiskHistory);
  const withNeutral = runForwardProjection(risks, getLatestSnapshot, getRiskHistory, { profile: "neutral" });

  if (!deepEqual(baseline.riskForecastsById, withNeutral.riskForecastsById)) {
    console.error("[projectionProfileCheck] FAIL: riskForecastsById with neutral !== baseline (no-profile).");
    failed = true;
  } else {
    console.log("[projectionProfileCheck] OK: neutral produces identical riskForecastsById to baseline.");
  }

  const pressureBaseline = { ...baseline.forwardPressure };
  const pressureNeutral = { ...withNeutral.forwardPressure };
  if (!deepEqual(pressureBaseline, pressureNeutral)) {
    console.error("[projectionProfileCheck] FAIL: forwardPressure with neutral !== baseline (no-profile).");
    failed = true;
  } else {
    console.log("[projectionProfileCheck] OK: neutral produces identical forwardPressure to baseline.");
  }

  // 2) Ordering: conservative TtC >= neutral (or null); aggressive TtC <= neutral.
  // Edge cases (excluded from assertion): already-critical (current band critical), capped at 0/100 —
  // we only assert when neutral has numeric timeToCritical (crosses into critical).
  const neutralResult = runForwardProjection(risks, getLatestSnapshot, getRiskHistory, { profile: "neutral" });
  const conservativeResult = runForwardProjection(risks, getLatestSnapshot, getRiskHistory, { profile: "conservative" });
  const aggressiveResult = runForwardProjection(risks, getLatestSnapshot, getRiskHistory, { profile: "aggressive" });

  for (const risk of risks) {
    const n = neutralResult.riskForecastsById[risk.id];
    const c = conservativeResult.riskForecastsById[risk.id];
    const a = aggressiveResult.riskForecastsById[risk.id];
    if (!n || !c || !a) continue;
    const neutralTtC = n.baselineForecast.timeToCritical;
    const conservativeTtC = c.baselineForecast.timeToCritical;
    const aggressiveTtC = a.baselineForecast.timeToCritical;
    // Only assert when neutral has a numeric TtC (risk crosses into critical under neutral).
    if (neutralTtC !== null) {
      if (conservativeTtC !== null && conservativeTtC < neutralTtC) {
        console.error(
          `[projectionProfileCheck] FAIL: ${risk.id} conservative TtC (${conservativeTtC}) < neutral (${neutralTtC}).`
        );
        failed = true;
      }
      if (aggressiveTtC !== null && aggressiveTtC > neutralTtC) {
        console.error(
          `[projectionProfileCheck] FAIL: ${risk.id} aggressive TtC (${aggressiveTtC}) > neutral (${neutralTtC}).`
        );
        failed = true;
      }
    }
  }
  if (!failed) {
    console.log("[projectionProfileCheck] OK: conservative/aggressive TtC ordering vs neutral.");
  }

  if (failed) {
    console.error("[projectionProfileCheck] Some checks failed.");
    return 1;
  }
  console.log("[projectionProfileCheck] All checks passed.");
  return 0;
}

process.exit(run());
