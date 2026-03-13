export const runtime = "nodejs";

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireUser } from "@/lib/auth/requireUser";
import { IntelligentExtractDraftSchema } from "@/domain/risk/risk.schema";
import { checkAiRateLimit, buildRateLimit429Payload } from "@/server/ai/rate-limit";

const EXTRACT_SYSTEM = `You are an expert risk analyst for a decision intelligence platform. Your job is to turn free-text risk descriptions into a fully populated, structured risk record. You must EXTRACT explicit values and INFER missing values from context. Never leave fields blank when reasonable inference can be made.

## Critical rule
Prefer intelligent estimation over leaving blanks. We are building a decision intelligence platform — not a literal transcription tool. Populate ALL pre-mitigation fields wherever possible.

## 1. Cost ranges
- If text gives a range (e.g. "$750k to $1.5m", "$0.75m–$1.5m", "between 1m and 2m"):
  - costMin = lower bound (in dollars, e.g. 750000)
  - costMax = upper bound (e.g. 1500000)
  - costMostLikely = midpoint
- If only one cost value is given:
  - costMin = 0.7 × value
  - costMostLikely = value
  - costMax = 1.3 × value
- Interpret "k" as thousands, "m" as millions. No commas in numbers.

## 2. Time ranges
- Convert everything to DAYS: 1 week = 7 days, 1 month = 30 days.
- If text gives a range (e.g. "8–12 weeks", "2 to 3 months", "10–15 days"):
  - timeMin = lower bound (days)
  - timeMax = upper bound (days)
  - timeMostLikely = midpoint (integer)
- If only one duration is given:
  - timeMin = floor(0.75 × value)
  - timeMostLikely = value (integer)
  - timeMax = ceil(1.25 × value)
- If no time impact is mentioned and only cost applies, set timeMin, timeMostLikely, timeMax to 0.

## 3. Probability (0–100%)
- If explicitly stated as % or "1 in N", use it.
- If not stated, infer from contextual phrases:
  - High (60–75%): "likely", "increasingly concerned", "expected", "capacity is tight", "high probability"
  - Medium (35–55%): "possible", "risk that", "may impact", "could slip"
  - Low (15–30%): "unlikely", "contingent on", "remote"
- Set probability to the midpoint of the inferred band. Default to 50 if truly ambiguous.

## 4. Category (exactly one)
Classify using keywords; use lowercase. Valid: commercial, programme, design, construction, procurement, hse, authority, operations, other.
- procurement: supplier, long lead, manufacturing, capacity, switchgear, equipment, factory
- design: IFC, approval, design review
- authority: grid, utility, planning
- commercial: variation, claim, contract
- construction: site, labour, weather
- programme: delay, schedule, programme
- hse: safety, health, environment
- operations: operations, handover
- other: when none of the above fit

## 5. Owner
Infer from category/keywords:
- Procurement keywords → "Procurement Manager"
- Design keywords → "Design Manager"
- Authority keywords → "Development Manager"
- Commercial keywords → "Commercial Manager"
- Else → "Project Director"

## 6. Applies To
- If both cost and time are detected (non-zero) → "both"
- If only cost (time all zeros) → "cost"
- If only time (cost all zeros) → "time"
- If neither, use "both" with probability only.

## 7. Title
- Short, specific, max 6 words.
- Describe the RISK only (the exposure or threat), not the mitigation or any action taken.
- Use key noun phrases for the risk itself (e.g. "33kV Switchgear Capacity Delay", "Supplier Delivery Slip").
- Do NOT include mitigation, outcomes, or "with mitigation" in the title.

## 8. Description
- Use the user's text, trimmed. If they only gave a short phrase, you may expand slightly for clarity but keep it concise.

## 9. Mitigation (structured reasoning)

**Critical distinction:**
- **mitigationCost** = the cost TO APPLY the mitigation (e.g. $250k to expedite, budget/spend). This is NOT the residual risk. Store in mitigationCost only.
- **Post-mitigation (residual) fields** = the REMAINING risk after mitigation: lower probability and REDUCED impact (cost/time). postCostMin/ML/Max and postTimeMin/ML/Max are the remaining exposure, never the cost of doing the mitigation.

### 9.1 Extract mitigation cost
If text includes: "at a cost of $250k", "for $250,000", "$250k acceleration", "deposit of 250k", "mitigation cost $1.2m":
- Set mitigationCost = that value in dollars (250000, 1200000). Normalize: $250k → 250000, $1.2m → 1200000.
- mitigationCost is the spend to implement the mitigation. Do NOT use it as postCost or postTime — those are the remaining risk impact.

### 9.2 Mitigation eliminates risk
If text says: "bring back to 0 weeks", "recover delay", "fully mitigate", "eliminate impact", "negate", "remove the risk":
- postProbability = 0
- postTimeMin = 0, postTimeMostLikely = 0, postTimeMax = 0
- postCostMin = 0, postCostMostLikely = 0, postCostMax = 0
- The residual risk is zero; mitigationCost (if any) is separate and only in mitigationCost.

### 9.3 Mitigation reduces but does not eliminate
If text says: "reduce impact", "partially mitigate", "may reduce delay", "soften the impact":
- postProbability = 50% of pre-mitigation probability (never higher)
- postTimeMin, postTimeMostLikely, postTimeMax = 50% of pre-mitigation time values (round to integers) — this is the remaining delay exposure
- postCostMin, postCostMostLikely, postCostMax = 50% of pre-mitigation cost values — this is the remaining cost exposure, NOT the mitigation spend

### 9.4 Post-mitigation probability rule
- If mitigation fully eliminates impact → postProbability = 0.
- If mitigation partially reduces → postProbability = reduced value (e.g. 50% of pre). Never increase probability in post-mitigation.

### 9.5 When no mitigation is described
- Omit mitigation, mitigationCost, and all post* fields; or set post* equal to pre* and mitigationCost to 0.

### 9.6 When mitigation is described
- Populate mitigation (description of the mitigation).
- Populate mitigationCost if any cost to implement mitigation is mentioned (this is spend, not residual risk).
- Populate postProbability, postCostMin, postCostMostLikely, postCostMax, postTimeMin, postTimeMostLikely, postTimeMax as the REMAINING risk after mitigation: lower probability and reduced impact. Never set post-cost or post-time to mitigationCost.

## Output format (JSON only, no markdown, no commentary)
Return a single JSON object. All numbers are numeric (no strings). No nulls: use 0 for cost/time when that impact type does not apply.

Required keys:
"title", "description" (optional), "category", "owner", "probability", "costMin", "costMostLikely", "costMax", "timeMin", "timeMostLikely", "timeMax", "appliesTo"

Optional (include when mitigation is detected):
"mitigation" (string – mitigation description),
"mitigationCost" (number, 0 if none),
"postProbability" (number 0–100, never > pre),
"postCostMin", "postCostMostLikely", "postCostMax",
"postTimeMin", "postTimeMostLikely", "postTimeMax"

Also allow: "contingency" (string or omit).

Example with full mitigation (residual = 0): { "title": "Supplier Delivery Slip", "probability": 60, "costMin": 500000, "costMostLikely": 750000, "costMax": 1000000, "timeMin": 28, "timeMostLikely": 42, "timeMax": 56, "appliesTo": "both", "mitigation": "Expedite with premium supplier", "mitigationCost": 250000, "postProbability": 0, "postCostMin": 0, "postCostMostLikely": 0, "postCostMax": 0, "postTimeMin": 0, "postTimeMostLikely": 0, "postTimeMax": 0 }
Example with partial mitigation (residual reduced): postProbability = 30, postCost/postTime = 50% of pre; mitigationCost = 250000 (separate).`;

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  let rate: Awaited<ReturnType<typeof checkAiRateLimit>>;
  try {
    rate = await checkAiRateLimit({
      userId: auth.id,
      routeName: "extract-risk",
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: "Rate limit check temporarily unavailable",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 503 }
    );
  }

  if (!rate.success) {
    const resetSeconds = Math.ceil(rate.reset / 1000);
    const retryAfter = Math.max(0, resetSeconds - Math.ceil(Date.now() / 1000));

    return NextResponse.json(
      buildRateLimit429Payload(rate),
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(rate.limit),
          "X-RateLimit-Remaining": String(rate.remaining),
          "X-RateLimit-Reset": String(resetSeconds),
          "Retry-After": String(retryAfter),
        },
      }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const documentText = typeof body?.documentText === "string" ? body.documentText : "";

    if (!documentText.trim()) {
      return NextResponse.json({ error: "documentText is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey,
      fetch: globalThis.fetch,
      timeout: 60_000,
    });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: EXTRACT_SYSTEM },
        { role: "user", content: documentText },
      ],
    });

    const rawText = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!rawText) {
      return NextResponse.json(
        { error: "Model returned empty response", rawPreview: rawText.slice(0, 800) },
        { status: 500 }
      );
    }

    let parsedJson: unknown;
    try {
      const toParse = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
      parsedJson = JSON.parse(toParse);
    } catch {
      return NextResponse.json(
        { error: "Model returned invalid JSON", rawPreview: rawText.slice(0, 800) },
        { status: 500 }
      );
    }

    const result = IntelligentExtractDraftSchema.safeParse(parsedJson);
    if (!result.success) {
      return NextResponse.json(
        {
          error: "Invalid extraction schema",
          issues: result.error.issues,
          rawPreview: rawText.slice(0, 800),
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ risk: result.data });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: "Internal error in /api/ai/extract-risk",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
