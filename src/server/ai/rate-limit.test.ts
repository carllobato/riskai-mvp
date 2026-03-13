import { describe, it } from "node:test";
import assert from "node:assert";
import {
  buildRateLimit429Payload,
  type AiRateLimitResult,
  type RateLimit429Payload,
} from "./rate-limit";

describe("rate-limit", () => {
  describe("buildRateLimit429Payload", () => {
    it("returns the expected 429 JSON shape with correct types", () => {
      const rate: AiRateLimitResult = {
        success: false,
        limit: 10,
        remaining: 0,
        reset: 1736200000000,
      };
      const payload = buildRateLimit429Payload(rate);

      assert.strictEqual(payload.error, "Rate limit exceeded");
      assert.strictEqual(payload.code, "RATE_LIMITED");
      assert.strictEqual(payload.limit, 10);
      assert.strictEqual(payload.remaining, 0);
      assert.strictEqual(payload.reset, 1736200000000);

      const typed: RateLimit429Payload = payload;
      assert.strictEqual(typed.code, "RATE_LIMITED");
    });

    it("includes all required keys for 429 response contract", () => {
      const payload = buildRateLimit429Payload({
        limit: 2,
        remaining: 0,
        reset: 1000000,
      });

      assert.ok("error" in payload && typeof payload.error === "string");
      assert.ok("code" in payload && payload.code === "RATE_LIMITED");
      assert.ok("limit" in payload && typeof payload.limit === "number");
      assert.ok("remaining" in payload && typeof payload.remaining === "number");
      assert.ok("reset" in payload && typeof payload.reset === "number");
      assert.strictEqual(Object.keys(payload).length, 5);
    });
  });
});
