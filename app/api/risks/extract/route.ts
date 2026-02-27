export const runtime = "nodejs";

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { RiskDraftResponseSchema } from "@/domain/risk/risk.schema";

const EXTRACT_SYSTEM = `You are a risk analyst. Extract risk items from the user's document.

Return ONLY a single JSON object, no markdown, no commentary. Shape:
{
  "risks": [
    {
      "title": "string (short risk title)",
      "category": "one of: commercial, programme, design, construction, procurement, hse, authority, operations, other",
      "probability": integer 1-5,
      "consequence": integer 1-5,
      "owner": "optional string",
      "mitigation": "optional string",
      "status": "optional one of: open, monitoring, closed"
    }
  ]
}

Do NOT include: id, inherentRating, residualRating, score, level, timestamps, or any other fields.`;

export async function POST(req: Request) {
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
        { error: "Model returned invalid JSON", rawPreview: rawText.slice(0, 800) },
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

    const result = RiskDraftResponseSchema.safeParse(parsedJson);
    if (!result.success) {
      return NextResponse.json(
        {
          error: "Invalid draft schema",
          issues: result.error.issues,
          rawPreview: rawText.slice(0, 800),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(result.data);
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: "Internal error in /api/risks/extract",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
