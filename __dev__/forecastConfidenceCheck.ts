/**
 * Minimal checks for forecast confidence: stability vs noise, depth, and 0–100 integer.
 * Run from repo root: npx tsx __dev__/forecastConfidenceCheck.ts
 * Exits 0 if all checks pass, non-zero otherwise.
 */

import type { RiskSnapshot } from "../src/domain/risk/risk-snapshot.types";
import { computeForecastConfidence } from "../src/lib/forecastConfidence";

function historyFromScores(riskId: string, scores: number[]): RiskSnapshot[] {
  return scores.map((compositeScore, i) => ({
    riskId,
    cycleIndex: i,
    timestamp: `2025-01-0${i + 1}T00:00:00Z`,
    compositeScore,
  }));
}

function run(): number {
  let failed = false;

  // 1) Score always integer 0–100
  const empty = historyFromScores("r0", [50]);
  const one = computeForecastConfidence(empty);
  if (!Number.isInteger(one.score) || one.score < 0 || one.score > 100) {
    console.error("[forecastConfidenceCheck] FAIL: score must be integer 0–100, got", one.score);
    failed = true;
  }
  const two = historyFromScores("r2", [40, 50]);
  const res2 = computeForecastConfidence(two);
  if (!Number.isInteger(res2.score) || res2.score < 0 || res2.score > 100) {
    console.error("[forecastConfidenceCheck] FAIL: score must be integer 0–100, got", res2.score);
    failed = true;
  }
  if (!failed) console.log("[forecastConfidenceCheck] OK: score is integer 0–100");

  // 2) Stable monotonic history → higher confidence than noisy same-length
  const stable = historyFromScores("s", [20, 30, 40, 50, 60]); // 5 points, all increasing
  const noisy = historyFromScores("n", [50, 30, 55, 25, 60]);  // 5 points, flip-flop
  const stableRes = computeForecastConfidence(stable);
  const noisyRes = computeForecastConfidence(noisy);
  if (stableRes.score <= noisyRes.score) {
    console.error(
      "[forecastConfidenceCheck] FAIL: stable history should have higher confidence than noisy. stable=",
      stableRes.score,
      "noisy=",
      noisyRes.score
    );
    failed = true;
  } else {
    console.log(
      "[forecastConfidenceCheck] OK: stable confidence (",
      stableRes.score,
      ") > noisy (",
      noisyRes.score,
      ")"
    );
  }

  // 3) Increasing history length should generally increase confidence (all else equal)
  const len2 = historyFromScores("l2", [40, 50]);
  const len4 = historyFromScores("l4", [35, 42, 48, 55]);
  const len6 = historyFromScores("l6", [30, 38, 45, 52, 58, 65]);
  const c2 = computeForecastConfidence(len2).score;
  const c4 = computeForecastConfidence(len4).score;
  const c6 = computeForecastConfidence(len6).score;
  if (c2 > c6 || c4 > c6) {
    console.error(
      "[forecastConfidenceCheck] FAIL: longer history should generally yield higher confidence. len2=",
      c2,
      "len4=",
      c4,
      "len6=",
      c6
    );
    failed = true;
  } else {
    console.log("[forecastConfidenceCheck] OK: longer history → higher confidence (", c2, "<=", c4, "<=", c6, ")");
  }

  if (failed) {
    console.error("[forecastConfidenceCheck] Some checks failed.");
    return 1;
  }
  console.log("[forecastConfidenceCheck] All checks passed.");
  return 0;
}

process.exit(run());
