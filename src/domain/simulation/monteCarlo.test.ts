/**
 * Unit tests for Monte Carlo simulation engine: getEffectiveRiskInputs, filtering, and Programme consistency.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  getEffectiveRiskInputs,
  runMonteCarloSimulation,
} from "@/domain/simulation/monteCarlo";
import type { Risk } from "@/domain/risk/risk.schema";

const baseRating = { probability: 3, consequence: 3, score: 9, level: "high" as const };
const iso = "2025-01-01T00:00:00.000Z";

function makeRisk(overrides: Partial<Risk> = {}): Risk {
  return {
    id: "r1",
    title: "Test Risk",
    category: "programme",
    status: "open",
    inherentRating: baseRating,
    residualRating: baseRating,
    createdAt: iso,
    updatedAt: iso,
    ...overrides,
  };
}

function assertFiniteNonNegative(label: string, value: number): void {
  assert.ok(Number.isFinite(value), `${label} should be finite, got ${value}`);
  assert.ok(value >= 0, `${label} should be >= 0, got ${value}`);
}

describe("getEffectiveRiskInputs", () => {
  it("returns null for closed risks", () => {
    const risk = makeRisk({ status: "closed" });
    assert.strictEqual(getEffectiveRiskInputs(risk), null);
  });

  it("uses post-mitigation when all post fields present", () => {
    const risk = makeRisk({
      preMitigationProbabilityPct: 60,
      preMitigationCostML: 100_000,
      preMitigationTimeML: 20,
      postMitigationProbabilityPct: 40,
      postMitigationCostML: 50_000,
      postMitigationTimeML: 10,
    });
    const out = getEffectiveRiskInputs(risk);
    assert.ok(out);
    assert.strictEqual(out.sourceUsed, "post");
    assert.strictEqual(out.probability, 0.4);
    assert.strictEqual(out.costML, 50_000);
    assert.strictEqual(out.timeML, 10);
  });

  it("falls back to pre-mitigation when post missing", () => {
    const risk = makeRisk({
      preMitigationProbabilityPct: 50,
      preMitigationCostML: 80_000,
      preMitigationTimeML: 15,
    });
    const out = getEffectiveRiskInputs(risk);
    assert.ok(out);
    assert.strictEqual(out.sourceUsed, "pre");
    assert.strictEqual(out.probability, 0.5);
    assert.strictEqual(out.costML, 80_000);
    assert.strictEqual(out.timeML, 15);
  });

  it("falls back to scenario/rating when no pre/post probability", () => {
    const risk = makeRisk({
      probability: 0.35,
      costImpact: 200_000,
      scheduleImpactDays: 25,
    });
    const out = getEffectiveRiskInputs(risk);
    assert.ok(out);
    assert.strictEqual(out.probability, 0.35);
    assert.strictEqual(out.costML, 200_000);
    assert.strictEqual(out.timeML, 25);
  });

  it("treats zero as present for cost and time", () => {
    const risk = makeRisk({
      preMitigationProbabilityPct: 10,
      preMitigationCostML: 0,
      preMitigationTimeML: 0,
    });
    const out = getEffectiveRiskInputs(risk);
    assert.ok(out);
    assert.strictEqual(out.costML, 0);
    assert.strictEqual(out.timeML, 0);
  });
});

describe("runMonteCarloSimulation", () => {
  it("excludes closed risks from simulation", () => {
    const risks: Risk[] = [
      makeRisk({ id: "a", status: "open", probability: 1, costImpact: 1000, scheduleImpactDays: 5 }),
      makeRisk({ id: "b", status: "closed", probability: 1, costImpact: 1_000_000, scheduleImpactDays: 1000 }),
    ];
    const result = runMonteCarloSimulation({ risks, iterations: 1000, seed: 42 });
    assert.ok(result.costSamples.length === 1000);
    const maxCost = Math.max(...result.costSamples);
    assert(maxCost < 100_000, "closed risk should not contribute; max cost should be from open risk only");
  });

  it("programme P-values are from combined time distribution", () => {
    const risks: Risk[] = [
      makeRisk({ id: "1", probability: 0.5, costImpact: 10_000, scheduleImpactDays: 10 }),
      makeRisk({ id: "2", probability: 0.5, costImpact: 20_000, scheduleImpactDays: 20 }),
    ];
    const result = runMonteCarloSimulation({ risks, iterations: 5000, seed: 123 });
    assert.ok(Number.isFinite(result.summary.p20Time));
    assert.ok(Number.isFinite(result.summary.p50Time));
    assert.ok(Number.isFinite(result.summary.p80Time));
    assert.ok(Number.isFinite(result.summary.p90Time));
    assert(result.summary.p50Time >= 0 && result.summary.p50Time <= 30, "P50 time should be in plausible range");
    assert(result.summary.p80Time >= result.summary.p50Time);
    assert(result.summary.p90Time >= result.summary.p80Time);
  });

  it("deterministic single risk 100% prob 10 days: all schedule percentiles equal 10", () => {
    const risks: Risk[] = [
      makeRisk({ id: "d", probability: 1, costImpact: 0, scheduleImpactDays: 10 }),
    ];
    const result = runMonteCarloSimulation({ risks, iterations: 1000, seed: 99 });
    assert.strictEqual(result.summary.p20Time, 10, "p20Time should be 10");
    assert.strictEqual(result.summary.p50Time, 10, "p50Time should be 10");
    assert.strictEqual(result.summary.p80Time, 10, "p80Time should be 10");
    assert.strictEqual(result.summary.p90Time, 10, "p90Time should be 10");
  });

  it("single risk with 100% probability produces identical samples so percentiles equal the constant", () => {
    const constantCost = 100_000;
    const constantTimeDays = 10;
    const risks: Risk[] = [
      makeRisk({
        id: "single",
        status: "open",
        probability: 1,
        costImpact: constantCost,
        scheduleImpactDays: constantTimeDays,
      }),
    ];
    const result = runMonteCarloSimulation({ risks, iterations: 100, seed: 42 });
    const s = result.summary;
    assert.strictEqual(s.p20Cost, constantCost, "p20Cost should equal constant cost");
    assert.strictEqual(s.p50Cost, constantCost, "p50Cost should equal constant cost");
    assert.strictEqual(s.p80Cost, constantCost, "p80Cost should equal constant cost");
    assert.strictEqual(s.p90Cost, constantCost, "p90Cost should equal constant cost");
    assert.strictEqual(s.p20Time, constantTimeDays, "p20Time should equal constant time");
    assert.strictEqual(s.p50Time, constantTimeDays, "p50Time should equal constant time");
    assert.strictEqual(s.p80Time, constantTimeDays, "p80Time should equal constant time");
    assert.strictEqual(s.p90Time, constantTimeDays, "p90Time should equal constant time");
    assert(s.p50Cost <= s.p80Cost && s.p80Cost <= s.p90Cost, "cost percentiles should be non-decreasing");
    assert(s.p50Time <= s.p80Time && s.p80Time <= s.p90Time, "time percentiles should be non-decreasing");
  });

  it("post-mitigation exposure is lower than pre-mitigation (P80 cost and time)", () => {
    const preCost = 200_000;
    const preTime = 20;
    const postCost = 100_000;
    const postTime = 10;
    const iterations = 100;
    const seed = 123;

    const riskPreOnly: Risk[] = [
      makeRisk({
        id: "r1",
        status: "open",
        preMitigationProbabilityPct: 100,
        preMitigationCostML: preCost,
        preMitigationTimeML: preTime,
      }),
    ];
    const riskWithPost: Risk[] = [
      makeRisk({
        id: "r1",
        status: "open",
        preMitigationProbabilityPct: 100,
        preMitigationCostML: preCost,
        preMitigationTimeML: preTime,
        postMitigationProbabilityPct: 100,
        postMitigationCostML: postCost,
        postMitigationTimeML: postTime,
      }),
    ];

    const resultPre = runMonteCarloSimulation({ risks: riskPreOnly, iterations, seed });
    const resultPost = runMonteCarloSimulation({ risks: riskWithPost, iterations, seed });

    assert.strictEqual(getEffectiveRiskInputs(riskPreOnly[0])?.sourceUsed, "pre");
    assert.strictEqual(getEffectiveRiskInputs(riskWithPost[0])?.sourceUsed, "post");

    assert(resultPost.summary.p80Cost < resultPre.summary.p80Cost, "post P80 cost should be lower than pre");
    assert(resultPost.summary.p80Time < resultPre.summary.p80Time, "post P80 time should be lower than pre");

    assert.strictEqual(resultPre.summary.p80Cost, preCost, "pre run: constant cost so P80 = pre cost");
    assert.strictEqual(resultPre.summary.p80Time, preTime, "pre run: constant time so P80 = pre time");
    assert.strictEqual(resultPost.summary.p80Cost, postCost, "post run: constant cost so P80 = post cost");
    assert.strictEqual(resultPost.summary.p80Time, postTime, "post run: constant time so P80 = post time");
  });

  it("no NaN or negative in summary percentiles for normal run", () => {
    const risks: Risk[] = [
      makeRisk({ id: "r1", probability: 0.3, costImpact: 50_000, scheduleImpactDays: 10 }),
      makeRisk({ id: "r2", probability: 0.5, costImpact: 100_000, scheduleImpactDays: 20 }),
      makeRisk({ id: "r3", probability: 0.2, costImpact: 25_000, scheduleImpactDays: 5 }),
      makeRisk({ id: "r4", probability: 0.4, costImpact: 75_000, scheduleImpactDays: 15 }),
    ];
    const result = runMonteCarloSimulation({ risks, iterations: 500, seed: 123 });
    const s = result.summary;

    assertFiniteNonNegative("p20Cost", s.p20Cost);
    assertFiniteNonNegative("p50Cost", s.p50Cost);
    assertFiniteNonNegative("p80Cost", s.p80Cost);
    assertFiniteNonNegative("p90Cost", s.p90Cost);
    assertFiniteNonNegative("p20Time", s.p20Time);
    assertFiniteNonNegative("p50Time", s.p50Time);
    assertFiniteNonNegative("p80Time", s.p80Time);
    assertFiniteNonNegative("p90Time", s.p90Time);
    assertFiniteNonNegative("meanCost", s.meanCost);
    assertFiniteNonNegative("meanTime", s.meanTime);
    assertFiniteNonNegative("minCost", s.minCost);
    assertFiniteNonNegative("maxCost", s.maxCost);
    assertFiniteNonNegative("minTime", s.minTime);
    assertFiniteNonNegative("maxTime", s.maxTime);
  });

  it("no NaN or negative when risks include zero impacts", () => {
    const risks: Risk[] = [
      makeRisk({ id: "z1", probability: 0.5, costImpact: 0, scheduleImpactDays: 0 }),
      makeRisk({ id: "z2", probability: 0.3, costImpact: 100_000, scheduleImpactDays: 10 }),
      makeRisk({ id: "z3", probability: 0.2, costImpact: 0, scheduleImpactDays: 5 }),
      makeRisk({ id: "z4", probability: 0.4, costImpact: 50_000, scheduleImpactDays: 0 }),
    ];
    const result = runMonteCarloSimulation({ risks, iterations: 500, seed: 456 });
    const s = result.summary;

    assertFiniteNonNegative("p20Cost", s.p20Cost);
    assertFiniteNonNegative("p50Cost", s.p50Cost);
    assertFiniteNonNegative("p80Cost", s.p80Cost);
    assertFiniteNonNegative("p90Cost", s.p90Cost);
    assertFiniteNonNegative("p20Time", s.p20Time);
    assertFiniteNonNegative("p50Time", s.p50Time);
    assertFiniteNonNegative("p80Time", s.p80Time);
    assertFiniteNonNegative("p90Time", s.p90Time);
    assertFiniteNonNegative("meanCost", s.meanCost);
    assertFiniteNonNegative("meanTime", s.meanTime);
    assertFiniteNonNegative("minCost", s.minCost);
    assertFiniteNonNegative("maxCost", s.maxCost);
    assertFiniteNonNegative("minTime", s.minTime);
    assertFiniteNonNegative("maxTime", s.maxTime);
  });

  it("zero risks does not crash and returns zeroed summary", () => {
    const result = runMonteCarloSimulation({ risks: [], iterations: 200, seed: 1 });
    const s = result.summary;

    assertFiniteNonNegative("p20Cost", s.p20Cost);
    assertFiniteNonNegative("p50Cost", s.p50Cost);
    assertFiniteNonNegative("p80Cost", s.p80Cost);
    assertFiniteNonNegative("p90Cost", s.p90Cost);
    assertFiniteNonNegative("p20Time", s.p20Time);
    assertFiniteNonNegative("p50Time", s.p50Time);
    assertFiniteNonNegative("p80Time", s.p80Time);
    assertFiniteNonNegative("p90Time", s.p90Time);
    assertFiniteNonNegative("meanCost", s.meanCost);
    assertFiniteNonNegative("meanTime", s.meanTime);
    assertFiniteNonNegative("minCost", s.minCost);
    assertFiniteNonNegative("maxCost", s.maxCost);
    assertFiniteNonNegative("minTime", s.minTime);
    assertFiniteNonNegative("maxTime", s.maxTime);

    assert(s.p20Cost <= s.p50Cost && s.p50Cost <= s.p80Cost && s.p80Cost <= s.p90Cost, "cost percentiles should be non-decreasing");
    assert(s.p20Time <= s.p50Time && s.p50Time <= s.p80Time && s.p80Time <= s.p90Time, "time percentiles should be non-decreasing");

    if (s.meanCost === 0 && s.meanTime === 0) {
      assert.strictEqual(s.p20Cost, 0);
      assert.strictEqual(s.p50Cost, 0);
      assert.strictEqual(s.p80Cost, 0);
      assert.strictEqual(s.p90Cost, 0);
      assert.strictEqual(s.meanCost, 0);
      assert.strictEqual(s.minCost, 0);
      assert.strictEqual(s.maxCost, 0);
      assert.strictEqual(s.p20Time, 0);
      assert.strictEqual(s.p50Time, 0);
      assert.strictEqual(s.p80Time, 0);
      assert.strictEqual(s.p90Time, 0);
      assert.strictEqual(s.meanTime, 0);
      assert.strictEqual(s.minTime, 0);
      assert.strictEqual(s.maxTime, 0);
    } else {
      assert.strictEqual(s.p20Cost, s.p50Cost, "baseline: cost p20 should equal p50");
      assert.strictEqual(s.p50Cost, s.p80Cost, "baseline: cost p50 should equal p80");
      assert.strictEqual(s.p80Cost, s.p90Cost, "baseline: cost p80 should equal p90");
      assert.strictEqual(s.minCost, s.maxCost, "baseline: cost min should equal max");
      assert.strictEqual(s.meanCost, s.minCost, "baseline: cost mean should equal min");
      assert.strictEqual(s.p20Time, s.p50Time, "baseline: time p20 should equal p50");
      assert.strictEqual(s.p50Time, s.p80Time, "baseline: time p50 should equal p80");
      assert.strictEqual(s.p80Time, s.p90Time, "baseline: time p80 should equal p90");
      assert.strictEqual(s.minTime, s.maxTime, "baseline: time min should equal max");
      assert.strictEqual(s.meanTime, s.minTime, "baseline: time mean should equal min");
    }
  });

  it("100 risks does not crash and returns valid summary", () => {
    const risks: Risk[] = [];
    for (let i = 1; i <= 100; i++) {
      risks.push(
        makeRisk({
          id: `stress-${i}`,
          probability: ((i % 10) + 1) / 10,
          costImpact: i * 1000,
          scheduleImpactDays: i % 30,
        })
      );
    }
    const result = runMonteCarloSimulation({ risks, iterations: 300, seed: 2 });
    const s = result.summary;

    assertFiniteNonNegative("p20Cost", s.p20Cost);
    assertFiniteNonNegative("p50Cost", s.p50Cost);
    assertFiniteNonNegative("p80Cost", s.p80Cost);
    assertFiniteNonNegative("p90Cost", s.p90Cost);
    assertFiniteNonNegative("p20Time", s.p20Time);
    assertFiniteNonNegative("p50Time", s.p50Time);
    assertFiniteNonNegative("p80Time", s.p80Time);
    assertFiniteNonNegative("p90Time", s.p90Time);
    assertFiniteNonNegative("meanCost", s.meanCost);
    assertFiniteNonNegative("meanTime", s.meanTime);
    assertFiniteNonNegative("minCost", s.minCost);
    assertFiniteNonNegative("maxCost", s.maxCost);
    assertFiniteNonNegative("minTime", s.minTime);
    assertFiniteNonNegative("maxTime", s.maxTime);

    assert(s.p20Cost <= s.p50Cost && s.p50Cost <= s.p80Cost && s.p80Cost <= s.p90Cost, "cost percentiles should be non-decreasing");
    assert(s.p20Time <= s.p50Time && s.p50Time <= s.p80Time && s.p80Time <= s.p90Time, "time percentiles should be non-decreasing");
  });
});
