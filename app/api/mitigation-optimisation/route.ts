/**
 * Mitigation optimisation API: loads risks + neutral snapshot via getSimulationContext() (no body).
 *
 * Verification steps (debug):
 * 1. Open GET /api/simulation-context/status
 * 2. Run simulation in UI
 * 3. Refresh status — expect hasNeutralSnapshot=true and neutralP80>0
 * 4. Hit GET /api/mitigation-optimisation — expect hasNeutralSnapshot=true
 */
import { NextResponse } from "next/server";
import { getSimulationContext, getSimulationContextStatus } from "@/lib/getSimulationContext";
import { computeMitigationOptimisation, getNeutralP80Cost } from "@/engine/mitigationOptimisation";
import type { BenefitMetric } from "@/engine/mitigationOptimisation";
import { dlog, dwarn, isDev } from "@/lib/debug";

/** POST body: only optional spendSteps, budgetCap, benefitMetric. Risks and snapshot loaded internally. */
type Body = {
  spendSteps?: unknown;
  budgetCap?: unknown;
  benefitMetric?: unknown;
};

function validateSpendSteps(value: unknown): { ok: true; steps: number[] } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, steps: [0, 25_000, 50_000, 100_000, 200_000] };
  if (!Array.isArray(value)) return { ok: false, error: "spendSteps must be an array" };
  if (value.length < 2) return { ok: false, error: "spendSteps must have at least 2 elements" };
  const steps: number[] = [];
  for (let i = 0; i < value.length; i++) {
    const n = Number(value[i]);
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: `spendSteps[${i}] must be a non-negative number` };
    steps.push(n);
  }
  const sorted = [...steps].sort((a, b) => a - b);
  if (steps.some((v, i) => v !== sorted[i])) return { ok: false, error: "spendSteps must be sorted ascending" };
  if (sorted[0] !== 0) return { ok: false, error: "spendSteps must include 0" };
  return { ok: true, steps };
}

function validateBudgetCap(value: unknown): { ok: true; cap?: number } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true };
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return { ok: false, error: "budgetCap must be a non-negative number" };
  return { ok: true, cap: n };
}

function validateBenefitMetric(value: unknown): BenefitMetric | null {
  if (value === "p80CostReduction") return "p80CostReduction";
  if (value === undefined || value === null) return "p80CostReduction";
  return null;
}

function devHeaders(status: ReturnType<typeof getSimulationContextStatus>) {
  if (!isDev()) return undefined;
  const h: Record<string, string> = {
    "x-simctx-risk-count": String(status.riskCount),
    "x-simctx-has-neutral": String(status.hasNeutralSnapshot),
    "x-simctx-neutral-p80": status.neutralP80 != null ? String(status.neutralP80) : "",
    "x-simctx-last-updated": status.lastUpdatedAt != null ? String(status.lastUpdatedAt) : "",
  };
  return h;
}

export async function POST(req: Request) {
  try {
    dlog("[api/mit-opt] POST called");
    let body: Body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (body == null || typeof body !== "object") {
      return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
    }

    const spendResult = validateSpendSteps(body.spendSteps);
    if (!spendResult.ok) {
      return NextResponse.json({ error: spendResult.error }, { status: 400 });
    }

    const budgetResult = validateBudgetCap(body.budgetCap);
    if (!budgetResult.ok) {
      return NextResponse.json({ error: budgetResult.error }, { status: 400 });
    }

    const benefitMetric = validateBenefitMetric(body.benefitMetric);
    if (benefitMetric === null) {
      return NextResponse.json({ error: "benefitMetric must be \"p80CostReduction\" or omitted" }, { status: 400 });
    }

    const { risks, neutralSnapshot } = await getSimulationContext();
    const status = getSimulationContextStatus();
    dlog("[api/mit-opt] ctx", {
      riskCount: status.riskCount,
      hasSnapshot: status.hasNeutralSnapshot,
      neutralP80: status.neutralP80,
      lastUpdatedAt: status.lastUpdatedAt,
    });

    if (!neutralSnapshot) {
      dwarn("[api/mit-opt] missing neutral snapshot - run simulation first");
      return NextResponse.json(
        { error: "Neutral snapshot not available. Run simulation first." },
        { status: 400, headers: devHeaders(status) }
      );
    }

    const result = computeMitigationOptimisation({
      risks: risks as Parameters<typeof computeMitigationOptimisation>[0]["risks"],
      neutralSnapshot,
      spendSteps: spendResult.steps,
      benefitMetric,
      budgetCap: budgetResult.cap,
    });

    dlog("[api/mit-opt] ok", {
      neutralP80: result.baseline.neutralP80,
      rankedCount: result.ranked.length,
    });

    const headers = devHeaders(getSimulationContextStatus());
    return NextResponse.json(
      { requestId: crypto.randomUUID(), ...result },
      { status: 200, headers }
    );
  } catch {
    return NextResponse.json(
      { error: "Unexpected error during mitigation optimisation" },
      { status: 500 }
    );
  }
}

/** DEV self-test: GET uses same internal loader as POST (no Monte Carlo). */
export async function GET() {
  try {
    dlog("[api/mit-opt] GET called");
    const { risks, neutralSnapshot } = await getSimulationContext();
    const status = getSimulationContextStatus();
    dlog("[api/mit-opt] ctx", {
      riskCount: status.riskCount,
      hasSnapshot: status.hasNeutralSnapshot,
      neutralP80: status.neutralP80,
      lastUpdatedAt: status.lastUpdatedAt,
    });

    if (!neutralSnapshot) {
      return NextResponse.json(
        { ok: true, hasNeutralSnapshot: false },
        { status: 200, headers: devHeaders(status) }
      );
    }

    const neutralP80 = getNeutralP80Cost(neutralSnapshot);
    const result = computeMitigationOptimisation({
      risks: risks as Parameters<typeof computeMitigationOptimisation>[0]["risks"],
      neutralSnapshot,
    });

    dlog("[api/mit-opt] ok", {
      neutralP80: result.baseline.neutralP80,
      rankedCount: result.ranked.length,
    });

    const headers = devHeaders(getSimulationContextStatus());
    return NextResponse.json(
      {
        ok: true,
        hasNeutralSnapshot: true,
        neutralP80,
        sampleRankedCount: result.ranked.length,
      },
      { status: 200, headers }
    );
  } catch {
    return NextResponse.json(
      { error: "Unexpected error during mitigation optimisation" },
      { status: 500 }
    );
  }
}
