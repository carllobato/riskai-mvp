import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getProjectAccessForUser } from "@/lib/db/projectAccess";
import { supabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function reportMonthDateFromYearMonth(reportingMonthYear: string): string {
  const trimmed = reportingMonthYear.trim();
  if (!/^\d{4}-\d{2}$/.test(trimmed)) {
    throw new Error(`Invalid reportingMonthYear "${reportingMonthYear}" (expected YYYY-MM)`);
  }
  return `${trimmed}-01`;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; snapshotId: string }> }
) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId, snapshotId } = await context.params;
  if (!projectId || !snapshotId) {
    return NextResponse.json({ error: "Project ID and snapshot ID are required" }, { status: 400 });
  }

  const access = await getProjectAccessForUser(projectId, user.id);
  if (!access) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!access.permissions.canEditContent) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }

  let body: { note?: unknown; reportingMonthYear?: unknown };
  try {
    body = (await request.json()) as { note?: unknown; reportingMonthYear?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.reportingMonthYear !== "string" || !body.reportingMonthYear.trim()) {
    return NextResponse.json({ error: "reportingMonthYear is required" }, { status: 400 });
  }

  const note =
    typeof body.note === "string" && body.note.trim().length > 0 ? body.note.trim() : null;

  let reportMonth: string;
  try {
    reportMonth = reportMonthDateFromYearMonth(body.reportingMonthYear);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid reportingMonthYear";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = await supabaseServerClient();
  const { data, error } = await supabase
    .from("riskai_simulation_snapshots")
    .update({
      locked_for_reporting: true,
      locked_at: new Date().toISOString(),
      locked_by: user.id,
      lock_note: note,
      report_month: reportMonth,
    })
    .eq("id", snapshotId)
    .eq("project_id", projectId)
    .select("id, locked_for_reporting, locked_at, locked_by, lock_note, report_month")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
  }

  return NextResponse.json({ snapshot: data }, { status: 200 });
}
