import { notFound } from "next/navigation";
import { getProjectIfAccessible } from "@/lib/db/projectAccess";
import { supabaseServerClient } from "@/lib/supabase/server";
import { ProjectOverviewContent } from "./ProjectOverviewContent";
import type { SimulationSnapshotRow } from "@/lib/db/snapshots";

export default async function ProjectDashboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProjectIfAccessible(projectId);
  if (!project) notFound();

  const supabase = await supabaseServerClient();

  const { data: lockedReportingRow, error: lockedReportingError } = await supabase
    .from("riskai_simulation_snapshots")
    .select("*")
    .eq("project_id", projectId)
    .eq("locked_for_reporting", true)
    .order("locked_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (lockedReportingError) {
    console.error("[ProjectOverview] locked reporting snapshot query failed", lockedReportingError);
  }

  return (
    <ProjectOverviewContent
      initialData={{
        projectId,
        reportingSnapshot: (lockedReportingRow as SimulationSnapshotRow | null) ?? null,
      }}
    />
  );
}
