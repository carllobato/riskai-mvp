import { getProjectIfAccessible } from "@/lib/db/projectAccess";
import DevHealthPage from "../../../dev/health/page";

export default async function ProjectEngineHealthPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProjectIfAccessible(projectId);
  return <DevHealthPage projectId={project?.id ?? projectId} />;
}
