/**
 * Minimal check: scenario comparison neutral equals main default; conservative ≤ neutral ≤ aggressive pressure (normal cases).
 * Run from repo root: npx tsx __dev__/scenarioComparisonCheck.ts
 */

import type { RiskSnapshot } from "../src/domain/risk/risk-snapshot.types";
import { runForwardProjection, computeScenarioComparison } from "../src/lib/riskForecast";

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
  return [
    { riskId: "r1", latest: r1[r1.length - 1]!, history: r1 },
    { riskId: "r2", latest: r2[r2.length - 1]!, history: r2 },
  ];
}

function run(): number {
  const fixture = buildFixture();
  const risks = fixture.map(({ riskId }) => ({ id: riskId, mitigationStrength: 0 as number | undefined }));
  const getLatestSnapshot = (id: string) => fixture.find((f) => f.riskId === id)?.latest ?? null;
  const getRiskHistory = (id: string) => fixture.find((f) => f.riskId === id)?.history ?? [];

  const main = runForwardProjection(risks, getLatestSnapshot, getRiskHistory, { profile: "neutral" });
  const comparison = computeScenarioComparison(risks, getLatestSnapshot, getRiskHistory);

  if (comparison.neutral.forwardPressure.projectedCriticalCount !== main.forwardPressure.projectedCriticalCount
    || comparison.neutral.forwardPressure.pctProjectedCritical !== main.forwardPressure.pctProjectedCritical
    || comparison.neutral.forwardPressure.pressureClass !== main.forwardPressure.pressureClass) {
    console.error("[scenarioComparisonCheck] FAIL: neutral column should equal main default (neutral run).");
    return 1;
  }
  console.log("[scenarioComparisonCheck] OK: neutral column equals main default.");

  const c = comparison.conservative.forwardPressure.pctProjectedCritical;
  const n = comparison.neutral.forwardPressure.pctProjectedCritical;
  const a = comparison.aggressive.forwardPressure.pctProjectedCritical;
  if (c > n || a < n) {
    console.error("[scenarioComparisonCheck] FAIL: expected conservative <= neutral <= aggressive. c=", c, "n=", n, "a=", a);
    return 1;
  }
  console.log("[scenarioComparisonCheck] OK: conservative <= neutral <= aggressive pressure (pct).");
  return 0;
}

process.exit(run());
