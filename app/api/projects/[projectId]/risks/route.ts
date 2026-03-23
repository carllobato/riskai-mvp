import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getProjectAccessForUser } from "@/lib/db/projectAccess";
import { RISK_STATUS_ARCHIVED_LOOKUP } from "@/domain/risk/riskFieldSemantics";
import { RISK_DB_SELECT_COLUMNS, type RiskInsertRow } from "@/lib/db/risks";
import type { RiskRow } from "@/types/risk";
import { supabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function asString(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeRiskRow(raw: unknown, projectId: string): RiskInsertRow | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id).trim();
  const title = asString(row.title).trim();
  if (!id || !title) return null;
  const createdAt = asString(row.created_at).trim();
  const updatedAt = asString(row.updated_at).trim();
  if (!createdAt || !updatedAt) return null;

  return {
    id,
    project_id: projectId,
    risk_number: asNullableNumber(row.risk_number),
    title,
    description:
      typeof row.description === "string" && row.description.length > 0 ? row.description : null,
    category: asString(row.category),
    owner: typeof row.owner === "string" && row.owner.length > 0 ? row.owner : null,
    applies_to:
      typeof row.applies_to === "string" && row.applies_to.length > 0 ? row.applies_to : null,
    status: asString(row.status),
    pre_probability: asNumber(row.pre_probability),
    pre_cost_min: asNullableNumber(row.pre_cost_min),
    pre_cost_ml: asNumber(row.pre_cost_ml),
    pre_cost_max: asNullableNumber(row.pre_cost_max),
    pre_time_min: asNullableNumber(row.pre_time_min),
    pre_time_ml: asNumber(row.pre_time_ml),
    pre_time_max: asNullableNumber(row.pre_time_max),
    mitigation_description:
      typeof row.mitigation_description === "string" && row.mitigation_description.length > 0
        ? row.mitigation_description
        : null,
    mitigation_cost: asNumber(row.mitigation_cost),
    post_probability: asNumber(row.post_probability),
    post_cost_min: asNullableNumber(row.post_cost_min),
    post_cost_ml: asNumber(row.post_cost_ml),
    post_cost_max: asNullableNumber(row.post_cost_max),
    post_time_min: asNullableNumber(row.post_time_min),
    post_time_ml: asNumber(row.post_time_ml),
    post_time_max: asNullableNumber(row.post_time_max),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export async function GET(
  _request: Request,
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

  const supabase = await supabaseServerClient();
  const { data, error } = await supabase
    .from("risks")
    .select(RISK_DB_SELECT_COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ risks: (data ?? []) as RiskRow[] }, { status: 200 });
}

export async function PUT(
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

  let body: { risks?: unknown };
  try {
    body = (await request.json()) as { risks?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.risks)) {
    return NextResponse.json({ error: "Invalid payload: risks must be an array" }, { status: 400 });
  }

  const rows: RiskInsertRow[] = [];
  for (const item of body.risks) {
    const normalized = normalizeRiskRow(item, projectId);
    if (!normalized) {
      return NextResponse.json({ error: "Invalid payload: malformed risk row" }, { status: 400 });
    }
    rows.push(normalized);
  }

  const supabase = await supabaseServerClient();
  const { data: existingRows, error: listErr } = await supabase
    .from("risks")
    .select("id")
    .eq("project_id", projectId);

  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  const clientIds = new Set(rows.map((r) => r.id));
  const existingIds = ((existingRows ?? []) as { id: string }[]).map((r) => r.id);
  const orphanIds = existingIds.filter((id) => !clientIds.has(id));

  if (rows.length > 0) {
    const { data: upsertedRows, error: upsertError } = await supabase
      .from("risks")
      .upsert(rows, { onConflict: "id" })
      .select(RISK_DB_SELECT_COLUMNS);

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    const upserted = (upsertedRows ?? []) as RiskRow[];
    if (upserted.length !== rows.length) {
      return NextResponse.json(
        {
          error: `Failed to save risks: expected ${rows.length} rows back, got ${upserted.length}.`,
        },
        { status: 500 }
      );
    }

    const byId = new Map(upserted.map((r) => [r.id, r]));
    const ordered: RiskRow[] = [];
    for (const row of rows) {
      const matched = byId.get(row.id);
      if (!matched) {
        return NextResponse.json(
          { error: `Failed to save risks: missing upserted row for id ${row.id}.` },
          { status: 500 }
        );
      }
      ordered.push(matched);
    }

    if (orphanIds.length > 0) {
      const now = new Date().toISOString();
      const { error: archErr } = await supabase
        .from("risks")
        .update({ status: RISK_STATUS_ARCHIVED_LOOKUP, updated_at: now })
        .in("id", orphanIds)
        .eq("project_id", projectId);
      if (archErr) {
        return NextResponse.json({ error: archErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ risks: ordered }, { status: 200 });
  }

  if (orphanIds.length > 0) {
    const now = new Date().toISOString();
    const { error: archErr } = await supabase
      .from("risks")
      .update({ status: RISK_STATUS_ARCHIVED_LOOKUP, updated_at: now })
      .in("id", orphanIds)
      .eq("project_id", projectId);
    if (archErr) {
      return NextResponse.json({ error: archErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ risks: [] }, { status: 200 });
}
