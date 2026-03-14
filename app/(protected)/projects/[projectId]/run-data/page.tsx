"use client";

import { useParams } from "next/navigation";
import RunDataPage from "../../../run-data/page";

export default function ProjectRunDataPage() {
  const params = useParams();
  const projectId = typeof params?.projectId === "string" ? params.projectId : null;
  return <RunDataPage projectId={projectId} />;
}
