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

const PROJECT_ID = "a8995152-7065-4f79-ab8a-015b6ab0a3ec";

/**
 * Insert a Monte Carlo simulation result summary into simulation_snapshots.
 */
export async function createSnapshot(snapshot: SimulationSnapshotInput): Promise<void> {
  try {
    const supabase = supabaseBrowserClient();
    const { error } = await supabase.from("simulation_snapshots").insert({
      project_id: PROJECT_ID,
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
