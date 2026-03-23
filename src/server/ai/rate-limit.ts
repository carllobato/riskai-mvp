import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

export type AiRateLimitResult =
  | {
      success: true;
      limit: number;
      remaining: number;
      reset: number;
    }
  | {
      success: false;
      limit: number;
      remaining: number;
      reset: number;
    };

/** 429 response body when rate limit is exceeded. */
export type RateLimit429Payload = {
  error: string;
  code: "RATE_LIMITED";
  limit: number;
  remaining: number;
  reset: number;
};

/** Build the JSON payload for 429 responses. Used by AI route handlers and tests. */
export function buildRateLimit429Payload(rate: {
  limit: number;
  remaining: number;
  reset: number;
}): RateLimit429Payload {
  return {
    error: "Rate limit exceeded",
    code: "RATE_LIMITED",
    limit: rate.limit,
    remaining: rate.remaining,
    reset: rate.reset,
  };
}

const redis = Redis.fromEnv();

const safeLimit = env.AI_RATE_LIMIT_MAX ?? 10;
const safeWindow = env.AI_RATE_LIMIT_WINDOW_SEC ?? 600;

const aiRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(safeLimit, `${safeWindow} s`),
  prefix: "ratelimit:ai",
});

export async function checkAiRateLimit(params: {
  userId: string;
  routeName: string;
}): Promise<AiRateLimitResult> {
  const { userId, routeName } = params;
  const key = `${userId}:${routeName}`;

  const result = await aiRatelimit.limit(key);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

