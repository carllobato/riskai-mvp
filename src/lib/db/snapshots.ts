import { supabaseBrowserClient } from "@/lib/supabase/browser";

/** Full JSON persisted with each snapshot (reporting / audit). */
export type SimulationSnapshotPayload = {
  summary: Record<string, number>;
  summaryReport: Record<string, number | undefined>;
  risks: unknown[];
  distributions: {
    costHistogram: { cost: number; frequency: number }[];
    timeHistogram: { time: number; frequency: number }[];
    binCount: number;
  };
  seed: number;
  inputs_used: Array<{
    risk_id: string;
    title: string;
    source_used: "pre" | "post";
    probability: number;
    cost_ml: number;
    time_ml: number;
  }>;
  scenario_outputs?: {
    conservative: Record<string, number | undefined>;
    aggressive: Record<string, number | undefined>;
  };
};

/** Fields passed to `createSnapshot` (matches insertable columns except DB-managed fields). */
export type SimulationSnapshotPersistInput = {
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
  payload: SimulationSnapshotPayload;
};

const DEFAULT_PROJECT_ID = "a8995152-7065-4f79-ab8a-015b6ab0a3ec";

/** Coerce to number; null if not finite (NaN, ±Infinity). */
function asFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Safe cost/time scalar for DB: finite → rounded to 2 dp; otherwise null. */
function sanitizeCostOrTimeScalar(value: unknown): number | null {
  const n = asFiniteNumber(value);
  if (n === null) return null;
  return Math.round(n * 100) / 100;
}

/** Safe duration ms: finite → integer; otherwise null. */
function sanitizeRunDurationMs(value: unknown): number | null {
  const n = asFiniteNumber(value);
  if (n === null) return null;
  return Math.round(n);
}

/** Safe risk count: finite → non-negative integer; otherwise null. */
function sanitizeRiskCount(value: unknown): number | null {
  const n = asFiniteNumber(value);
  if (n === null) return null;
  return Math.max(0, Math.floor(n));
}

/**
 * Insert a Monte Carlo simulation result into riskai_simulation_snapshots (reporting scalars + payload jsonb).
 * Returns the inserted row including the canonical UUID primary key (id). Throws on failure.
 * @param projectId - Optional project UUID; when omitted uses default (legacy single-project).
 */
export async function createSnapshot(
  snapshot: SimulationSnapshotPersistInput,
  projectId?: string
): Promise<SimulationSnapshotRow> {
  const pid = projectId ?? DEFAULT_PROJECT_ID;
  const supabase = supabaseBrowserClient();
  const TABLE = "riskai_simulation_snapshots" as const;

  const iterationsInt = Math.max(0, Math.floor(Number(snapshot.iterations)));

  const insertRow = {
    project_id: pid,
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
    engine_version: snapshot.engine_version,
    run_duration_ms: sanitizeRunDurationMs(snapshot.run_duration_ms),
    payload: snapshot.payload as unknown as Record<string, unknown>,
  };
  const { data, error } = await supabase
    .from(TABLE)
    .insert(insertRow)
    .select("id, project_id, iterations, created_at");

  if (error) {
    console.error("[snapshot insert error]", error);
    throw error;
  }

  const row = data?.[0];
  if (!row) {
    const err = new Error(
      "Snapshot insert returned no row (check RLS and that riskai_simulation_snapshots exists)."
    );
    console.error("[snapshot insert error]", err);
    throw err;
  }

  return row as SimulationSnapshotRow;
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
    .from("riskai_simulation_snapshots")
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

/** Row shape for public.riskai_simulation_snapshots (Supabase snake_case). */
export type SimulationSnapshotRow = {
  id?: string;
  project_id?: string;
  created_by?: string | null;
  iterations?: number;
  risk_count?: number | null;
  cost_p20?: number | null;
  cost_p50?: number | null;
  cost_p80?: number | null;
  cost_p90?: number | null;
  cost_mean?: number | null;
  cost_min?: number | null;
  cost_max?: number | null;
  time_p20?: number | null;
  time_p50?: number | null;
  time_p80?: number | null;
  time_p90?: number | null;
  time_mean?: number | null;
  time_min?: number | null;
  time_max?: number | null;
  engine_version?: string | null;
  run_duration_ms?: number | null;
  payload?: SimulationSnapshotPayload | null;
  created_at?: string;
} | null;

/**
 * Row from `select('*')` may include reporting columns if present in the database.
 * Base shape is {@link SimulationSnapshotRow}; this type is for typed access only.
 */
export type SimulationSnapshotRowDb = NonNullable<SimulationSnapshotRow> & {
  reporting_version?: boolean;
  reporting_locked_at?: string | null;
  reporting_locked_by?: string | null;
  reporting_note?: string | null;
  reporting_month_year?: string | null;
};

/**
 * Set a snapshot as the reporting version (one-way lock). Persists reporting_version, locked_at, locked_by, note, reporting_month_year.
 * reporting_month_year should be "YYYY-MM" (e.g. "2025-03").
 */
export async function setSnapshotAsReportingVersion(
  snapshotId: string,
  params: { note: string; lockedByUserId: string; reportingMonthYear: string }
): Promise<void> {
  const lockedByUserId = params.lockedByUserId?.trim();
  if (!lockedByUserId) {
    throw new Error("Cannot lock reporting snapshot without an authenticated user ID.");
  }

  const supabase = supabaseBrowserClient();
  const { error } = await supabase
    .from("riskai_simulation_snapshots")
    .update({
      reporting_version: true,
      reporting_locked_at: new Date().toISOString(),
      reporting_locked_by: lockedByUserId,
      reporting_note: params.note?.trim() || null,
      reporting_month_year: params.reportingMonthYear?.trim() || null,
    })
    .eq("id", snapshotId);

  if (error) {
    console.error("[setSnapshotAsReportingVersion]", error);
    throw error;
  }
}
