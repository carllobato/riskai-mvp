import { NextResponse } from "next/server";
import { getSimulationContextStatus } from "@/lib/getSimulationContext";

/**
 * GET: Cache-inspect endpoint for debugging.
 * Returns metadata only (riskCount, hasNeutralSnapshot, neutralP80, lastUpdatedAt, lastSource).
 */
export async function GET() {
  const status = getSimulationContextStatus();
  return NextResponse.json(
    {
      ok: true,
      riskCount: status.riskCount,
      hasNeutralSnapshot: status.hasNeutralSnapshot,
      neutralP80: status.neutralP80,
      lastUpdatedAt: status.lastUpdatedAt,
      lastSource: status.lastSource,
    },
    { status: 200 }
  );
}
