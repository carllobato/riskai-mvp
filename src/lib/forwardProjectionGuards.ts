/**
 * Dev-only guard checks for forward projection. Run when DEBUG_FORWARD_PROJECTION is true.
 * No test runner required; logs pass/fail to console.
 */

import type { RiskSnapshot } from "@/domain/risk/risk-snapshot.types";
import { computeMomentum } from "@/lib/riskMomentum";
import { projectForward, buildRiskForecast, buildMitigationStressForecast } from "@/lib/riskForecast";

const PREFIX = "[ForwardProjection]";

function ok(label: string, pass: boolean, detail?: string): void {
  const icon = pass ? "✓" : "✗";
  const msg = detail ? `${label}: ${detail}` : label;
  console.log(`${PREFIX} ${icon} ${msg}`);
}

/**
 * 1) No history => momentum 0, no projectedCritical
 */
function checkNoHistory(): boolean {
  const { momentumPerCycle, confidence } = computeMomentum([]);
  const forecast = buildRiskForecast("test", null, []);
  const momentumOk = momentumPerCycle === 0;
  const noProjectedCritical = forecast.projectedCritical === false;
  const pass = momentumOk && noProjectedCritical;
  ok("No history => momentum 0, no projectedCritical", pass, pass ? undefined : `momentum=${momentumPerCycle} projectedCritical=${forecast.projectedCritical}`);
  return pass;
}

/**
 * 2) Constant score => momentum 0
 */
function checkConstantScore(): boolean {
  const history: RiskSnapshot[] = [
    { riskId: "r1", cycleIndex: 0, timestamp: "2025-01-01T00:00:00Z", compositeScore: 50 },
    { riskId: "r1", cycleIndex: 1, timestamp: "2025-01-02T00:00:00Z", compositeScore: 50 },
    { riskId: "r1", cycleIndex: 2, timestamp: "2025-01-03T00:00:00Z", compositeScore: 50 },
  ];
  const { momentumPerCycle } = computeMomentum(history);
  const pass = momentumPerCycle === 0;
  ok("Constant score => momentum 0", pass, pass ? undefined : `momentum=${momentumPerCycle}`);
  return pass;
}

/**
 * 3) Increasing trend => momentum positive but clamped to [+8]
 */
function checkIncreasingClamped(): boolean {
  const history: RiskSnapshot[] = [
    { riskId: "r1", cycleIndex: 0, timestamp: "2025-01-01T00:00:00Z", compositeScore: 10 },
    { riskId: "r1", cycleIndex: 1, timestamp: "2025-01-02T00:00:00Z", compositeScore: 30 },
    { riskId: "r1", cycleIndex: 2, timestamp: "2025-01-03T00:00:00Z", compositeScore: 60 },
  ];
  const { momentumPerCycle } = computeMomentum(history);
  const positive = momentumPerCycle > 0;
  const clamped = momentumPerCycle <= 8;
  const pass = positive && clamped;
  ok("Increasing trend => momentum positive but clamped", pass, `momentum=${momentumPerCycle} (expected 0 < m <= 8)`);
  return pass;
}

/**
 * 4) Projection never exceeds [0, 100]
 */
function checkProjectionBounds(): boolean {
  const points = projectForward({
    currentScore: 95,
    momentumPerCycle: 10, // would push past 100 without clamp
    confidence: 0.8,
    horizon: 5,
    clampMin: 0,
    clampMax: 100,
  });
  const allInBounds = points.every((p) => p.projectedScore >= 0 && p.projectedScore <= 100);
  const noneAbove100 = points.every((p) => p.projectedScore <= 100);
  const pass = allInBounds && noneAbove100;
  ok("Projection never exceeds [0, 100]", pass, pass ? undefined : `scores: ${points.map((p) => p.projectedScore).join(", ")}`);
  return pass;
}

/**
 * 5) MitigationStrength=1 => effectiveMomentum ~0 (mitigated forecast flat)
 */
function checkMitigationFull(): boolean {
  const latest: RiskSnapshot = {
    riskId: "r1",
    cycleIndex: 2,
    timestamp: "2025-01-03T00:00:00Z",
    compositeScore: 60,
    momentum: 5,
  };
  const history: RiskSnapshot[] = [
    { riskId: "r1", cycleIndex: 0, timestamp: "2025-01-01T00:00:00Z", compositeScore: 40 },
    { riskId: "r1", cycleIndex: 1, timestamp: "2025-01-02T00:00:00Z", compositeScore: 50 },
    latest,
  ];
  const result = buildMitigationStressForecast("r1", latest, history, 1);
  // With strength=1, effectiveMomentum = 5 * 0 = 0, so mitigated points should be flat (all ~60)
  const mitigatedPoints = result.mitigatedForecast.points;
  const baselinePoints = result.baselineForecast.points;
  const mitigatedFlat = mitigatedPoints.every((p) => Math.abs(p.projectedScore - 60) < 1);
  const baselineRising = baselinePoints.length > 0 && baselinePoints[baselinePoints.length - 1].projectedScore > 60;
  const pass = mitigatedFlat && baselineRising;
  ok("MitigationStrength=1 => effectiveMomentum ~0", pass, pass ? undefined : `mitigated scores: ${mitigatedPoints.map((p) => p.projectedScore.toFixed(1)).join(", ")}`);
  return pass;
}

/**
 * Run all guard checks. Call in dev when DEBUG_FORWARD_PROJECTION is true.
 */
export function runForwardProjectionGuards(): void {
  console.log(`${PREFIX} Running guard checks…`);
  const results = [
    checkNoHistory(),
    checkConstantScore(),
    checkIncreasingClamped(),
    checkProjectionBounds(),
    checkMitigationFull(),
  ];
  const allPass = results.every(Boolean);
  console.log(`${PREFIX} ${allPass ? "All checks passed." : "Some checks failed."}`);
}
