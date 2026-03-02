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
});
