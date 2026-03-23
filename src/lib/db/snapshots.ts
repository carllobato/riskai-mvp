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
  const res = await fetch(`/api/projects/${encodeURIComponent(pid)}/snapshots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      ...snapshot,
      // Preserve existing client-side normalization semantics.
      iterations: Math.max(0, Math.floor(Number(snapshot.iterations))),
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
      run_duration_ms: sanitizeRunDurationMs(snapshot.run_duration_ms),
      payload: snapshot.payload as unknown as Record<string, unknown>,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    snapshot?: SimulationSnapshotRow;
    error?: string;
  };
  if (!res.ok || !json.snapshot) {
    const message = json.error?.trim() || `Snapshot create failed (${res.status})`;
    console.error("[snapshot insert error]", message);
    throw new Error(message);
  }
  return json.snapshot;
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

/**
 * Fetch the most recent snapshot marked as reporting-locked for the project.
 * Uses maybeSingle() so 0 rows returns null without an error.
 * @param projectId - Optional project UUID; when omitted uses default (legacy single-project).
 */
export async function getLatestLockedSnapshot(projectId?: string) {
  const pid = projectId ?? DEFAULT_PROJECT_ID;
  const supabase = supabaseBrowserClient();
  const { data, error } = await supabase
    .from("riskai_simulation_snapshots")
    .select("*")
    .eq("project_id", pid)
    .eq("locked_for_reporting", true)
    .order("locked_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[snapshot fetch latest locked error]", error.message ?? error);
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
  locked_for_reporting?: boolean;
  locked_at?: string | null;
  locked_by?: string | null;
  lock_note?: string | null;
  report_month?: string | null;
} | null;

/** Format snapshot `created_at` like Run Data: "15 Mar 2026 — 09:08:37". */
export function formatSnapshotCreatedAtLabel(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const datePart = d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const timePart = d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    return `${datePart} — ${timePart}`;
  } catch {
    return iso;
  }
}

/**
 * Human-readable run label (no separate run name column). Uses iterations + run time, aligned with Run Data.
 */
export function formatSimulationRunDisplayName(
  row: SimulationSnapshotRow | null | undefined
): string | null {
  if (!row || typeof row !== "object") return null;
  const created = row.created_at;
  const iter = row.iterations;
  if (created) {
    const ts = formatSnapshotCreatedAtLabel(created);
    if (iter != null && Number.isFinite(Number(iter))) {
      return `${Number(iter).toLocaleString()} iterations · ${ts}`;
    }
    return ts;
  }
  const id = row.id;
  if (id && !String(id).startsWith("sim_")) {
    return `Run ${String(id).slice(0, 8)}…`;
  }
  return null;
}

/** `report_month` (ISO date or `YYYY-MM-…`) → "March 2026"; invalid or empty → "—". */
export function formatReportMonthLabel(reportMonth: string | null | undefined): string {
  if (!reportMonth) return "—";
  const ym = reportMonth.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(ym)) return "—";
  const [y, m] = ym.split("-").map(Number);
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/**
 * Row from `select('*')` may include reporting lock columns if present in the database.
 * Base shape is {@link SimulationSnapshotRow}; this type is for typed access only.
 */
export type SimulationSnapshotRowDb = NonNullable<SimulationSnapshotRow>;

export type SetSnapshotAsReportingVersionResult = {
  id: string;
  locked_for_reporting: boolean;
  locked_at: string | null;
  locked_by: string | null;
  lock_note: string | null;
  report_month: string | null;
};

/**
 * Set a snapshot as the reporting version (one-way lock) on `riskai_simulation_snapshots`.
 * Uses columns: locked_for_reporting, locked_at, locked_by (auth user UUID), lock_note, report_month.
 */
export async function setSnapshotAsReportingVersion(
  snapshotId: string,
  params: { userId: string; note?: string; reportingMonthYear: string; projectId?: string }
): Promise<SetSnapshotAsReportingVersionResult> {
  const userId = params.userId?.trim();
  if (!userId) {
    const err = new Error("setSnapshotAsReportingVersion: userId is required");
    console.error("[setSnapshotAsReportingVersion]", err);
    throw err;
  }
  const supabase = supabaseBrowserClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    const err = new Error(authErr?.message ?? "Not authenticated");
    console.error("[setSnapshotAsReportingVersion]", err);
    throw err;
  }
  const projectId = params.projectId?.trim() || undefined;
  if (!projectId) {
    const err = new Error(
      "setSnapshotAsReportingVersion: projectId is required"
    );
    console.error("[setSnapshotAsReportingVersion]", err);
    throw err;
  }

  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/snapshots/${encodeURIComponent(snapshotId)}/lock-reporting`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        note: params.note?.trim() || null,
        reportingMonthYear: params.reportingMonthYear,
      }),
    }
  );
  const json = (await res.json().catch(() => ({}))) as {
    snapshot?: SetSnapshotAsReportingVersionResult;
    error?: string;
  };
  if (!res.ok || !json.snapshot) {
    const message = json.error?.trim() || `Set reporting version failed (${res.status})`;
    console.error("[setSnapshotAsReportingVersion] API error", message);
    throw new Error(message);
  }
  return json.snapshot;
}
