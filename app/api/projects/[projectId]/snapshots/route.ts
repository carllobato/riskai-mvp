import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getProjectAccessForUser } from "@/lib/db/projectAccess";
import { supabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SnapshotPayload = {
  iterations: number;
  cost_p20: number;
  cost_p50: number;
  cost_p80: number;
  cost_p90: number;
  cost_mean: number;
  cost_min: number;
  cost_max: number;
  time_p20: number;
  time_p50: number;
  time_p80: number;
  time_p90: number;
  time_mean: number;
  time_min: number;
  time_max: number;
  risk_count: number;
  engine_version: string;
  run_duration_ms: number;
  payload: unknown;
};

function asFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sanitizeCostOrTimeScalar(value: unknown): number | null {
  const n = asFiniteNumber(value);
  if (n === null) return null;
  return Math.round(n * 100) / 100;
}

function sanitizeRunDurationMs(value: unknown): number | null {
  const n = asFiniteNumber(value);
  if (n === null) return null;
  return Math.round(n);
}

function sanitizeRiskCount(value: unknown): number | null {
  const n = asFiniteNumber(value);
  if (n === null) return null;
  return Math.max(0, Math.floor(n));
}

function isValidSnapshotPayload(value: unknown): value is SnapshotPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.engine_version !== "string" || !v.engine_version.trim()) return false;
  if (!("payload" in v)) return false;
  const numericKeys: Array<keyof SnapshotPayload> = [
    "iterations",
    "cost_p20",
    "cost_p50",
    "cost_p80",
    "cost_p90",
    "cost_mean",
    "cost_min",
    "cost_max",
    "time_p20",
    "time_p50",
    "time_p80",
    "time_p90",
    "time_mean",
    "time_min",
    "time_max",
    "risk_count",
    "run_duration_ms",
  ];
  return numericKeys.every((k) => asFiniteNumber(v[k]) !== null);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId } = await context.params;
  if (!projectId) {
    return NextResponse.json({ error: "Project ID required" }, { status: 400 });
  }

  const access = await getProjectAccessForUser(projectId, user.id);
  if (!access) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!access.permissions.canEditContent) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isValidSnapshotPayload(body)) {
    return NextResponse.json({ error: "Invalid snapshot payload" }, { status: 400 });
  }

  const snapshot = body as SnapshotPayload;
  const iterationsInt = Math.max(0, Math.floor(Number(snapshot.iterations)));
  const insertRow = {
    project_id: projectId,
    created_by: user.id,
    iterations: iterationsInt,
    cost_p20: sanitizeCostOrTimeScalar(snapshot.cost_p20),
    cost_p50: sanitizeCostOrTimeScalar(snapshot.cost_p50),
    cost_p80: sanitizeCostOrTimeScalar(snapshot.cost_p80),
    cost_p90: sanitizeCostOrTimeScalar(snapshot.cost_p90),
    cost_mean: sanitizeCostOrTimeScalar(snapshot.cost_mean),
    cost_min: sanitizeCostOrTimeScalar(snapshot.cost_min),
    cost_max: sanitizeCostOrTimeScalar(snapshot.cost_max),
    time_p20: sanitizeCostOrTimeScalar(snapshot.time_p20),
    time_p50: sanitizeCostOrTimeScalar(snapshot.time_p50),
    time_p80: sanitizeCostOrTimeScalar(snapshot.time_p80),
    time_p90: sanitizeCostOrTimeScalar(snapshot.time_p90),
    time_mean: sanitizeCostOrTimeScalar(snapshot.time_mean),
    time_min: sanitizeCostOrTimeScalar(snapshot.time_min),
    time_max: sanitizeCostOrTimeScalar(snapshot.time_max),
    risk_count: sanitizeRiskCount(snapshot.risk_count),
    engine_version: snapshot.engine_version.trim(),
    run_duration_ms: sanitizeRunDurationMs(snapshot.run_duration_ms),
    payload: snapshot.payload as Record<string, unknown>,
  };

  try {
    const supabase = await supabaseServerClient();
    const { data, error } = await supabase
      .from("riskai_simulation_snapshots")
      .insert(insertRow)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ snapshot: data }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
