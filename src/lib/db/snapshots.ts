import { supabaseBrowserClient } from "@/lib/supabase/browser";

export type SimulationSnapshotInput = {
  scenario: string;
  iterations: number;
  p10_cost: number;
  p50_cost: number;
  p90_cost: number;
  p10_time: number;
  p50_time: number;
  p90_time: number;
  mean_cost?: number;
  mean_time?: number;
};

const DEFAULT_PROJECT_ID = "a8995152-7065-4f79-ab8a-015b6ab0a3ec";

/**
 * Insert a Monte Carlo simulation result summary into simulation_snapshots.
 * Returns the inserted row including the canonical UUID primary key (id).
 * @param projectId - Optional project UUID; when omitted uses default (legacy single-project).
 */
export async function createSnapshot(
  snapshot: SimulationSnapshotInput,
  projectId?: string
): Promise<SimulationSnapshotRow | null> {
  const pid = projectId ?? DEFAULT_PROJECT_ID;
  const supabase = supabaseBrowserClient();
  const { data, error } = await supabase
    .from("simulation_snapshots")
    .insert({
      project_id: pid,
      scenario: snapshot.scenario,
      iterations: Number(snapshot.iterations),
      p10_cost: Number(snapshot.p10_cost),
      p50_cost: Number(snapshot.p50_cost),
      p90_cost: Number(snapshot.p90_cost),
      p10_time: Number(snapshot.p10_time),
      p50_time: Number(snapshot.p50_time),
      p90_time: Number(snapshot.p90_time),
      mean_cost: snapshot.mean_cost ? Number(snapshot.mean_cost) : null,
      mean_time: snapshot.mean_time ? Number(snapshot.mean_time) : null,
    })
    .select("id, project_id, scenario, iterations, created_at")
    .single();

  if (error) {
    console.error("[snapshot insert error]", error);
    throw error;
  }

  return data as SimulationSnapshotRow | null;
}

/**
 * Fetch the most recent simulation snapshot for the project.
 * Uses maybeSingle() so 0 rows returns null without an error.
 * @param projectId - Optional project UUID; when omitted uses default (legacy single-project).
 */
export async function getLatestSnapshot(projectId?: string) {
  const pid = projectId ?? DEFAULT_PROJECT_ID;
  const supabase = supabaseBrowserClient();
  const { data, error } = await supabase
    .from("simulation_snapshots")
    .select("*")
    .eq("project_id", pid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[snapshot fetch error]", error.message ?? error);
  }

  return data;
}

/** Row shape returned by getLatestSnapshot (Supabase returns snake_case). */
export type SimulationSnapshotRow = {
  id?: string;
  project_id?: string;
  scenario?: string;
  iterations?: number;
  p10_cost?: number;
  p50_cost?: number;
  p90_cost?: number;
  p10_time?: number;
  p50_time?: number;
  p90_time?: number;
  mean_cost?: number | null;
  mean_time?: number | null;
  created_at?: string;
  reporting_version?: boolean;
  reporting_locked_at?: string | null;
  reporting_locked_by?: string | null;
  reporting_note?: string | null;
  reporting_month_year?: string | null;
} | null;

/**
 * Set a snapshot as the reporting version (one-way lock). Persists reporting_version, locked_at, locked_by, note, reporting_month_year.
 * reporting_month_year should be "YYYY-MM" (e.g. "2025-03").
 */
export async function setSnapshotAsReportingVersion(
  snapshotId: string,
  params: { note: string; lockedBy: string; reportingMonthYear: string }
): Promise<void> {
  const supabase = supabaseBrowserClient();
  const { error } = await supabase
    .from("simulation_snapshots")
    .update({
      reporting_version: true,
      reporting_locked_at: new Date().toISOString(),
      reporting_locked_by: params.lockedBy || null,
      reporting_note: params.note?.trim() || null,
      reporting_month_year: params.reportingMonthYear?.trim() || null,
    })
    .eq("id", snapshotId);

  if (error) {
    console.error("[setSnapshotAsReportingVersion]", error);
    throw error;
  }
}
