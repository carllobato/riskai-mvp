import { notFound } from "next/navigation";
import { getProjectIfAccessible } from "@/lib/db/projectAccess";
import { supabaseServerClient } from "@/lib/supabase/server";
import { isRiskStatusArchived } from "@/domain/risk/riskFieldSemantics";
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

  const [{ data: riskRows }, { data: latestSnapshotRow }] = await Promise.all([
    supabase.from("risks").select("id, status").eq("project_id", projectId),
    supabase
      .from("riskai_simulation_snapshots")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const riskCount =
    (riskRows ?? []).filter((r) => !isRiskStatusArchived((r as { status?: string | null }).status)).length;

  return (
    <ProjectOverviewContent
      initialData={{
        projectId,
        projectName: project.name,
        riskCount,
        latestSnapshot: (latestSnapshotRow as SimulationSnapshotRow | null) ?? null,
      }}
    />
  );
}
