import { notFound } from "next/navigation";
import { getProjectIfAccessible } from "@/lib/db/projectAccess";
import { supabaseServerClient } from "@/lib/supabase/server";
import { isRiskStatusArchived } from "@/domain/risk/riskFieldSemantics";
import {
  buildRating,
  costToConsequenceScale,
  timeDaysToConsequenceScale,
} from "@/domain/risk/risk.logic";
import { ProjectOverviewContent } from "./ProjectOverviewContent";
import type { SimulationSnapshotRow } from "@/lib/db/snapshots";

type RiskAggRow = {
  status: string | null;
  post_probability: number | null;
  post_cost_ml: number | null;
  post_time_ml: number | null;
};

function hasHighResidualSeverity(row: RiskAggRow): boolean {
  const consequence = Math.max(
    costToConsequenceScale(Number(row.post_cost_ml) || 0),
    timeDaysToConsequenceScale(Number(row.post_time_ml) || 0)
  );
  const level = buildRating(Number(row.post_probability) || 1, consequence).level;
  return level === "high" || level === "extreme";
}

export default async function ProjectDashboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProjectIfAccessible(projectId);
  if (!project) notFound();

  const supabase = await supabaseServerClient();

  const [{ data: riskRows }, { data: latestLockedSnapshotRow }] = await Promise.all([
    supabase
      .from("risks")
      .select("status, post_probability, post_cost_ml, post_time_ml")
      .eq("project_id", projectId),
    supabase
      .from("riskai_simulation_snapshots")
      .select("*")
      .eq("project_id", projectId)
      .eq("locked_for_reporting", true)
      .order("report_month", { ascending: false, nullsFirst: false })
      .order("locked_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const activeRows = ((riskRows ?? []) as RiskAggRow[]).filter(
    (row) => !isRiskStatusArchived(row.status)
  );
  const riskCount = activeRows.length;
  const hasHighSeverity = activeRows.some(hasHighResidualSeverity);
  const ragStatus = hasHighSeverity
    ? "red"
    : riskCount > 0 && !latestLockedSnapshotRow
      ? "amber"
      : "green";

  return (
    <ProjectOverviewContent
      initialData={{
        projectId,
        projectName: project.name,
        ragStatus,
        riskCount,
        latestLockedSnapshot:
          (latestLockedSnapshotRow as SimulationSnapshotRow | null) ?? null,
      }}
    />
  );
}
