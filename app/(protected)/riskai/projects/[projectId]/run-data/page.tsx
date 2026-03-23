import { getProjectIfAccessible } from "@/lib/db/projectAccess";
import RunDataPage from "../../../run-data/page";

export default async function ProjectRunDataPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProjectIfAccessible(projectId);
  return (
    <RunDataPage
      projectId={project?.id ?? projectId}
      projectName={project?.name ?? null}
    />
  );
}
