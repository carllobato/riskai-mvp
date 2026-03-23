"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { riskaiPath } from "@/lib/routes";

/** Legacy route: redirect to Run Data for this project. */
export default function ProjectOutputsRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = typeof params?.projectId === "string" ? params.projectId : null;
  useEffect(() => {
    router.replace(projectId ? riskaiPath(`/projects/${projectId}/run-data`) : riskaiPath("/run-data"));
  }, [router, projectId]);
  return null;
}
