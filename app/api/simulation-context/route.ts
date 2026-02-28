import { NextResponse } from "next/server";
import type { SimulationSnapshot } from "@/domain/simulation/simulation.types";
import { setSimulationContext } from "@/lib/getSimulationContext";
import { dlog } from "@/lib/debug";

function isValidSnapshot(snapshot: unknown): snapshot is SimulationSnapshot {
  if (snapshot == null || typeof snapshot !== "object") return false;
  const s = snapshot as Record<string, unknown>;
  return (
    typeof s.p80Cost === "number" &&
    Number.isFinite(s.p80Cost) &&
    Array.isArray(s.risks)
  );
}

/** Same path as getNeutralP80Cost (inline for debug). */
function extractNeutralP80ForDebug(snapshot: unknown): number | null {
  if (snapshot == null || typeof snapshot !== "object") return null;
  const s = snapshot as Record<string, unknown>;
  const p80 = s.p80Cost;
  if (typeof p80 === "number" && Number.isFinite(p80)) return p80;
  return null;
}

/**
 * POST: Sync simulation context from client (same data as Outputs page).
 * Body: { risks: unknown[], neutralSnapshot: SimulationSnapshot | null }
 * Called by client when risks or simulation state changes so mitigation API can load internally.
 */
export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (body == null || typeof body !== "object") {
      return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
    }
    const b = body as Record<string, unknown>;
    const risks = Array.isArray(b.risks) ? b.risks : [];
    const neutralSnapshot = b.neutralSnapshot != null && isValidSnapshot(b.neutralSnapshot) ? b.neutralSnapshot : null;
    const riskCount = risks.length;
    const hasSnapshot = !!neutralSnapshot;
    const neutralP80 = extractNeutralP80ForDebug(neutralSnapshot);
    dlog("[api/simulation-context] recv", { riskCount, hasSnapshot, neutralP80 });
    setSimulationContext({ risks, neutralSnapshot }, "api/simulation-context");
    return NextResponse.json({ ok: true, riskCount, hasSnapshot, neutralP80 }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
