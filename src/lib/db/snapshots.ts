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
 * @param projectId - Optional project UUID; when omitted uses default (legacy single-project).
 */
export async function createSnapshot(
  snapshot: SimulationSnapshotInput,
  projectId?: string
): Promise<void> {
  const pid = projectId ?? DEFAULT_PROJECT_ID;
  try {
    const supabase = supabaseBrowserClient();
    const { error } = await supabase.from("simulation_snapshots").insert({
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
    });

    if (error) {
      console.error("[snapshot insert error]", error);
      throw error;
    }
  } catch (error) {
    console.error("[snapshot insert error]", error);
    throw error;
  }
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
} | null;
