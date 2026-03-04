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
});
