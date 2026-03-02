/**
 * Regression: formatDurationDays(10) must be "10 days" everywhere (no 10 → "1 week").
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { formatDurationDays } from "./formatDuration";

describe("formatDurationDays", () => {
  it("10 days displays as '10 days' (not 1 week)", () => {
    assert.strictEqual(formatDurationDays(10), "10 days");
  });

  it("1 day singular", () => {
    assert.strictEqual(formatDurationDays(1), "1 day");
  });

  it("0 days", () => {
    assert.strictEqual(formatDurationDays(0), "0 days");
  });

  it("14+ days shows weeks with one decimal", () => {
    assert.strictEqual(formatDurationDays(14), "2.0 weeks");
    assert.strictEqual(formatDurationDays(7), "7 days"); // under 14
  });

  it("undefined/NaN returns dash", () => {
    assert.strictEqual(formatDurationDays(undefined), "—");
    assert.strictEqual(formatDurationDays(NaN), "—");
  });
});
