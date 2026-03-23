import { redirect } from "next/navigation";

export default async function ProjectHealthPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/riskai/projects/${projectId}/engine-health`);
}
