import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const documentText = (body?.documentText || "").toString();

    if (!documentText.trim()) {
      return NextResponse.json({ error: "documentText is required" }, { status: 400 });
    }

    // Day0 stub: hardcoded risks so we can prove end-to-end wiring
    const risks = [
      {
        id: "r1",
        title: "Long lead switchgear may delay commissioning",
        category: "Programme",
        probability: 4,
        consequence: 5,
        inherentRating: 20,
        status: "Open" as const,
      },
      {
        id: "r2",
        title: "Escalation risk on structural steel pricing",
        category: "Cost",
        probability: 3,
        consequence: 4,
        inherentRating: 12,
        status: "Open" as const,
      },
      {
        id: "r3",
        title: "Authority approvals may extend up to 45 days",
        category: "Approvals",
        probability: 3,
        consequence: 3,
        inherentRating: 9,
        status: "Open" as const,
      },
    ];

    return NextResponse.json({ risks });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}