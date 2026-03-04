export const runtime = "nodejs";

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireUser } from "@/lib/auth/requireUser";
import { assertProjectAccess } from "@/lib/auth/assertProjectAccess";
import { RiskSchema } from "@/domain/risk/risk.schema";
import type { Risk } from "@/domain/risk/risk.schema";
import { RiskMergeReviewResponseSchema } from "@/domain/risk/risk-merge.types";

const MIN_MERGE_CONFIDENCE = 0.65;

const MERGE_REVIEW_SYSTEM = `You are a senior quantitative risk analyst reviewing a project or enterprise risk register.
Your task is to:
Identify materially similar risks
Classify the relationship
Propose a mathematically defensible merged draft
You must prioritise quantitative integrity over aggressive consolidation.

1. Similarity Assessment (Root Cause Based)
Only consider risks similar if they share:
• The same underlying root cause
• The same exposure mechanism (how cost, time, or performance is impacted)
• The same affected phase, discipline, or business area
Do NOT cluster risks based on generic language (e.g., "delay", "increase", "issue").
When in doubt → do_not_merge.

2. Merge Classification (REQUIRED)
Each potential cluster must be classified as ONE of:
"duplicate"
"overlap"
"parallel"
"do_not_merge"
Definitions:
duplicate
Same risk expressed more than once with minimal scope difference.
Should clearly represent a single exposure.
overlap
Risks partially overlap but merging into one broader risk is defensible without distorting exposure.
parallel
Risks share a common driver but represent separate cost exposures that can occur simultaneously.
Example pattern:
• Different disciplines
• Different workstreams
• Same market or systemic condition
do_not_merge
Risks are materially distinct and must remain separate.
If merging reduces clarity, traceability, or quantitative defensibility → do_not_merge.

3. Quantitative Merge Rules (CRITICAL)
You are influencing simulation inputs.
You must NOT inflate or dilute exposure.
Follow the rules below exactly.
A) duplicate
Probability:
• Use the higher value (conservative)
Cost:
• DO NOT sum
• Use the higher ML value
• Min/Max should align proportionally
Time:
• DO NOT sum
• Use the higher ML value
B) overlap
Probability:
• Use the higher value or slightly conservative refinement
Cost:
• Do NOT mechanically sum
• Choose a defensible consolidated ML
• Only increase beyond highest ML if clearly justified by scope
Time:
• Use greater ML (not sum)
C) parallel (NEW TYPE)
This applies when:
• Risks represent independent cost exposures
• They can occur together
• Schedule delay likely overlaps
Probability:
• Use average of source probabilities
• If equal → retain that value
Cost:
• Sum ML values
• Sum Min and Max proportionally
Time:
• Use the greater ML value (not sum)
• Use greater Min/Max accordingly
Never sum time unless explicitly sequential (rare).
D) do_not_merge
Do not output mergedDraft.

4. Numeric Population Requirements
If source risks contain numeric data:
You MUST populate:
• preMitigationProbabilityPct
• preMitigationCostML (if cost exists)
• preMitigationTimeML (if time exists)
If post-mitigation data exists, apply same logic.
Never leave required numeric fields blank when source values exist.

5. AppliesTo Logic
Set:
"time" → only time values present
"cost" → only cost values present
"both" → both present

6. Governance Safeguards
The mergedDraft must:
• Represent a single coherent risk statement
• Preserve audit traceability
• Not introduce new drivers
• Not broaden scope beyond source risks
• Remain defensible in governance review
If unsure → do_not_merge.

7. Confidence Scoring
Provide confidence between 0–1.
Guidance:
0.90–1.00 → clear duplicate
0.80–0.89 → strong duplicate
0.70–0.79 → defensible overlap
0.65–0.75 → parallel relationship
<0.65 → weak similarity
Only output clusters where mergeType ≠ do_not_merge.

8. Output Format (STRICT)
Return ONLY valid JSON.
No markdown.
No commentary.
No explanation text.
Shape:
{
  "clusters": [
    {
      "clusterId": "C1",
      "confidence": number,
      "mergeType": "duplicate" | "overlap" | "parallel" | "do_not_merge",
      "rationale": "Short explanation focused on root cause and exposure mechanism",
      "riskIds": ["id1", "id2"],
      "mergedDraft": {
        "title": "Clear professional title",
        "description": "Concise description of root cause and impact pathway",
        "category": "commercial | programme | design | construction | procurement | hse | authority | operations | other",
        "status": "optional",
        "owner": "optional",
        "mitigation": "optional",
        "contingency": "optional",
        "appliesTo": "time | cost | both",
        "preMitigationProbabilityPct": number,
        "preMitigationCostMin": optional number,
        "preMitigationCostML": number,
        "preMitigationCostMax": optional number,
        "preMitigationTimeMin": optional integer,
        "preMitigationTimeML": integer,
        "preMitigationTimeMax": optional integer,
        "mitigationCost": optional number,
        "postMitigationProbabilityPct": optional number,
        "postMitigationCostMin": optional number,
        "postMitigationCostML": optional number,
        "postMitigationCostMax": optional number,
        "postMitigationTimeMin": optional integer,
        "postMitigationTimeML": optional integer,
        "postMitigationTimeMax": optional integer
      }
    }
  ]
}`;

function buildUserPayload(risks: Risk[]): string {
  const payload = risks.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description ?? "",
    category: r.category,
    owner: r.owner ?? "",
    mitigation: r.mitigation ?? "",
    appliesTo: r.appliesTo ?? "both",
    preMitigationProbabilityPct: r.preMitigationProbabilityPct,
    preMitigationCostMin: r.preMitigationCostMin,
    preMitigationCostML: r.preMitigationCostML,
    preMitigationCostMax: r.preMitigationCostMax,
    preMitigationTimeMin: r.preMitigationTimeMin,
    preMitigationTimeML: r.preMitigationTimeML,
    preMitigationTimeMax: r.preMitigationTimeMax,
    postMitigationProbabilityPct: r.postMitigationProbabilityPct,
    postMitigationCostMin: r.postMitigationCostMin,
    postMitigationCostML: r.postMitigationCostML,
    postMitigationCostMax: r.postMitigationCostMax,
    postMitigationTimeMin: r.postMitigationTimeMin,
    postMitigationTimeML: r.postMitigationTimeML,
    postMitigationTimeMax: r.postMitigationTimeMax,
    mitigationCost: r.mitigationCost,
  }));
  return JSON.stringify(payload, null, 2);
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const start = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const projectId = typeof body?.projectId === "string" ? body.projectId : "";
    const rawRisks = Array.isArray(body?.risks) ? body.risks : [];

    if (!projectId.trim()) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const access = await assertProjectAccess(projectId);
    if (access.error === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (access.error === "forbidden") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const risks: Risk[] = [];
    for (const r of rawRisks) {
      const parsed = RiskSchema.safeParse(r);
      if (parsed.success) risks.push(parsed.data);
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
      timeout: 90_000,
    });

    const userContent = `Project ID: ${projectId}

For each cluster you output, the mergedDraft MUST include refined pre- and post-mitigation values: probability (%), cost most likely ($), and time most likely (days), derived from the source risks in that cluster. Do not omit these when the source risks have them.

Risks (JSON):
${buildUserPayload(risks)}`;
    const reqPayloadSize = new Blob([userContent]).size;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: MERGE_REVIEW_SYSTEM },
        { role: "user", content: userContent },
      ],
    });

    const rawText = completion.choices[0]?.message?.content?.trim() ?? "";
    const resPayloadSize = new Blob([rawText]).size;

    if (process.env.NODE_ENV === "development") {
      console.info("[risk-merge-review] request payload size:", reqPayloadSize, "response size:", resPayloadSize, "ms:", Date.now() - start);
    }

    if (!rawText) {
      return NextResponse.json(
        {
          error: "Model returned no content",
          rawPreview: rawText.slice(0, 800),
        },
        { status: 500 }
      );
    }

    let parsedJson: unknown;
    try {
      const toParse = rawText
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "");
      parsedJson = JSON.parse(toParse);
    } catch {
      return NextResponse.json(
        {
          error: "Model returned invalid JSON",
          rawPreview: rawText.slice(0, 800),
        },
        { status: 500 }
      );
    }

    const parseResult = RiskMergeReviewResponseSchema.safeParse(parsedJson);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      if (process.env.NODE_ENV === "development") {
        console.warn("[risk-merge-review] schema validation failed", issues, "raw preview:", rawText.slice(0, 500));
      }
      return NextResponse.json(
        {
          error: "Invalid merge review schema",
          details: issues.slice(0, 10),
          rawPreview: rawText.slice(0, 800),
        },
        { status: 400 }
      );
    }

    const filtered = parseResult.data.clusters.filter(
      (c): c is typeof c & { mergedDraft: NonNullable<typeof c.mergedDraft> } =>
        c.mergeType !== "do_not_merge" &&
        c.confidence >= MIN_MERGE_CONFIDENCE &&
        c.mergedDraft != null
    );

    return NextResponse.json({ clusters: filtered });
  } catch (err: unknown) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[risk-merge-review] error", err);
    }
    return NextResponse.json(
      {
        error: "Internal error in /api/ai/risk-merge-review",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
