"use client";

import { useParams } from "next/navigation";
import ProjectInformationPage from "../../../project/page";

export default function ProjectSetupPage() {
  const params = useParams();
  const projectId = typeof params?.projectId === "string" ? params.projectId : null;
  return <ProjectInformationPage projectId={projectId} />;
}
