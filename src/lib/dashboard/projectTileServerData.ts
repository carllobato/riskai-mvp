import type { SupabaseClient } from "@supabase/supabase-js";
import { buildRating, costToConsequenceScale, timeDaysToConsequenceScale } from "@/domain/risk/risk.logic";
import type { AccessibleProject } from "@/lib/portfolios-server";

export type RagStatus = "green" | "amber" | "red";

export type ProjectTilePayload = {
  id: string;
  name: string;
  created_at: string | null;
  ragStatus: RagStatus;
};

type RiskAggRow = {
  project_id: string;
  post_probability: number;
  post_cost_ml: number;
  post_time_ml: number;
  mitigation_description: string | null;
};

type SnapRow = {
  project_id: string;
  created_at: string | null;
};

function residualLevel(row: RiskAggRow): "low" | "medium" | "high" | "extreme" {
  const postConsequence = Math.max(
    costToConsequenceScale(Number(row.post_cost_ml) || 0),
    timeDaysToConsequenceScale(Number(row.post_time_ml) || 0)
  );
  return buildRating(Number(row.post_probability) || 1, postConsequence).level;
}

function computeRag(params: {
  riskCount: number;
  highSeverityCount: number;
  lastSimulationAt: string | null;
}): RagStatus {
  if (params.highSeverityCount > 0) return "red";
  if (params.riskCount > 0 && !params.lastSimulationAt) return "amber";
  return "green";
}

/**
 * Loads per-project RAG for dashboard tiles (server-only; same access scope as project list).
 */
export async function getProjectTilePayloads(
  supabase: SupabaseClient,
  projects: AccessibleProject[]
): Promise<ProjectTilePayload[]> {
  if (projects.length === 0) return [];

  const ids = projects.map((p) => p.id);

  const [risksRes, snapshotsRes] = await Promise.all([
    supabase
      .from("risks")
      .select("project_id, post_probability, post_cost_ml, post_time_ml, mitigation_description")
      .in("project_id", ids),
    supabase.from("simulation_snapshots").select("project_id, created_at").in("project_id", ids),
  ]);

  if (risksRes.error || snapshotsRes.error) {
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      created_at: p.created_at,
      ragStatus: "amber" as const,
    }));
  }

  const risks = (risksRes.data ?? []) as RiskAggRow[];
  const snapshots = (snapshotsRes.data ?? []) as SnapRow[];

  const riskStats = new Map<string, { count: number; highSeverity: number }>();
  for (const id of ids) {
    riskStats.set(id, { count: 0, highSeverity: 0 });
  }
  for (const r of risks) {
    const stat = riskStats.get(r.project_id);
    if (!stat) continue;
    stat.count += 1;
    const level = residualLevel(r);
    if (level === "high" || level === "extreme") stat.highSeverity += 1;
  }

  const sortedSnaps = [...snapshots].sort((a, b) => {
    const ta = new Date(a.created_at ?? 0).getTime();
    const tb = new Date(b.created_at ?? 0).getTime();
    return tb - ta;
  });

  const latestSimAtByProject = new Map<string, string | null>();
  for (const id of ids) latestSimAtByProject.set(id, null);
  for (const row of sortedSnaps) {
    if (latestSimAtByProject.get(row.project_id) != null) continue;
    latestSimAtByProject.set(row.project_id, row.created_at ?? null);
  }

  return projects.map((p) => {
    const stat = riskStats.get(p.id) ?? { count: 0, highSeverity: 0 };
    const lastSimulationAt = latestSimAtByProject.get(p.id) ?? null;
    const ragStatus = computeRag({
      riskCount: stat.count,
      highSeverityCount: stat.highSeverity,
      lastSimulationAt,
    });

    return {
      id: p.id,
      name: p.name,
      created_at: p.created_at,
      ragStatus,
    };
  });
}

/** Red → Amber → Green for dashboard ordering. */
export const RAG_SORT_ORDER: Record<RagStatus, number> = {
  red: 0,
  amber: 1,
  green: 2,
};

export function sortProjectTilesByRag(tiles: ProjectTilePayload[]): ProjectTilePayload[] {
  return [...tiles].sort((a, b) => {
    const byRag = RAG_SORT_ORDER[a.ragStatus] - RAG_SORT_ORDER[b.ragStatus];
    if (byRag !== 0) return byRag;
    const an = (a.name || a.id).toLocaleLowerCase();
    const bn = (b.name || b.id).toLocaleLowerCase();
    return an.localeCompare(bn);
  });
}
