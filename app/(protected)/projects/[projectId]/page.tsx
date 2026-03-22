import { notFound } from "next/navigation";
import { getProjectIfAccessible } from "@/lib/db/projectAccess";
import { supabaseServerClient } from "@/lib/supabase/server";
import { isRiskStatusArchived } from "@/domain/risk/riskFieldSemantics";
import { buildRating, costToConsequenceScale, timeDaysToConsequenceScale } from "@/domain/risk/risk.logic";
import { ProjectOverviewContent } from "./ProjectOverviewContent";
import type { SimulationSnapshotRowDb } from "@/lib/db/snapshots";

type RiskAggRow = {
  status?: string | null;
  post_probability?: number | null;
  post_cost_ml?: number | null;
  post_time_ml?: number | null;
};

function residualLevel(row: RiskAggRow): "low" | "medium" | "high" | "extreme" {
  const postConsequence = Math.max(
    costToConsequenceScale(Number(row.post_cost_ml) || 0),
    timeDaysToConsequenceScale(Number(row.post_time_ml) || 0)
  );
  return buildRating(Number(row.post_probability) || 1, postConsequence).level;
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

  const [{ data: riskRows }, { data: latestLockedReportingSnapshotRow }] = await Promise.all([
    supabase
      .from("risks")
      .select("status, post_probability, post_cost_ml, post_time_ml")
      .eq("project_id", projectId),
    supabase
      .from("riskai_simulation_snapshots")
      .select("*")
      .eq("project_id", projectId)
      .eq("reporting_version", true)
      .order("reporting_month_year", { ascending: false, nullsFirst: false })
      .order("reporting_locked_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const activeRiskRows = (riskRows ?? []).filter((r) => !isRiskStatusArchived((r as RiskAggRow).status));
  const severity = activeRiskRows.reduce(
    (acc, row) => {
      const level = residualLevel(row as RiskAggRow);
      if (level === "high" || level === "extreme") acc.highOrExtreme += 1;
      else if (level === "medium") acc.medium += 1;
      return acc;
    },
    { highOrExtreme: 0, medium: 0 }
  );

  return (
    <ProjectOverviewContent
      initialData={{
        projectId,
        projectName: project.name,
        riskCount: activeRiskRows.length,
        highSeverityCount: severity.highOrExtreme,
        mediumSeverityCount: severity.medium,
        reportingSnapshot: (latestLockedReportingSnapshotRow as SimulationSnapshotRowDb | null) ?? null,
      }}
    />
  );
}
