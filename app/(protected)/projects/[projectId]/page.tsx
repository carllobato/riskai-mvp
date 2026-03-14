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

  const [
    { data: projectExtra },
    { count: riskCount },
    { data: latestSnapshotRow },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("portfolio_id, owner_id")
      .eq("id", projectId)
      .single(),
    supabase
      .from("risks")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
    supabase
      .from("simulation_snapshots")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <ProjectOverviewContent
      initialData={{
        projectId,
        projectName: project.name,
        riskCount: riskCount ?? 0,
        latestSnapshot: (latestSnapshotRow as SimulationSnapshotRow | null) ?? null,
      }}
    />
  );
}
