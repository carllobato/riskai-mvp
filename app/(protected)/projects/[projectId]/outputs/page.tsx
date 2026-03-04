"use client";

import { useParams } from "next/navigation";
import OutputsPage from "../../../outputs/page";

export default function ProjectOutputsPage() {
  const params = useParams();
  const projectId = typeof params?.projectId === "string" ? params.projectId : null;
  return <OutputsPage projectId={projectId} />;
}
