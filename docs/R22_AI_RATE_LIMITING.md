## R22: AI rate limiting

This document describes the basic rate limiting applied to AI-powered API routes.

### Covered routes

The following authenticated AI endpoints are rate limited:

- `/api/ai/extract-risk`
- `/api/ai/risk-merge-review`

The rate limit is applied **per authenticated user** and **per endpoint**.

### Policy

- **Limit**: 10 requests
- **Window**: 10 minutes
- **Key**: `userId:endpointName`

Each user gets an independent budget per AI endpoint. Hitting the limit on one endpoint does not affect other endpoints.

### Response on 429

When the limit is exceeded, the API returns HTTP **429** with a small JSON payload:

```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMITED",
  "limit": 10,
  "remaining": 0,
  "reset": 1736200000000
}
```

- `limit`: maximum number of requests allowed in the window.
- `remaining`: requests left in the current window (0 when blocked).
- `reset`: Unix timestamp (milliseconds) when the limit window resets.

Additionally, the following headers are set on 429 responses:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset` (seconds since Unix epoch)
- `Retry-After` (seconds until the window resets)

### Implementation details

- Backend: **Upstash Redis** + `@upstash/ratelimit`
- Helper: `src/server/ai/rate-limit.ts`
- Usage in routes:
  - Auth is enforced first.
  - After auth, `checkAiRateLimit({ userId, routeName })` is called.
  - If blocked, the route returns 429 using `buildRateLimit429Payload(rate)` and the headers above.

### Required environment variables

The rate limiter requires an Upstash Redis instance configured via environment variables:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

These must be set in:

- Local `.env.local`
- Vercel project environment settings (Production, and Preview if desired)

Optional (for local verification only):

- `AI_RATE_LIMIT_MAX` – override max requests per window (default: 10).
- `AI_RATE_LIMIT_WINDOW_SEC` – override window in seconds (default: 600).

### Optional: local verification (temporary low limit)

To trigger 429 quickly during manual testing without sending 10 requests, you can temporarily override the limit in `.env.local`:

```env
AI_RATE_LIMIT_MAX=2
AI_RATE_LIMIT_WINDOW_SEC=60
```

- **Limit**: 2 requests per 60 seconds per user per endpoint.
- **Revert**: Remove or comment out these two variables and restart the dev server. Production defaults (10 requests / 10 minutes) will apply.

Do not set these in Vercel production; use only for local verification.

### Manual verification checklist

Use this to confirm R22 behavior:

- [ ] **Unauthenticated request** → HTTP 401 with `{ "error": "Unauthorized" }` (not 429).
- [ ] **Authenticated request within limit** → HTTP 200 (or 4xx for validation) and normal AI response; no rate limit headers required on success.
- [ ] **Authenticated request over limit** → HTTP 429 with JSON payload `error`, `code: "RATE_LIMITED"`, `limit`, `remaining`, `reset` and headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`.
- [ ] **Non-AI routes** (e.g. `/api/projects`, `/api/simulation-context`) → Unaffected; no rate limiting applied.

### Curl examples

Base URL: `http://localhost:3000` (or your deployment URL). Replace `YOUR_COOKIE_HEADER` with the session cookie(s) your app sets after login (e.g. `Cookie: sb-...=...` from Supabase).

**1. Unauthenticated request → expect 401**

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/ai/extract-risk \
  -H "Content-Type: application/json" \
  -d '{"documentText":"Supplier delay risk"}'
# Expected: 401
```

**2. Authenticated request within limit → expect 200 (or 4xx if validation fails)**

```bash
curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/ai/extract-risk \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_COOKIE_HEADER" \
  -d '{"documentText":"Supplier delay risk"}'
# Expected: 200 and JSON with "risk", or 400/500 for validation/errors
```

**3. Authenticated request over limit → expect 429**

After sending more than the limit (e.g. 10, or 2 if using `AI_RATE_LIMIT_MAX=2`) in the window:

```bash
curl -s -i -X POST http://localhost:3000/api/ai/extract-risk \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_COOKIE_HEADER" \
  -d '{"documentText":"Another risk"}'
# Expected: HTTP/1.1 429, body with "code":"RATE_LIMITED", headers X-RateLimit-*, Retry-After
```

### How to test locally

1. Create an Upstash Redis database from the Upstash console.
2. Copy the REST URL and REST token into `.env.local`:

   ```env
   UPSTASH_REDIS_REST_URL=...
   UPSTASH_REDIS_REST_TOKEN=...
   ```

3. Restart the dev server: `npm run dev`.
4. Authenticate in the app so that `requireUser` succeeds.
5. Call one of the AI endpoints (e.g. `/api/ai/extract-risk`) more than 10 times within 10 minutes.
6. Observe that responses switch from 200/4xx to 429 with the JSON payload and rate limit headers.

### How to test on Vercel

1. In the Vercel project settings, add:

   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

   (values must match `.env.local`, no quotes).

2. Redeploy the project.
3. Log in to the production deployment.
4. Hit the AI endpoints from a single user session more than 10 times within 10 minutes.
5. Confirm that the API starts returning 429 with the documented payload and headers.

### Unit tests

The 429 response payload shape is built by `buildRateLimit429Payload()` in `src/server/ai/rate-limit.ts` and covered by unit tests in `src/server/ai/rate-limit.test.ts`. Run with:

```bash
npx tsx --test src/server/ai/rate-limit.test.ts
```

### Verification summary (R22)

| Check | Result |
|-------|--------|
| Rate limit applied only after successful auth | Yes: `requireUser()` first, then `checkAiRateLimit()` in both AI routes. |
| Unauthenticated requests | Return 401 (from `requireUser`), never 429. |
| Authenticated within limit | Request proceeds; no rate limit applied to non-AI routes. |
| Over limit | 429 with `buildRateLimit429Payload` shape and rate limit headers. |
| Non-AI routes | Unaffected; only `/api/ai/extract-risk` and `/api/ai/risk-merge-review` use the helper. |
| Typing / lint | No `any`; touched files lint-clean. |
| Edge case | If Upstash env vars are missing, the rate-limit module may throw at first request; set vars for production and local testing. |

