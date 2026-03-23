"use client";

import { useParams } from "next/navigation";
import SimulationPage from "../../../simulation/SimulationPageContent";

export default function ProjectSimulationPage() {
  const params = useParams();
  const projectId = typeof params?.projectId === "string" ? params.projectId : null;
  return <SimulationPage projectId={projectId} />;
}
